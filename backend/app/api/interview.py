from fastapi import APIRouter, WebSocket, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import InterviewSession
from app.api.deps import get_current_user
from app.core.interview.websocket_manager import handle_websocket_connection

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    role: str = "Software Engineer",
    company: str = "A top tech company",
    company_style: str | None = None,
    company_tier: str | None = "other",
    token: str | None = None,
    type: str = "technical",
    provider: str = Query("groq"),
    role_level: str = Query("fresher"),
    language: str = Query("en")
):
    """Establishes the WebSocket connection and delegates execution to core manager."""
    await handle_websocket_connection(
        websocket=websocket,
        session_id=session_id,
        role=role,
        company=company,
        company_style=company_style,
        company_tier=company_tier,
        token=token,
        type=type,
        provider=provider,
        role_level=role_level,
        language="zh" if language.lower().startswith("zh") else "en"
    )


@router.get("/history")
def get_interview_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch previous mock interviews for the user."""
    interviews = db.query(InterviewSession).filter(
        InterviewSession.user_id == current_user.id
    ).order_by(InterviewSession.created_at.desc()).all()

    return {
        "history": [
            {
                "id": i.id,
                "target_role": i.target_role,
                "created_at": i.created_at.isoformat(),
                "score": i.score,
                "status": i.status
            }
            for i in interviews
        ]
    }


@router.get("/{session_id}")
def get_interview_details(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch full details of a specific interview session including chat history."""
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")

    return {
        "id": session.id,
        "target_role": session.target_role,
        "score": session.score,
        "status": session.status,
        "created_at": session.created_at.isoformat(),
        "chat_history": session.chat_history or []
    }


@router.delete("/{session_id}")
def delete_interview(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific interview session."""
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")

    db.delete(session)
    db.commit()
    return {"message": "Interview deleted successfully"}
