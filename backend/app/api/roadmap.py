"""
Roadmap API — Thin route layer.
  POST /roadmap/generate → Given target_role + skill_gaps, call unified registry
                           runners (run_roadmap_structure + run_roadmap_details_batch)
                           and return a structured week-by-week learning plan.
                           Same runners used by the Full Analysis LangGraph graph.

Business logic lives in app.core.roadmap:
  - prompts.py   → System prompts
  - agents.py    → LLM agent runners
  - helpers.py   → JSON parsing, normalisation, fallback generation
  - quiz.py      → Quiz generation (LLM + fallback)
"""
import json
import asyncio

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from loguru import logger

from app.models.schemas import RoadmapRequest, RoadmapResponse, RoadmapWeek
from app.api.deps import get_current_user
from app.core.database import get_db

from sqlalchemy.orm import Session
from app.models.models import CareerRoadmap
from app.core.activity import log_activity
from app.core.rate_limit import check_daily_limit, increment_usage
from app.core.cache import get_cached_response, set_cached_response
from app.core.search_engine import enrich_weeks_with_resources

# ── Re-exports from core.roadmap (used by workflow.py and tests) ─────────────
from app.core.roadmap.agents import run_roadmap_structure, run_roadmap_details_batch  # noqa: F401
from app.core.roadmap.helpers import (                                                # noqa: F401
    parse_agent_json as _parse_agent_json,
    normalise_week as _normalise_week,
    generate_fallback_roadmap as _generate_fallback_roadmap,
    build_validated_weeks as _build_validated_weeks,
    validate_skill_gap_coverage as _validate_skill_gap_coverage,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Synchronous DB Transaction Helpers (Offloaded to Threads in Production)
# ─────────────────────────────────────────────────────────────────────────────

def _save_cached_roadmap_record(db: Session, user_id: str, target_role: str, steps_data: list):
    roadmap_record = CareerRoadmap(
        user_id=user_id,
        target_role=target_role,
        steps=steps_data
    )
    db.add(roadmap_record)
    db.commit()
    db.refresh(roadmap_record)
    return roadmap_record.id

def _get_latest_resume_content(db: Session, user_id: str):
    from app.models.models import Resume
    resume = db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.uploaded_at.desc()).first()
    return resume.parsed_content if (resume and resume.parsed_content) else None

def _save_new_roadmap_record(db: Session, user_id: str, target_role: str, steps_data: list):
    roadmap_record = CareerRoadmap(
        user_id=user_id,
        target_role=target_role,
        steps=steps_data
    )
    db.add(roadmap_record)
    db.commit()
    db.refresh(roadmap_record)
    return roadmap_record.id

def _get_roadmap_history(db: Session, user_id: str):
    return db.query(CareerRoadmap).filter(CareerRoadmap.user_id == user_id).order_by(CareerRoadmap.created_at.desc()).all()

def _delete_roadmap_record(db: Session, roadmap_id: str, user_id: str) -> bool:
    roadmap = db.query(CareerRoadmap).filter(
        CareerRoadmap.id == roadmap_id,
        CareerRoadmap.user_id == user_id
    ).first()
    if not roadmap:
        return False
    db.delete(roadmap)
    db.commit()
    return True

def _toggle_week_record(db: Session, roadmap_id: str, user_id: str, week_number: int, completed: Optional[bool]):
    from sqlalchemy.orm.attributes import flag_modified
    import copy
    
    roadmap = db.query(CareerRoadmap).filter(
        CareerRoadmap.id == roadmap_id,
        CareerRoadmap.user_id == user_id
    ).first()
    if not roadmap:
        return None
        
    steps = roadmap.steps
    if isinstance(steps, str):
        steps = json.loads(steps)
        
    steps = list(steps or [])
    found = False
    for step in steps:
        if isinstance(step, dict) and step.get("week") == week_number:
            if completed is not None:
                step["completed"] = completed
            else:
                step["completed"] = not step.get("completed", False)
            found = True
            break
            
    if not found:
        return False
        
    roadmap.steps = copy.deepcopy(steps)
    flag_modified(roadmap, "steps")
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)
    return roadmap.steps



