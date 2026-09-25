import asyncio
import re
import time
from types import SimpleNamespace
from loguru import logger
from starlette.websockets import WebSocket, WebSocketState
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.voice.voice_engine import generate_audio_base64
from app.core.observability import track_llm_call
from app.core.llm_config import LLMConfigManager


def _get_openai_client(provider: str = "groq"):
    """Get an OpenAI-compatible client for the requested provider."""
    if provider == "siliconflow":
        return AsyncOpenAI(
            api_key=settings.SILICONFLOW_API_KEY,
            base_url=settings.SILICONFLOW_API_BASE,
        )
    if provider == "nvidia":
        return AsyncOpenAI(
            api_key=settings.NVIDIA_API_KEY,
            base_url="https://integrate.api.nvidia.com/v1",
        )
    elif provider in ("gemini", "google"):
        return AsyncOpenAI(
            api_key=settings.GOOGLE_API_KEY,
            base_url=settings.GOOGLE_API_BASE,
        )
    return AsyncOpenAI(
        api_key=settings.GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )


# ── Provider rate-limit cooldowns (per-process, module-level) ────────────────
_provider_cooldowns: dict[str, float] = {}


def _is_under_cooldown(provider: str) -> bool:
    """True if a provider is resting due to a recent 429 rate-limit hit."""
    return time.time() < _provider_cooldowns.get(provider, 0.0)


def _apply_provider_cooldown(provider: str, seconds: float = 25.0) -> None:
    _provider_cooldowns[provider] = time.time() + seconds
    logger.warning(f"[interview] Provider {provider} placed under {seconds}s cooldown (rate limit).")


def _extract_rate_limit_wait_secs(exc: Exception) -> float:
    """Parse the provider's 'try again in Xs' hint from a 429 response."""
    import re
    msg = str(exc)
    if "429" not in msg and "rate" not in msg.lower():
        return 0.0
    match = re.search(r"try again in\s*([0-9.]+)\s*s", msg)
    if match:
        return min(float(match.group(1)) + 0.5, 30.0)
    return 15.0 if "429" in msg else 0.0


def _select_fallback_chain(provider: str, config_fallback: list[str]) -> list[str]:
    """Order a provider-first fallback chain, skipping providers under cooldown."""
    if settings.LLM_PROVIDER == "siliconflow":
        return ["siliconflow"]
    if provider and provider not in config_fallback:
        chain = [provider] + config_fallback
    elif provider:
        chain = [provider] + [p for p in config_fallback if p != provider]
    else:
        chain = config_fallback
    return [p for p in chain if not _is_under_cooldown(p)] or chain


async def _safe_send_json_local(ws: WebSocket, payload: dict) -> bool:
    """Send JSON payload safely without throwing exceptions on closed sockets."""
    try:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        await ws.send_json(payload)
        return True
    except Exception as e:
        logger.warning(f"Local WS send failed in LLM module: {e}")
        return False


async def _single_text_chunk(text: str):
    """Feed a completed response through the normal WS/TTS turn handling."""
    yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])


