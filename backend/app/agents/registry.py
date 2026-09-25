"""
Agent Registry — Thin LLM Caller Only.

This module is ONLY responsible for:
  1. Sending a prompt + user_content to an LLM provider
  2. Exponential backoff, circuit breaker, fallback chain
  3. Optional Pydantic structured-output parsing

Zero business logic. Zero prompts. Zero agent definitions.
All prompts and logic live in their respective API modules.
"""
import json
import time
from typing import Any, Optional, Type

import httpx
from loguru import logger
from pydantic import BaseModel

from app.core.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# Circuit Breaker State (module-level singleton)
# ─────────────────────────────────────────────────────────────────────────────
_CIRCUIT_BREAKER = {"fails": 0, "disabled_until": 0.0}
_CIRCUIT_BREAKERS = {}
_CB_FAIL_THRESHOLD = 4       # failures before tripping
_CB_BASE_DISABLE_SECS = 20   # initial disable window (exponential on repeated trips)
_CB_PERMANENT_DISABLE_SECS = 3600  # long disable for auth/payment/billing errors


class ProviderAuthError(Exception):
    """Permanent provider failure (401 Unauthorized, 402 Payment Required, 403 Forbidden)."""


def _is_permanent_provider_error(exc: Exception) -> bool:
    """True if the error is a billing/auth problem that retrying will never fix."""
    return isinstance(exc, ProviderAuthError)


def _extract_rate_limit_wait(exc: Exception) -> float:
    """
    Parse the 'Please try again in X s' hint from provider 429 responses.
    Returns the wait in seconds (capped at 30s), or 0.0 if not a rate-limit error.
    """
    import re as _re
    msg = str(exc)
    if "rate_limit_exceeded" not in msg and "429" not in msg:
        return 0.0
    match = _re.search(r"try again in\s*([0-9.]+)\s*s", msg)
    if match:
        return min(float(match.group(1)) + 0.5, 30.0)
    return 15.0  # generic rate-limit fallback wait


def _get_circuit_breaker(provider: str) -> dict:
    if provider not in _CIRCUIT_BREAKERS:
        _CIRCUIT_BREAKERS[provider] = {"fails": 0, "disabled_until": 0.0}
    return _CIRCUIT_BREAKERS[provider]


# ─────────────────────────────────────────────────────────────────────────────
# Public API — used by all agent modules
# ─────────────────────────────────────────────────────────────────────────────

