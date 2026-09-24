"""
Pydantic schemas — request/response models for all API endpoints.
"""
from datetime import datetime
from typing import Any, List, Optional, Dict

from pydantic import BaseModel, EmailStr


# ── Health ────────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    provider: str
    model: str


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleLogin(BaseModel):
    credential: str # The Google ID Token from the frontend


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    name: Optional[str] = None
    email: Optional[str] = None


# ── Resume ────────────────────────────────────────────────────────────────────
class ResumeAnalysisResponse(BaseModel):
    technical_skills: List[str]
    soft_skills: List[str]
    years_of_experience: float
    top_strengths: List[str]
    skill_gaps: List[str]
    ats_score: Optional[int] = 0
    ats_score_breakdown: Optional[dict] = None


# ── Roadmap ───────────────────────────────────────────────────────────────────
class RoadmapRequest(BaseModel):
    target_role: str
    skill_gaps: List[str]
    provider: Optional[str] = None
    experience_level: Optional[str] = "intermediate"
    learning_style: Optional[str] = "balanced"
    language: Optional[str] = "en"


class RoadmapWeek(BaseModel):
    week: int
    topic: str
    skill_gap_addressed: Optional[str] = None
    estimated_hours: int
    mini_project: str
    prerequisites: List[str] = []
    success_criteria: Optional[str] = None
    why_it_matters: Optional[str] = None
    youtube_resources: List[str] = []
    article_resources: List[str] = []
    github_resources: List[str] = []
    official_docs: List[str] = []
    explore_more_questions: List[str] = []
    completed: Optional[bool] = False


class RoadmapResponse(BaseModel):
    id: Optional[str] = None
    target_role: str
    weeks: List[RoadmapWeek]



# ── Market ────────────────────────────────────────────────────────────────────
class MarketTrendsResponse(BaseModel):
    role: str
    location: str
    market_trend: str
    salary_range: Any
    currency: Optional[str] = "USD"
    symbol: Optional[str] = "$"
    is_remote: Optional[bool] = False
    confidence: Optional[float] = 0.85
    market_confidence: Optional[float] = 0.85
    summary: Optional[str] = None
    market_summary: Optional[str] = None
    historical_salary: Optional[List[dict]] = []
    historical_hiring: Optional[List[dict]] = []
    top_skills: Optional[List[dict]] = []
    top_companies: Optional[List[dict]] = []
    company_hiring_stats: Optional[List[dict]] = []
    top_skills_freq: Optional[List[dict]] = []


# ── Interview ─────────────────────────────────────────────────────────────────
class InterviewStartRequest(BaseModel):
    target_role: str
    user_id: Optional[str] = None
    provider: Optional[str] = None


class InterviewMessage(BaseModel):
    role: str  # "interviewer" | "candidate"
    content: str
    timestamp: Optional[datetime] = None


class InterviewScoreCard(BaseModel):
    total_score: int  # out of 100
    feedback: str
    question_scores: List[dict]


# ── LinkedIn Optimizer (Day 12) ─────────────────────────────────────────────
class LinkedInStrategyResponse(BaseModel):
    headlines: List[str]
    about_section: str
    demanding_skills: List[str]
    certifications: List[str]

# ── Full Analysis (LangGraph Refactor) ────────────────────────────────────────
class FullAnalysisRequest(BaseModel):
    target_role: str
    resume_text: str
    location: str = "United States"
    provider: Optional[str] = None
    experience_level: Optional[str] = "intermediate"
    learning_style: Optional[str] = "balanced"


class FullAnalysisResponse(BaseModel):
    output: Dict[str, Any] # Combined Resume, Market, Roadmap, LinkedIn
    logs: List[str]
    errors: List[str]
    metadata: Dict[str, Any]
    status: str