# ── POST /roadmap/generate ─────────────────────────────────────────────────────


# ── POST /roadmap/generate ─────────────────────────────────────────────────────
@router.post(
    "/generate",
    response_model=RoadmapResponse,
    summary="Generate a week-by-week career learning roadmap",
)
async def generate_roadmap(
    body: RoadmapRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RoadmapResponse:
    """
    Input  : target_role (str) + skill_gaps (list of strings)
    Process: Career_Coach AutoGen agent builds a 8-week plan
    Output : RoadmapResponse with structured weekly milestones
    """
    try:
        check_daily_limit(current_user.id, "roadmap")

        # -- Validate input ─────────────────────────────────────────────────────────
        target_role = body.target_role.strip()
        skill_gaps = [s.strip() for s in body.skill_gaps if s.strip()]

        if not target_role:
            raise HTTPException(status_code=400, detail="target_role must not be empty.")
        if not skill_gaps:
            raise HTTPException(status_code=400, detail="skill_gaps list must not be empty.")

        logger.info(
            f"roadmap/generate: role='{target_role}' | gaps={skill_gaps}"
        )

        # ── Learning Style & Experience Preferences from request ───────────────────────
        req_exp_level = getattr(body, "experience_level", "intermediate") or "intermediate"
        req_style = getattr(body, "learning_style", "balanced") or "balanced"
        req_language = "zh" if getattr(body, "language", "en") == "zh" else "en"

        # ── Retrieve latest parsed Resume for candidate profile context ──────────────────
        resume_analysis = await asyncio.to_thread(_get_latest_resume_content, db, current_user.id)
        import hashlib
        resume_hash = hashlib.sha256(json.dumps(resume_analysis, sort_keys=True).encode("utf-8")).hexdigest() if resume_analysis else "no_resume"

        # ── Cache check ────────────────────────────────────────────────────────────
        gaps_key = "-".join(sorted(skill_gaps))
        cached_weeks_dicts = get_cached_response("roadmap_v4", target_role, gaps_key, body.provider, req_exp_level, req_style, resume_hash, req_language)
        if cached_weeks_dicts:
            weeks_objs = [RoadmapWeek(**w) for w in cached_weeks_dicts]
            steps_data = []
            for w in cached_weeks_dicts:
                w["experience_level"] = req_exp_level
                steps_data.append(w)

            roadmap_id = await asyncio.to_thread(
                _save_cached_roadmap_record,
                db,
                current_user.id,
                target_role,
                steps_data
            )

            increment_usage(current_user.id, "roadmap")
            await asyncio.to_thread(
                log_activity,
                db,
                current_user.id,
                f"Generated Roadmap for {target_role} (Cached)",
                "roadmap"
            )
            return RoadmapResponse(id=roadmap_id, target_role=target_role, weeks=weeks_objs)

        structure = await asyncio.to_thread(
            run_roadmap_structure,
            target_role=target_role,
            skill_gaps=skill_gaps,
            market_trend="Stable",
            resume_analysis=resume_analysis,
            experience_level=req_exp_level,
            learning_style=req_style,
            language=req_language,
        )

        if not structure:
            logger.warning("roadmap: structure empty, using programmatic fallback")
            weeks = _generate_fallback_roadmap(target_role, skill_gaps, req_language)
        else:
            # Batch detail generation: 3 parallel chunks of 3, 3, 2 weeks
            chunk_1 = structure[0:3]
            chunk_2 = structure[3:6]
            chunk_3 = structure[6:]

            batch_results = await asyncio.gather(
                asyncio.to_thread(run_roadmap_details_batch, chunk_1, target_role, None, req_language),
                asyncio.to_thread(run_roadmap_details_batch, chunk_2, target_role, None, req_language),
                asyncio.to_thread(run_roadmap_details_batch, chunk_3, target_role, None, req_language),
            )

            # Flatten + merge with structure fields
            raw_weeks = []
            for batch in batch_results:
                raw_weeks.extend(batch)

            # Validate + normalise to exactly 8 weeks + enforce skill gap coverage
            try:
                import json as _json
                weeks = _build_validated_weeks(_json.dumps(raw_weeks))
                weeks, _repaired = _validate_skill_gap_coverage(weeks, skill_gaps)
            except (ValueError, Exception) as parse_err:
                logger.warning(f"roadmap: batch parse failed ({parse_err}), attempting repair via fallback")
                repair_structure = await asyncio.to_thread(
                    run_roadmap_structure, target_role=target_role, skill_gaps=skill_gaps, language=req_language
                )
                if repair_structure:
                    weeks = [_normalise_week(w, i) for i, w in enumerate(repair_structure[:8])]
                    while len(weeks) < 8:
                        last = weeks[-1].copy() if weeks else {}
                        last["week"] = len(weeks) + 1
                        last["topic"] = f"{target_role} 综合项目" if req_language == "zh" else f"Advanced Capstone — {target_role}"
                        last["mini_project"] = "构建并部署一个达到生产要求的组件。" if req_language == "zh" else "Build and deploy a production-grade component."
                        weeks.append(last)
                else:
                    weeks = _generate_fallback_roadmap(target_role, skill_gaps, req_language)

        logger.info(f"roadmap/generate: built {len(weeks)}-week roadmap for '{target_role}'. Enriching resources...")

        # Enrich with DDG URLs
        enriched_weeks = await asyncio.to_thread(enrich_weeks_with_resources, weeks)
        weeks_objs = [RoadmapWeek(**w) for w in enriched_weeks]

        roadmap_id = None
        # Save to DB
        try:
            steps_data = []
            for w in weeks_objs:
                w_dict = w.model_dump()
                w_dict["experience_level"] = req_exp_level
                steps_data.append(w_dict)

            roadmap_id = await asyncio.to_thread(
                _save_new_roadmap_record,
                db,
                current_user.id,
                target_role,
                steps_data
            )
        except Exception as db_err:
            logger.error(f"Failed to save roadmap to DB for user {current_user.id}: {db_err}")

        set_cached_response("roadmap_v4", [w.model_dump() for w in weeks_objs], target_role, gaps_key, body.provider, req_exp_level, req_style, resume_hash, req_language)
        await asyncio.to_thread(
            log_activity,
            db,
            current_user.id,
            f"Generated Roadmap for {target_role}",
            "roadmap"
        )
        increment_usage(current_user.id, "roadmap")

        return RoadmapResponse(id=roadmap_id, target_role=target_role, weeks=weeks_objs)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_roadmap: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while generating the roadmap.")


# ── GET /roadmap/history ───────────────────────────────────────────────────────
@router.get("/history")
async def get_roadmap_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch previous roadmaps for the user."""
    roadmaps = await asyncio.to_thread(_get_roadmap_history, db, current_user.id)

    return {
        "history": [
            {
                "id": r.id,
                "target_role": r.target_role,
                "created_at": r.created_at.isoformat(),
                "weeks": json.loads(r.steps) if isinstance(r.steps, str) else r.steps
            }
            for r in roadmaps
        ]
    }


# ── DELETE /roadmap/{roadmap_id} ───────────────────────────────────────────────
@router.delete("/{roadmap_id}")
async def delete_roadmap(
    roadmap_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific roadmap."""
    success = await asyncio.to_thread(_delete_roadmap_record, db, roadmap_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    return {"message": "Roadmap deleted successfully"}


# ── PUT /roadmap/{roadmap_id}/toggle-week/{week_number} ────────────────────────
@router.put("/{roadmap_id}/toggle-week/{week_number}")
async def toggle_week(
    roadmap_id: str,
    week_number: int,
    completed: Optional[bool] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle or explicitly set the completed status of a specific week in the roadmap.
    """
    updated_steps = await asyncio.to_thread(
        _toggle_week_record,
        db,
        roadmap_id,
        current_user.id,
        week_number,
        completed
    )

    if updated_steps is None:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    if updated_steps is False:
        raise HTTPException(status_code=404, detail=f"Week {week_number} not found in this roadmap")

    return {
        "message": f"Week {week_number} completion updated",
        "weeks": updated_steps
    }