def call_llm(
    system_prompt: str,
    user_content: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    response_model: Optional[Type[BaseModel]] = None,
    max_retries: int = 3,
    fallback_chain: Optional[list[str]] = None,
    allow_google: bool = True,
    temperature: Optional[float] = None,
) -> Any:
    """
    Unified LLM caller with:
      - Exponential backoff
      - Provider fallback chain (groq → google, nvidia → google)
      - Circuit breaker (trips after 5 consecutive failures, resets after 60s)
      - Optional structured-output parsing via Pydantic model

    Args:
        system_prompt:  The system/instruction prompt (owned by the caller).
        user_content:   The user-turn content (the data to process).
        provider:       LLM provider override ('groq', 'google', 'nvidia').
                        Falls back to settings.LLM_PROVIDER if None.
        model:          Specific model override.
        response_model: Optional Pydantic BaseModel for structured output.
        max_retries:    Max attempts before giving up.
        fallback_chain: Optional list of fallback providers to override the default.
        allow_google:   If False, prevents using or falling back to Google Gemini models.

    Returns:
        - Parsed dict if response_model provided and parsing succeeds.
        - Raw response string otherwise.
        - None on total failure.
    """
    # For backward compatibility with tests that override _CIRCUIT_BREAKER directly
    if time.time() < _CIRCUIT_BREAKER["disabled_until"]:
        logger.warning("Circuit breaker OPEN (global) — skipping LLM call.")
        return None

    # Free-model mode must never fall through to a different (possibly paid) provider.
    original_provider = "siliconflow" if settings.LLM_PROVIDER == "siliconflow" else (provider or (settings.LLM_PROVIDERS_ORDER[0] if settings.LLM_PROVIDERS_ORDER else settings.LLM_PROVIDER))

    raw_fallback_chain = ["siliconflow"] if settings.LLM_PROVIDER == "siliconflow" else (fallback_chain if fallback_chain is not None else _build_fallback_chain(original_provider))
    
    # Filter out providers that do not have their API keys configured in settings
    actual_fallback_chain = []
    for p in raw_fallback_chain:
        if p == "siliconflow" and not settings.SILICONFLOW_API_KEY:
            continue
        if p in ("gemini", "google") and not settings.GOOGLE_API_KEY:
            continue
        if p == "groq" and not settings.GROQ_API_KEY:
            continue
        if p == "nvidia" and not settings.NVIDIA_API_KEY:
            continue
        actual_fallback_chain.append(p)

    if not actual_fallback_chain:
        logger.error("No configured LLM providers available in the fallback chain. Skipping LLM call.")
        return None

    # Find the first active provider that is not disabled by circuit breaker
    current_idx = 0
    while current_idx < len(actual_fallback_chain):
        provider_candidate = actual_fallback_chain[current_idx]
        cb = _get_circuit_breaker(provider_candidate)
        if time.time() < cb["disabled_until"]:
            logger.warning(f"Circuit breaker OPEN for [{provider_candidate}] — checking next fallback/provider.")
            current_idx += 1
        else:
            break

    if current_idx >= len(actual_fallback_chain):
        logger.error("All providers in fallback chain have open circuit breakers. Skipping LLM call.")
        return None

    from app.core.observability import track_llm_call, increment_fallback

    while current_idx < len(actual_fallback_chain):
        active_provider = actual_fallback_chain[current_idx]
        cb = _get_circuit_breaker(active_provider)
        
        # Double check circuit breaker state
        if time.time() < cb["disabled_until"]:
            current_idx += 1
            continue

        # Try this provider up to 2 times
        max_retries_per_provider = 2
        permanent_failure = False
        for attempt in range(max_retries_per_provider):
            try:
                start_time = time.time()
                # Dynamically resolve model ID for fallback provider to avoid 404s
                active_model = settings.SILICONFLOW_MODEL if active_provider == "siliconflow" else model
                if active_provider != original_provider:
                    if active_provider == "groq":
                        active_model = settings.GROQ_MODEL
                    elif active_provider == "nvidia":
                        active_model = settings.NVIDIA_MODEL
                    elif active_provider in ("gemini", "google"):
                        active_model = settings.GOOGLE_MODEL
                    elif active_provider == "siliconflow":
                        active_model = settings.SILICONFLOW_MODEL

                response_text, in_t, out_t = _dispatch(
                    active_provider,
                    system_prompt,
                    user_content,
                    model=active_model,
                    temperature=temperature,
                    json_mode=(response_model is not None)
                )
                latency = time.time() - start_time

                # Track successful LLM call metrics
                track_llm_call(active_provider, latency, in_t, out_t)

                if response_model and response_text:
                    parsed = _parse_structured(response_text, response_model)
                    _reset_circuit_breaker(active_provider)
                    return parsed

                _reset_circuit_breaker(active_provider)
                return response_text

            except Exception as exc:
                import traceback
                from app.core.observability import track_error

                if _is_permanent_provider_error(exc):
                    # Billing/auth errors (401/402/403) will NEVER succeed on retry.
                    # Fail fast, long-disable this provider, and move on immediately.
                    logger.error(
                        f"Permanent provider failure [{active_provider}] — fail-fast. "
                        f"Disabling for {_CB_PERMANENT_DISABLE_SECS}s: {exc}"
                    )
                    cb["fails"] = 1
                    cb["disabled_until"] = time.time() + _CB_PERMANENT_DISABLE_SECS
                    permanent_failure = True
                    break  # skip remaining retries for this provider

                track_error(
                    f"LLM call failed [{active_provider}] attempt {attempt + 1}/{max_retries_per_provider}: {exc}",
                    traceback_str=traceback.format_exc()
                )
                logger.error(
                    f"LLM call failed [{active_provider}] attempt {attempt + 1}/{max_retries_per_provider}: {exc}"
                )

                if attempt < max_retries_per_provider - 1:
                    wait = _extract_rate_limit_wait(exc)
                    if wait > 0:
                        # RATE-LIMIT FIX: honor the provider's "try again in Xs"
                        # hint instead of a fixed 1-2s backoff that retries too
                        # early and burns the second attempt immediately.
                        logger.warning(
                            f"Rate-limited [{active_provider}] — waiting {wait:.1f}s before retry"
                        )
                        time.sleep(wait)
                    else:
                        time.sleep(1 * (attempt + 1))

        # Trip the circuit breaker for this specific provider since all attempts failed
        # (unless it was already long-disabled by a permanent auth/billing failure)
        if not permanent_failure:
            cb["fails"] += 1
            trips = cb["fails"]
            disable_secs = min(_CB_BASE_DISABLE_SECS * (2 ** (trips - 1)), 120)  # exponential, cap 120s
            cb["disabled_until"] = time.time() + disable_secs
            logger.error(
                f"Circuit breaker TRIPPED for [{active_provider}] "
                f"(fail #{trips}, disabled {disable_secs}s) — allowing other agents to bypass."
            )

        # Advance to the next provider in the chain
        current_idx += 1
        if current_idx < len(actual_fallback_chain):
            next_provider = actual_fallback_chain[current_idx]
            logger.warning(f"Falling back: {active_provider} → {next_provider}")
            increment_fallback(active_provider, next_provider)

    return None


