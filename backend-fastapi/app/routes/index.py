"""The /api router (routes/index.ts). Modules are added here as they are ported; until then
requests for them fall through to EXPRESS_FALLBACK_URL (see app_factory.not_found).

Order matters exactly as in Express: the first matching route answers, and `api.use(authenticate)`
applies to every route registered after it.
"""
from ..http import Router
from ..middleware.auth import authenticate
from . import auth_routes

api = Router()

# ---- Public -------------------------------------------------------------
api.use('/auth', auth_routes.r)
# TODO(port): api.use('/public', public_routes.r)
# TODO(port): api.use('/v1', devices_routes.device_ingest_routes)
# TODO(port): api.use('/v1', workforce_routes.biometric_ingest_routes)

# ---- Authenticated ------------------------------------------------------
# Everything below requires a valid access token; each route additionally declares the permission it needs.
api.use(authenticate)
# TODO(port), in this order: core ('/'), students ('/students'), tracking ('/tracking'), devices ('/devices'),
# device-assignments ('/device-assignments'), parents ('/parents'), dashboard ('/dashboard'), academics, admissions,
# finance, workforce, safety, parents_experience, operations, innovation, group, intelligence, exam_correction,
# planning, jobcards, parentlog, syllabus (all at '/').
