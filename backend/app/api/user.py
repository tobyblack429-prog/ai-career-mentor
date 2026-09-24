from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import json

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, Resume, ActivityLog, CareerRoadmap, InterviewSession

router = APIRouter()

@router.get("/stats", summary="Get user dashboard stats from DB")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    def iso_z(dt: datetime) -> str:
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return f"{dt.isoformat()}Z"
    
    # 1. Last Resume Analysis
    resumes = db.query(Resume).filter(
        Resume.user_id == current_user.id,
        Resume.parsed_content != None
    ).order_by(Resume.uploaded_at.desc()).all()
    
    last_resume = resumes[0] if resumes else None
    resume_analysis = last_resume.parsed_content if last_resume else None

    # Full career analysis logs only — used by Dashboard Career Report Depth.
    career_logs = db.query(ActivityLog).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.feature == "full_analysis"
    ).order_by(ActivityLog.created_at.desc()).all()

    analysis_history = []
    for log in career_logs:
        analysis_history.append({
            "created_at": iso_z(log.created_at),
            "action": log.action,
        })

    # 2. Roadmaps (to track primary goal progress)
    roadmaps = db.query(CareerRoadmap).filter(CareerRoadmap.user_id == current_user.id).order_by(CareerRoadmap.created_at.desc()).all()
    roadmap_history = [
        {
            "id": r.id,
            "target_role": r.target_role,
            "weeks": json.loads(r.steps) if isinstance(r.steps, str) else r.steps,
            "created_at": iso_z(r.created_at)
        }
        for r in roadmaps
    ]

    # 2.5 Interviews
    interviews = db.query(InterviewSession).filter(
        InterviewSession.user_id == current_user.id
    ).order_by(InterviewSession.created_at.desc()).all()
    
    interview_history = []
    for interview in interviews:
        if interview.score is None:
            continue
        scored_at = interview.completed_at or interview.created_at
        interview_history.append({
            "score": interview.score,
            "created_at": iso_z(scored_at),
        })

    # 3. Today's usage counts (for rate limits progress rings)
    from app.core.rate_limit import get_usage, is_gap_blocked, get_gap_block_remaining_seconds, DAILY_LIMITS, GAP_BLOCK_DAYS

    usage_today = {}
    for feature in DAILY_LIMITS.keys():
        usage_today[feature] = get_usage(current_user.id, feature)

    today_action_count = sum(usage_today.values())
    career_report_depth_today = 100 if usage_today.get("full_analysis", 0) > 0 else 0

    # Force gap-blocked features to show 100% usage (e.g. limit/limit) if blocked
    for f in GAP_BLOCK_DAYS.keys():
        if is_gap_blocked(current_user.id, f):
            usage_today[f] = DAILY_LIMITS.get(f, 1)

    # Expose gap-lock remaining time so the UI can show a "locked until" countdown
    gap_blocks = {}
    for f in GAP_BLOCK_DAYS.keys():
        remaining = get_gap_block_remaining_seconds(current_user.id, f)
        if remaining is not None:
            gap_blocks[f] = remaining


    # 3. Weekly activity (last 7 days)
    seven_days_ago = today_start - timedelta(days=6)
    weekly_logs = db.query(
        func.date(ActivityLog.created_at).label('day'),
        func.count(ActivityLog.id)
    ).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.created_at >= seven_days_ago
    ).group_by(func.date(ActivityLog.created_at)).all()
    
    # Format weekly data
    weekly_activity = []
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        day_name = d.strftime("%a")
        
        # Find count for this date
        count = next((count for log_date, count in weekly_logs if str(log_date) == date_str), 0)
        weekly_activity.append({"day": day_name, "actions": count})

    # 3.5 Monthly activity (last 4 weeks, grouped by ISO week)
    four_weeks_ago = today_start - timedelta(days=27)
    monthly_logs = db.query(
        func.date(ActivityLog.created_at).label('day'),
        func.count(ActivityLog.id)
    ).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.created_at >= four_weeks_ago
    ).group_by(func.date(ActivityLog.created_at)).all()

    # Group by week (Week 1..4)
    monthly_activity = []
    for week_idx in range(4):
        week_start = four_weeks_ago + timedelta(days=week_idx * 7)
        week_end = week_start + timedelta(days=6)
        week_label = f"W{week_idx + 1}"
        week_count = sum(
            count for log_date, count in monthly_logs
            if str(week_start.date()) <= str(log_date) <= str(week_end.date())
        )
        monthly_activity.append({"week": week_label, "actions": week_count})


    recent_logs = db.query(ActivityLog).filter(
        ActivityLog.user_id == current_user.id
    ).order_by(ActivityLog.created_at.desc()).limit(5).all()
    
    color_map = {
        "resume": "#818cf8",
        "roadmap": "#34d399",
        "interview": "#f59e0b",
        "linkedin": "#a78bfa",
        "full_analysis": "#06b6d4",
    }

    activity_log = [
        {
            "label": log.action,
            "time": log.created_at.isoformat(),
            "color": color_map.get(log.feature, "#818cf8")
        }
        for log in recent_logs
    ]

    # 5. Calculate Streak
    active_dates = db.query(func.date(ActivityLog.created_at)).filter(
        ActivityLog.user_id == current_user.id
    ).distinct().all()
    
    active_date_strs = {str(d[0]) for d in active_dates if d[0]}
    
    streak = 0
    check_date = now.date()

    # If today has activity, count it and move backward
    if check_date.isoformat() in active_date_strs:
        streak += 1
        check_date -= timedelta(days=1)
    # If today has no activity but yesterday does, start from yesterday
    elif (check_date - timedelta(days=1)).isoformat() in active_date_strs:
        check_date -= timedelta(days=1)
    else:
        # No recent activity — streak is 0
        check_date = None

    # Count consecutive past days
    while check_date and check_date.isoformat() in active_date_strs:
        streak += 1
        check_date -= timedelta(days=1)

    return {
        "lastResumeAnalysis": resume_analysis,
        "lastResumeFilename": last_resume.filename if last_resume else None,
        "usageToday": usage_today,
        "gapBlocks": gap_blocks,
        "weeklyActivity": weekly_activity,
        "monthlyActivity": monthly_activity,
        "activityLog": activity_log,
        "roadmapHistory": roadmap_history,
        "interviewHistory": interview_history,
        "analysisHistory": analysis_history,
        "todayActionCount": today_action_count,
        "careerReportDepthToday": career_report_depth_today,
        "streak": streak
    }