def escape_json_string_control_chars(s: str) -> str:
    """
    Escapes unescaped ASCII control characters (0-31) and invalid backslashes
    inside JSON string literals (e.g. LaTeX equations generated by LLMs).
    """
    result = []
    in_string = False
    i = 0
    n = len(s)
    
    while i < n:
        char = s[i]
        if char == '"':
            # Check if this quote is escaped
            is_escaped = False
            backslashes = 0
            j = len(result) - 1
            while j >= 0 and result[j] == '\\':
                backslashes += 1
                j -= 1
            if backslashes % 2 == 1:
                is_escaped = True
            
            if not is_escaped:
                in_string = not in_string
            result.append(char)
            i += 1
        elif char == '\\' and in_string:
            # Check the escape sequence
            if i + 1 < n:
                next_char = s[i + 1]
                if next_char in ['"', '\\', '/', 'b', 'f', 'n', 'r', 't']:
                    # Valid simple escape
                    result.append('\\')
                    result.append(next_char)
                    i += 2
                elif next_char == 'u' and i + 5 < n and all(c in '0123456789abcdefABCDEF' for c in s[i+2:i+6]):
                    # Valid unicode escape
                    result.append('\\')
                    result.append('u')
                    for k in range(4):
                        result.append(s[i + 2 + k])
                    i += 6
                else:
                    # Invalid escape sequence! Double the backslash.
                    result.append('\\\\')
                    i += 1
            else:
                # Trailing backslash
                result.append('\\\\')
                i += 1
        else:
            if in_string and ord(char) < 32:
                if char == '\n':
                    result.append('\\n')
                elif char == '\t':
                    result.append('\\t')
                elif char == '\r':
                    result.append('\\r')
                else:
                    result.append(f"\\u{ord(char):04x}")
            else:
                result.append(char)
            i += 1
            
    return "".join(result)


def parse_json(text: Any) -> Optional[Any]:
    """
    Robustly extract a JSON object or array from an LLM response string.
    Handles markdown code fences and partial JSON.
    """
    if not text:
        return None
    if isinstance(text, (dict, list)):
        return text

    import re

    clean = text.strip()

    # Strip markdown code fence ONLY if it wraps the entire response (outermost)
    if clean.startswith("```"):
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", clean, re.DOTALL)
        if match:
            clean = match.group(1).strip()
    else:
        # Find outermost [ ] or { }
        s_bracket, s_brace = clean.find("["), clean.find("{")
        if s_bracket != -1 and (s_brace == -1 or s_bracket < s_brace):
            start, end = s_bracket, clean.rfind("]")
        else:
            start, end = s_brace, clean.rfind("}")
        if start != -1 and end > start:
            clean = clean[start : end + 1].strip()

    clean = escape_json_string_control_chars(clean)
    try:
        return json.loads(clean)
    except Exception as exc:
        import traceback
        from app.core.observability import track_error
        track_error(
            f"JSON parse failed for response: {str(text)[:200]}...",
            traceback_str=traceback.format_exc()
        )
        logger.error(f"JSON parse failed for: {text[:200]}…")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_fallback_chain(provider: str) -> list[str]:
    chains = {
        "siliconflow": ["siliconflow"],
        "groq":     ["groq", "gemini", "nvidia"],
        "gemini":   ["gemini", "groq", "nvidia"],
        "google":   ["google", "groq", "nvidia"],
        "nvidia":   ["nvidia", "groq", "gemini"],
    }
    return chains.get(provider, ["groq", "gemini", "nvidia"])


def _next_in_chain(current: str, chain: list[str]) -> Optional[str]:
    try:
        idx = chain.index(current)
        return chain[idx + 1] if idx + 1 < len(chain) else None
    except ValueError:
        return None


