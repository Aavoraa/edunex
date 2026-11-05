from ..controllers import auth_controller as c
from ..http import Router, validate
from ..middleware.auth import authenticate
from ..middleware.security import auth_limiter, refresh_limiter
from ..validators.auth_validators import change_password_schema, login_schema, refresh_schema

r = Router()

r.post('/login', auth_limiter, validate(login_schema), c.login)
r.post('/refresh', refresh_limiter, validate(refresh_schema), c.refresh)
r.post('/logout', c.logout)
r.get('/me', authenticate, c.me)
r.post('/change-password', authenticate, auth_limiter, validate(change_password_schema), c.change_password)
r.get('/sessions', authenticate, c.sessions)
r.post('/sessions/revoke-all', authenticate, c.sign_out_everywhere)
