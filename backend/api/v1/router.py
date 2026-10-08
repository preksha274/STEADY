"""
STEADY API v1 Central Router
Mounts all REST resources:
- /sessions (upload, video, timeline)
- /baseline (personal baseline)
- /diary (quick-tap daily check-in)
- /forecast (day forecast & best window)
- /cue-sessions (Live Cue Designer test/adapt & prescription)
- /exercise-sessions (Move Coach logs)
- /danger-zones (Home hazard spots CRUD)
- /freeze-episodes (FOG logging & danger zone linkage)
- /severity (symptom traffic-light readings)
- /dose-logs (medication dose tracking)
- /voice-checks (voice loudness & non-motor check)
- /reports (pre-visit clinical summary)
"""

from fastapi import APIRouter

from .sessions import router as sessions_router
from .baseline import router as baseline_router
from .diary import router as diary_router
from .forecast import router as forecast_router
from .cue_sessions import router as cue_router
from .exercise import router as exercise_router
from .danger_zones import router as danger_zones_router
from .freeze import router as freeze_router
from .severity import router as severity_router
from .dose_logs import router as dose_logs_router
from .voice_checks import router as voice_checks_router
from .reports import router as reports_router
from .clinical_scores import router as clinical_scores_router
from .wearable import router as wearable_router
from .guardian_links import router as guardian_links_router
from .safe_zones import router as safe_zones_router
from .location_pings import router as location_pings_router
from .alerts import router as alerts_router
from .guardian import router as guardian_router
from .sos import router as sos_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(sessions_router)
api_v1_router.include_router(baseline_router)
api_v1_router.include_router(diary_router)
api_v1_router.include_router(forecast_router)
api_v1_router.include_router(cue_router)
api_v1_router.include_router(exercise_router)
api_v1_router.include_router(danger_zones_router)
api_v1_router.include_router(freeze_router)
api_v1_router.include_router(severity_router)
api_v1_router.include_router(dose_logs_router)
api_v1_router.include_router(voice_checks_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(clinical_scores_router)
api_v1_router.include_router(wearable_router)
api_v1_router.include_router(guardian_links_router)
api_v1_router.include_router(safe_zones_router)
api_v1_router.include_router(location_pings_router)
api_v1_router.include_router(alerts_router)
api_v1_router.include_router(guardian_router)
api_v1_router.include_router(sos_router)