def _reset_circuit_breaker(provider: Optional[str] = None) -> None:
    if provider:
        cb = _get_circuit_breaker(provider)
        cb["fails"] = 0
        cb["disabled_until"] = 0.0
    else:
        _CIRCUIT_BREAKERS.clear()
    _CIRCUIT_BREAKER["fails"] = 0


def _dispatch(
    provider: str,
    system_prompt: str,
    user_content: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    json_mode: bool = False,
) -> tuple[str, int, int]:
    """
    Route to the correct provider and return (raw_response_text, input_tokens, output_tokens).
    
    Each provider now receives the per-agent model name passed from LLMConfigManager.
    If model is None, the provider's own default (from settings) is used.
    """
    actual_model = model  # This is now set by LLMConfigManager per agent!
    if provider == "siliconflow":
        return _call_siliconflow(system_prompt, user_content, actual_model, temperature=temperature, json_mode=json_mode)
    if provider == "nvidia":
        return _call_nvidia(system_prompt, user_content, actual_model, temperature=temperature, json_mode=json_mode)
    elif provider == "groq":
        return _call_groq(system_prompt, user_content, actual_model, temperature=temperature, json_mode=json_mode)
    return _call_gemini(system_prompt, user_content, actual_model, temperature=temperature, json_mode=json_mode)


def _call_nvidia(
    system_prompt: str,
    user_content: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    json_mode: bool = False,
) -> tuple[str, int, int]:
    safe_prompt = system_prompt if "json" in system_prompt.lower() else system_prompt + "\n\nYou must output in JSON format."
    model_name = model or settings.NVIDIA_MODEL
    temp = temperature if temperature is not None else 0.7
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": safe_prompt},
            {"role": "user",   "content": user_content},
        ],
        "temperature": temp,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    with httpx.Client() as client:
        resp = client.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=90.0,
        )
    if resp.status_code != 200:
        if resp.status_code in (401, 402, 403):
            raise ProviderAuthError(f"NVIDIA NIM API {resp.status_code}: {resp.text}")
        raise ValueError(f"NVIDIA NIM API {resp.status_code}: {resp.text}")
    resp_json = resp.json()
    usage = resp_json.get("usage", {})
    in_t = usage.get("prompt_tokens", 0)
    out_t = usage.get("completion_tokens", 0)
    return resp_json["choices"][0]["message"]["content"], in_t, out_t


def _call_groq(
    system_prompt: str,
    user_content: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    json_mode: bool = False,
) -> tuple[str, int, int]:
    safe_prompt = system_prompt if "json" in system_prompt.lower() else system_prompt + "\n\nYou must output in JSON format."
    model_name = model or settings.GROQ_MODEL
    temp = temperature if temperature is not None else 0.7
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": safe_prompt},
            {"role": "user",   "content": user_content},
        ],
        "temperature": temp,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    with httpx.Client() as client:
        resp = client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )
    if resp.status_code != 200:
        if resp.status_code in (401, 402, 403):
            raise ProviderAuthError(f"Groq API {resp.status_code}: {resp.text}")
        raise ValueError(f"Groq API {resp.status_code}: {resp.text}")
    resp_json = resp.json()
    usage = resp_json.get("usage", {})
    in_t = usage.get("prompt_tokens", 0)
    out_t = usage.get("completion_tokens", 0)
    return resp_json["choices"][0]["message"]["content"], in_t, out_t


