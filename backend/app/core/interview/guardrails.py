"""
Interview Guardrails — enforce the output contract between the LLM and the candidate.

Previously "ask exactly one question, no markdown, keep it short" were prompt
suggestions only. This module makes them checkable rules with a template
fallback so a bad model turn never reaches the candidate silently.
"""
from __future__ import annotations

import re

# ── Phase-indexed template fallbacks (generic, category-agnostic) ───────────
FALLBACK_QUESTIONS: dict[int, str] = {
    1: "Thanks for joining today. To start, could you tell me a bit about yourself and your background?",
    2: "Let's move into core concepts. Can you explain the fundamental principles behind this topic and how you apply them in practice?",
    3: "Let's dive a bit deeper into that. What are the key edge cases, concurrency concerns, or trade-offs you have to watch out for?",
    4: "Let's work on a hands-on technical challenge. Walk me through your approach and code logic step by step.",
    5: "Looking at that solution, how would you analyze its time and space complexity, and how could you optimize it for high scale?",
    6: "Tell me about one of your key projects: what was its technical architecture, and what was the most difficult bottleneck you solved?",
    7: "Let's do a Low-Level Design (LLD). How would you structure the API endpoints, database schemas, and core classes for this component?",
    8: "Let's zoom out to System Architecture and Scale. How would you handle millions of concurrent users, failover, and data consistency?",
    9: "Let's examine a real-world problem tailored to our company's domain. How would you architect a solution within our specific technical constraints?",
    10: "That covers all my questions for today. Before we wrap up — do you have any questions for me?",
    11: "Thank you for your time today. I will now evaluate your performance and prepare your final evaluation report.",
}
FALLBACK_QUESTIONS_ZH: dict[int, str] = {
    1: "欢迎参加面试。请先介绍一下你的背景和相关经历？",
    2: "请说明这个岗位最重要的基础知识，以及你如何在实际工作中运用？",
    3: "针对刚才的主题，你会重点考虑哪些边界情况、并发问题和设计取舍？",
    4: "请结合一个具体技术问题，逐步说明你的解题思路和代码实现？",
    5: "你会怎样分析刚才方案的时间和空间复杂度，并在高并发场景下优化？",
    6: "请介绍一个你参与的项目：它的技术架构是什么，你解决了什么关键难题？",
    7: "如果要设计这个模块，你会如何组织接口、数据库结构和核心类？",
    8: "如果系统需要支持大量并发用户，你会如何处理故障切换和数据一致性？",
    9: "结合目标公司的业务场景和技术约束，你会如何设计解决方案？",
    10: "我的问题问完了。你还有什么想了解这个岗位或团队的吗？",
    11: "感谢参加面试。我会整理你的表现并生成评估报告。",
}

# Markdown / list / role-play signals that must never reach the candidate
_MARKDOWN_PATTERN = re.compile(r"(\*\*|##|```|`|^\s*[-•*]\s|\d+\.\s)", re.MULTILINE)
_EMOJI_PATTERN = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF]"
)
_ROLEPLAY_PATTERN = re.compile(
    r"\b(as (the|the candidate|you are)|i'll (play|be) .?(the candidate|candidate)|let's switch|pretend to be (you|me))\b",
    re.IGNORECASE,
)


def strip_markdown(text: str) -> str:
    """Light sanitizer for TTS/display — returns text without markdown markers."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"_(.*?)_", r"\1", text)
    text = re.sub(r"`{1,3}", "", text)
    text = re.sub(r"^\s*[-•*]\s+", "", text, flags=re.MULTILINE)
    return text.strip()


def count_questions(text: str) -> int:
    """Number of question marks — our proxy for single-question enforcement."""
    return text.count("?") + text.count("？")


def contains_markdown(text: str) -> bool:
    return bool(_MARKDOWN_PATTERN.search(text))


def contains_emoji(text: str) -> bool:
    return bool(_EMOJI_PATTERN.search(text))


def contains_roleplay(text: str) -> bool:
    return bool(_ROLEPLAY_PATTERN.search(text))


def validate_interviewer_text(text: str, max_words: int = 200) -> tuple[bool, list[str]]:
    """Validate interviewer output. Returns (ok, reasons) — never raises.

    Contract:
      - contains a question (ends the turn with it)
      - no markdown / emoji / list formatting
      - not too long
      - not role-playing as the candidate
    """
    if not text or not text.strip():
        return False, ["empty response"]

    reasons: list[str] = []
    text = text.strip()

    if count_questions(text) == 0:
        reasons.append("no question found")
    elif count_questions(text) > 2:
        reasons.append(f"multiple questions ({count_questions(text)})")

    if contains_markdown(text):
        reasons.append("markdown / list formatting detected")
    if contains_emoji(text):
        reasons.append("emoji detected")
    if contains_roleplay(text):
        reasons.append("role-play detected")

    words = len(text.split())
    if words > max_words:
        reasons.append(f"too long ({words} words > {max_words})")

    # The closing/feedback phases legitimately contain no question.
    return (len(reasons) == 0 or "no question found" == reasons[0] and _allows_statement(text)), reasons


def _allows_statement(text: str) -> bool:
    """Phase 7/8 turns may be statements ('Do you have any questions?' is still
    a question; the closing 'thank you' is not). Heuristic: short and polite."""
    words = len(text.split())
    return words <= 50 and not contains_markdown(text) and not contains_emoji(text)


def validate_question_turn(text: str) -> tuple[bool, list[str]]:
    """Strict validator for question-generating turns (the common case)."""
    reasons: list[str] = []
    if not text or not text.strip():
        return False, ["empty response"]
    text = text.strip()
    if count_questions(text) == 0:
        reasons.append("no question found")
    elif count_questions(text) > 2:
        reasons.append(f"multiple questions ({count_questions(text)})")
    if contains_markdown(text):
        reasons.append("markdown / list formatting detected")
    if contains_emoji(text):
        reasons.append("emoji detected")
    if contains_roleplay(text):
        reasons.append("role-play detected")
    if len(text.split()) > 200:
        reasons.append("too long (>200 words)")
    return len(reasons) == 0, reasons


def validate_clean_spoken_turn(text: str, max_words: int = 220) -> tuple[bool, list[str]]:
    """Lenient validator for the intro turn.

    Phase 1 ('Tell me about yourself') is legitimately an imperative, not a
    question, so question-presence is NOT enforced here — only formatting
    cleanliness and length. Also caps multiple questions to prevent the model
    bundling several prompts into the introduction.
    """
    reasons: list[str] = []
    if not text or not text.strip():
        return False, ["empty response"]
    text = text.strip()
    if contains_markdown(text):
        reasons.append("markdown / list formatting detected")
    if contains_emoji(text):
        reasons.append("emoji detected")
    if contains_roleplay(text):
        reasons.append("role-play detected")
    if count_questions(text) > 2:
        reasons.append(f"multiple questions ({count_questions(text)})")
    if len(text.split()) > max_words:
        reasons.append(f"too long ({len(text.split())} words > {max_words})")
    return len(reasons) == 0, reasons


def build_fallback_question(phase: int, language: str = "en") -> str:
    """Guaranteed-safe question for a phase when regeneration fails."""
    questions = FALLBACK_QUESTIONS_ZH if language == "zh" else FALLBACK_QUESTIONS
    return questions.get(phase, questions[2])