async def _stream_llm_response(messages: list[dict], ws: WebSocket, system_prompt: str, provider: str = "groq", tts_queue: asyncio.Queue | None = None) -> str:
    """
    Stream LLM response word-by-word over WebSocket for real-time feel.
    INCREMENTAL TTS: Buffers sentences and streams audio concurrently.
    
    Uses LLMConfigManager for per-agent provider/model selection.
    Uses AsyncOpenAI client to avoid blocking the event loop.
    """
    # ── Get interview agent config from centralized manager ──
    interview_config = LLMConfigManager.get_agent_config("interview")
    config_fallback = interview_config["fallback_chain"]
    
    # Prioritize the passed provider parameter if provided
    fallback_chain = _select_fallback_chain(provider, config_fallback)
    
    stream = None
    last_err = None
    active_provider = None
    start_time = 0.0

    for provider_name in fallback_chain:
        try:
            client = _get_openai_client(provider_name)
            if provider_name == "nvidia":
                model_name = settings.NVIDIA_MODEL
            elif provider_name in ("gemini", "google"):
                model_name = settings.GOOGLE_MODEL
            elif provider_name == "siliconflow":
                model_name = settings.SILICONFLOW_MODEL
            else:
                model_name = LLMConfigManager.get_model_for_agent("interview")
            
            full_msgs = [{"role": "system", "content": system_prompt}] + messages

            start_time = time.time()
            # Use async client — does NOT block the event loop
            request = {
                "model": model_name,
                "messages": full_msgs,
                "temperature": LLMConfigManager.get_temperature_for_agent("interview"),
                "max_tokens": 800,
            }
            if provider_name == "siliconflow":
                # The current free model can exhaust a short turn on hidden
                # reasoning, and its SSE stream may stall. A bounded complete
                # response is more reliable for a single interview question.
                completion = await asyncio.wait_for(
                    client.chat.completions.create(
                        **request, stream=False,
                        extra_body={"enable_thinking": False},
                    ),
                    timeout=40,
                )
                answer = completion.choices[0].message.content or "" if completion.choices else ""
                stream = _single_text_chunk(answer)
            else:
                stream = await client.chat.completions.create(**request, stream=True)
            active_provider = provider_name
            logger.info(f"Interview response initiated with provider={active_provider}, model={model_name}")
            break
        except Exception as e:
            logger.warning(f"Interview stream failed for provider {provider_name}: {e}")
            last_err = e

    if stream is None:
        logger.error(f"All providers failed to stream LLM response. Last error: {last_err}")
        if last_err:
            raise last_err
        raise RuntimeError("All providers failed to stream LLM response.")


    full_response = ""
    chunk_buffer = ""
    sentence_buffer = ""
    tts_paragraph_buffer = ""  # Accumulate multiple sentences for smoother TTS
    tts_sentence_count = 0
    TTS_BATCH_SENTENCES = 2    # Batch 2 sentences per TTS call for faster audio delivery
    TTS_BATCH_MIN_CHARS = 80   # Or flush when buffer exceeds this
    CHUNK_SIZE = 8

    # Use external persistent queue if provided, otherwise create local one
    own_queue = tts_queue is None
    if own_queue:
        tts_queue = asyncio.Queue()
    
    # Only create workers if we own the queue (backward compat)
    worker_tasks = []
    if own_queue:
        async def _local_tts_worker():
            while True:
                try:
                    paragraph = await asyncio.wait_for(tts_queue.get(), timeout=120)
                except asyncio.TimeoutError:
                    break
                if paragraph is None:
                    tts_queue.task_done()
                    break
                if paragraph.strip():
                    try:
                        audio_result = await generate_audio_base64(paragraph)
                        if audio_result and audio_result.get("audio"):
                            await _safe_send_json_local(ws, {
                                "role": "interviewer", 
                                "audio": audio_result["audio"], 
                                "fragment": True
                            })
                    except Exception as e:
                        logger.error(f"Incremental TTS failed: {e}")
                tts_queue.task_done()
        worker_tasks = [asyncio.create_task(_local_tts_worker())]

    try:
        # Async iteration — does NOT block the event loop
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content:
                full_response += delta.content
                chunk_buffer += delta.content
                sentence_buffer += delta.content

                # Stream text in word chunks
                words = chunk_buffer.split(" ")
                if len(words) >= CHUNK_SIZE or len(chunk_buffer) >= 24:
                    text_to_send = " ".join(words[:CHUNK_SIZE]) if len(words) >= CHUNK_SIZE else chunk_buffer
                    if not await _safe_send_json_local(ws, {"role": "interviewer_stream", "content": text_to_send}):
                        break
                    chunk_buffer = " ".join(words[CHUNK_SIZE:]) if len(words) >= CHUNK_SIZE else ""
                
                # Sentence buffering for TTS — accumulate multiple sentences
                if any(p in sentence_buffer for p in ['. ', '? ', '! ', '\n']):
                    match = re.search(r'([.?!]\s+|\n+)', sentence_buffer)
                    if match:
                        idx = match.end()
                        sentence = sentence_buffer[:idx].strip()
                        sentence_buffer = sentence_buffer[idx:]
                        if len(sentence) > 2:
                            tts_paragraph_buffer += " " + sentence if tts_paragraph_buffer else sentence
                            tts_sentence_count += 1
                        
                        # Flush TTS batch when enough sentences or chars accumulated
                        if tts_sentence_count >= TTS_BATCH_SENTENCES or len(tts_paragraph_buffer) >= TTS_BATCH_MIN_CHARS:
                            await tts_queue.put(tts_paragraph_buffer.strip())
                            tts_paragraph_buffer = ""
                            tts_sentence_count = 0

        # Flush remaining text
        if chunk_buffer.strip():
            await _safe_send_json_local(ws, {"role": "interviewer_stream", "content": chunk_buffer})
        
        # Flush remaining sentence buffer into paragraph buffer
        if sentence_buffer.strip():
            tts_paragraph_buffer += " " + sentence_buffer.strip() if tts_paragraph_buffer else sentence_buffer.strip()
        
        # Flush remaining paragraph buffer
        if tts_paragraph_buffer.strip():
            await tts_queue.put(tts_paragraph_buffer.strip())

        # Wait for ALL queued TTS work to finish before returning
        if own_queue:
            # For local queue: wait for items, then stop workers
            await tts_queue.join()
            for _ in worker_tasks:
                try:
                    await tts_queue.put(None)
                except Exception:
                    pass
            try:
                await asyncio.wait_for(asyncio.gather(*worker_tasks), timeout=120)
            except (asyncio.TimeoutError, Exception):
                for task in worker_tasks:
                    if not task.done():
                        task.cancel()
        # External queues have their own persistent worker. Audio can finish
        # after the text turn; waiting here delays the question and may cause
        # the browser to abandon the WebSocket before the turn is committed.
    finally:
        # If local queue, ensure workers are cleaned up (should already be done above)
        pass

    # Track metrics
    if active_provider and start_time > 0:
        latency = time.time() - start_time
        input_chars = len(system_prompt) + sum(len(msg.get("content", "")) for msg in messages)
        input_tokens = max(1, input_chars // 4)
        output_tokens = max(1, len(full_response) // 4)
        try:
            track_llm_call(active_provider, latency, input_tokens, output_tokens)
        except Exception as e:
            logger.warning(f"Failed to track LLM call: {e}")

    return full_response.strip()


async def _generate_json_non_stream(
    messages: list[dict],
    system_prompt: str,
    agent_name: str = "interview_evaluator",
    provider: str = "groq",
    max_tokens: int = 512,
) -> dict | None:
    """
    Provider-fallback, non-streaming JSON call for evaluator/feedback.

    Returns a parsed dict on success, None when all providers fail. Applies
    per-provider rate-limit cooldowns so follow-up calls bypass the exhausted
    provider.
    """
    agent_config = LLMConfigManager.get_agent_config(agent_name)
    config_fallback = agent_config["fallback_chain"]

    chain = _select_fallback_chain(provider, config_fallback)

    last_err: Exception | None = None

    for provider_name in chain:
        if _is_under_cooldown(provider_name):
            continue
        try:
            client = _get_openai_client(provider_name)
            if provider_name == "nvidia":
                model_name = settings.NVIDIA_MODEL
            elif provider_name in ("gemini", "google"):
                model_name = settings.GOOGLE_MODEL
            elif provider_name == "siliconflow":
                model_name = settings.SILICONFLOW_MODEL
            else:
                model_name = agent_config["model"]

            start_time = time.time()
            resp = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": "system", "content": system_prompt}] + messages,
                response_format={"type": "json_object"},
                temperature=config_fallback[0] and agent_config["temperature"] or 0.2,
                max_tokens=max_tokens,
            )
            content = (resp.choices[0].message.content or "").strip()
            latency = time.time() - start_time
            input_chars = len(system_prompt) + sum(len(m.get("content", "")) for m in messages)
            input_tokens = max(1, input_chars // 4)
            output_tokens = max(1, len(content) // 4)
            try:
                track_llm_call(provider_name, latency, input_tokens, output_tokens)
            except Exception as e:
                logger.warning(f"Failed to track generate_json call: {e}")

            if not content:
                raise ValueError("JSON generator returned empty content")

            import json
            text = content.strip()
            import re as _re2
            m = _re2.search(r"```(?:json)?\s*(.*?)\s*```", text, _re2.DOTALL)
            if m:
                text = m.group(1).strip()
            start_t, end_t = text.find("{"), text.rfind("}")
            if start_t != -1 and end_t > start_t:
                text = text[start_t : end_t + 1]
            parsed = json.loads(text)
            return parsed
        except Exception as e:
            msg_lower = str(e).lower()
            if "429" in msg_lower or "rate" in msg_lower:
                wait = _extract_rate_limit_wait_secs(e) or 15.0
                _apply_provider_cooldown(provider_name, wait)
            logger.warning(f"[interview] generate_json failed {provider_name}: {e}")
            last_err = e

    if last_err:
        logger.error(f"[interview] All providers failed for JSON generator: {last_err}")
    return None


async def _generate_interview_text_non_stream(messages: list[dict], system_prompt: str, provider: str = "groq", max_tokens: int = 300) -> str:
    """
    Non-streaming interviewer generation — used for regeneration after guardrail
    rejection. Nothing is pushed to the websocket here, so a bad first draft can
    be replaced before the client ever sees the final frame.
    """
    interview_config = LLMConfigManager.get_agent_config("interview")
    config_fallback = interview_config["fallback_chain"]

    fallback_chain = _select_fallback_chain(provider, config_fallback)

    last_err = None
    active_provider = None
    start_time = time.time()

    for provider_name in fallback_chain:
        if _is_under_cooldown(provider_name):
            continue
        try:
            client = _get_openai_client(provider_name)
            if provider_name == "nvidia":
                model_name = settings.NVIDIA_MODEL
            elif provider_name in ("gemini", "google"):
                model_name = settings.GOOGLE_MODEL
            elif provider_name == "siliconflow":
                model_name = settings.SILICONFLOW_MODEL
            else:
                model_name = interview_config["model"]

            full_msgs = [{"role": "system", "content": system_prompt}] + messages
            resp = await client.chat.completions.create(
                model=model_name,
                messages=full_msgs,
                temperature=interview_config["temperature"],
                max_tokens=max_tokens,
            )
            content = (resp.choices[0].message.content or "").strip()
            active_provider = provider_name
            if content:
                latency = time.time() - start_time
                input_tokens = max(1, (len(system_prompt) + sum(len(m.get("content", "")) for m in messages)) // 4)
                output_tokens = max(1, len(content) // 4)
                try:
                    track_llm_call(active_provider, latency, input_tokens, output_tokens)
                except Exception as e:
                    logger.warning(f"Failed to track non-stream interview call: {e}")
                return content

            last_err = ValueError("Empty regeneration content")
        except Exception as e:
            msg_lower = str(e).lower()
            if "429" in msg_lower or "rate" in msg_lower:
                wait = _extract_rate_limit_wait_secs(e) or 15.0
                _apply_provider_cooldown(provider_name, wait)
            logger.warning(f"[interview] Non-stream interview failed for {provider_name}: {e}")
            last_err = e

    if last_err:
        raise last_err
    raise RuntimeError("All providers failed to regenerate interviewer text.")


async def _generate_feedback_non_stream(messages: list[dict], system_prompt: str, provider: str = "groq") -> str:
    """
    Generate feedback non-streamingly to avoid showing streaming text on the client
    or generating audio synthesis for the detailed report.
    """
    interview_config = LLMConfigManager.get_agent_config("interview_feedback")
    config_fallback = interview_config["fallback_chain"]
    
    fallback_chain = _select_fallback_chain(provider, config_fallback)

    last_err = None
    active_provider = None
    start_time = time.time()
    feedback_content = ""

    for provider_name in fallback_chain:
        # Determine candidate models for this provider
        if provider_name == "nvidia":
            models_to_try = [settings.NVIDIA_MODEL]
        elif provider_name in ("gemini", "google"):
            models_to_try = [settings.GOOGLE_MODEL]
        elif provider_name == "siliconflow":
            models_to_try = [settings.SILICONFLOW_MODEL]
        elif provider_name == "groq":
            # Try GPT-OSS 120B first, fallback to GPT-OSS 20B
            models_to_try = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
        else:
            models_to_try = [LLMConfigManager.get_model_for_agent("interview_feedback")]

        for model_name in models_to_try:
            try:
                client = _get_openai_client(provider_name)
                full_msgs = [{"role": "system", "content": system_prompt}] + messages
                
                resp = await client.chat.completions.create(
                    model=model_name,
                    messages=full_msgs,
                    temperature=interview_config["temperature"],
                    max_tokens=1024,
                )
                feedback_content = resp.choices[0].message.content or ""
                active_provider = provider_name
                logger.info(f"Feedback successfully generated using provider={provider_name}, model={model_name}")
                break
            except Exception as e:
                logger.warning(f"Feedback generation failed for provider {provider_name} ({model_name}): {e}")
                last_err = e
        
        if feedback_content:
            break
            
    if not feedback_content:
        if last_err:
            raise last_err
        raise RuntimeError("All providers failed to generate feedback.")

    # Track metrics
    if active_provider:
        latency = time.time() - start_time
        input_chars = len(system_prompt) + sum(len(msg.get("content", "")) for msg in messages)
        input_tokens = max(1, input_chars // 4)
        output_tokens = max(1, len(feedback_content) // 4)
        try:
            track_llm_call(active_provider, latency, input_tokens, output_tokens)
        except Exception as e:
            logger.warning(f"Failed to track non-stream LLM call: {e}")

    return feedback_content.strip()