def _call_siliconflow(
    system_prompt: str,
    user_content: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    json_mode: bool = False,
) -> tuple[str, int, int]:
    safe_prompt = system_prompt if "json" in system_prompt.lower() else system_prompt + "\n\nYou must output in JSON format."
    payload = {
        "model": model or settings.SILICONFLOW_MODEL,
        "messages": [
            {"role": "system", "content": safe_prompt if json_mode else system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": temperature if temperature is not None else 0.7,
        "max_tokens": 4096,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    with httpx.Client() as client:
        resp = client.post(
            f"{settings.SILICONFLOW_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.SILICONFLOW_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=90.0,
        )
    if resp.status_code != 200:
        if resp.status_code in (401, 402, 403):
            raise ProviderAuthError(f"SiliconFlow API {resp.status_code}")
        raise ValueError(f"SiliconFlow API {resp.status_code}")
    result = resp.json()
    usage = result.get("usage", {})
    return (
        result["choices"][0]["message"]["content"],
        usage.get("prompt_tokens", 0),
        usage.get("completion_tokens", 0),
    )


def _call_gemini(
    system_prompt: str,
    user_content: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    json_mode: bool = False,
) -> tuple[str, int, int]:
    safe_prompt = system_prompt if "json" in system_prompt.lower() else system_prompt + "\n\nYou must output in JSON format."
    model_name = model or settings.GOOGLE_MODEL
    temp = temperature if temperature is not None else 0.7
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": safe_prompt},
            {"role": "user",   "content": user_content},
        ],
        "temperature": temp,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    with httpx.Client() as client:
        resp = client.post(
            f"{settings.GOOGLE_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GOOGLE_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )
    if resp.status_code != 200:
        if resp.status_code in (401, 402, 403):
            raise ProviderAuthError(f"Gemini API {resp.status_code}: {resp.text}")
        raise ValueError(f"Gemini API {resp.status_code}: {resp.text}")
    resp_json = resp.json()
    usage = resp_json.get("usage", {})
    in_t = usage.get("prompt_tokens", 0)
    out_t = usage.get("completion_tokens", 0)
    return resp_json["choices"][0]["message"]["content"], in_t, out_t



def _normalize_llm_output(data: dict, model_name: str) -> dict:
    """
    Normalize common LLM output format mismatches before Pydantic validation.
    LLMs often return slightly different field names or structures than expected.
    """
    if not isinstance(data, dict):
        return data

    # ── MarketIntelligenceModel fixes ──
    if "top_skills_freq" in data:
        val = data["top_skills_freq"]
        # LLM returns dict {skill_name: frequency} instead of list [{skill, frequency}]
        if isinstance(val, dict):
            data["top_skills_freq"] = [
                {"skill": k, "frequency": v} for k, v in val.items()
            ]
        # Also normalize list items that might use wrong keys
        elif isinstance(val, list):
            normalized = []
            for item in val:
                if isinstance(item, dict):
                    skill = item.get("skill") or item.get("name") or item.get("technology") or item.get("skill_name") or ""
                    freq = item.get("frequency") or item.get("freq") or item.get("score") or item.get("demand") or 50
                    if isinstance(freq, str) and freq.isdigit():
                        freq = int(freq)
                    normalized.append({"skill": str(skill), "frequency": int(freq) if isinstance(freq, (int, float)) else 50})
            data["top_skills_freq"] = normalized

    if "hiring_companies" in data and isinstance(data["hiring_companies"], list):
        normalized = []
        for item in data["hiring_companies"]:
            if isinstance(item, dict):
                name = item.get("name") or item.get("company") or item.get("company_name") or item.get("employer") or ""
                vol = item.get("hiring_volume") or item.get("status") or item.get("volume") or item.get("openings") or "Active openings"
                normalized.append({"name": str(name), "hiring_volume": str(vol)})
        data["hiring_companies"] = normalized

    # ── SalaryRangeModel fixes ──
    if "salary_range" in data and isinstance(data["salary_range"], dict):
        sr = data["salary_range"]
        if "formatted" not in sr or not sr["formatted"]:
            mn, mx, cur = sr.get("min"), sr.get("max"), sr.get("currency", "")
            if mn and mx:
                sr["formatted"] = f"{cur}{mn:,.0f} – {cur}{mx:,.0f} per annum"

    # ── LinkedInStrategyModel fixes ──
    if "headlines" in data and isinstance(data["headlines"], str):
        data["headlines"] = [h.strip() for h in data["headlines"].split("\n") if h.strip()]

    return data


def _parse_structured(response_text: str, response_model: Type[BaseModel]) -> dict:
    """Extract JSON from response_text and validate against response_model."""
    import re

    clean = response_text.strip()

    match = re.search(r"```(?:json)?\s*(.*?)\s*```", clean, re.DOTALL)
    if match:
        clean = match.group(1).strip()
    else:
        s_bracket, s_brace = clean.find("["), clean.find("{")
        if s_bracket != -1 and (s_brace == -1 or s_bracket < s_brace):
            start, end = s_bracket, clean.rfind("]")
        else:
            start, end = s_brace, clean.rfind("}")
        if start != -1 and end > start:
            clean = clean[start : end + 1].strip()

    clean = escape_json_string_control_chars(clean)

    # Parse JSON first, then normalize before validation
    import json
    try:
        raw = json.loads(clean)
    except Exception:
        raw = None

    if isinstance(raw, dict):
        raw = _normalize_llm_output(raw, model_name=response_model.__name__)

        # Re-serialize for Pydantic validation
        clean = json.dumps(raw, ensure_ascii=False)

    parsed = response_model.model_validate_json(clean)
    return parsed.model_dump()
