# Deploying Edunex on Vercel

`vercel.json` deploys the repository as one Vercel project with three services:

| Service | Folder | Reached at |
|---|---|---|
| `web` | `frontend/` (Vite) | `/` — every path not under `/api` |
| `api` | `backend/` (Express, entry `src/vercel.ts`) | `/api/*` |
| `exam-vision` | `exam-vision/backend/` (FastAPI) | internal only — the API calls it through the `EXAM_VISION_URL` binding |

Local development is unchanged (`npm run dev`); none of the settings below are needed on a PC.

## Step by step (Neon database)

1. **Database.** Vercel -> your project -> **Storage** -> **Create Database** -> **Neon** -> connect it
   to this project (Production and Preview). Neon sets `DATABASE_URL` in the project for you; the
   API and Paper Correction both use it (TLS is on by default on Vercel).
2. **Settings.** `.env.vercel` (made from `.env.vercel.example`, never committed) holds the other
   settings with fresh secrets. Vercel -> **Settings** -> **Environment Variables** -> **Import .env**
   and choose that file. Do not add `DATABASE_URL` or `EXAM_VISION_URL` there.
3. **Tables and demo data**, once, from this PC: copy `.env.neon.example` to `.env.neon`, paste
   Neon's connection string and a demo password, then run `npm run db:migrate:neon` and
   `npm run db:seed:neon`. Run `db:migrate:neon` again after pulling new migrations.
4. **Redeploy** (Deployments -> ... -> Redeploy) so the functions read the new settings.

If a setting is still missing, the sign-in page names it instead of failing.

## Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | set by the Neon integration (`POSTGRES_URL` is used if only that is set) |
| `NODE_ENV` | `production` |
| `DATABASE_SSL` | `require` (default on Vercel; `verify` with `DATABASE_CA_CERT`) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | two different random values, 32+ characters |
| `CORS_ORIGINS` | your own domain, if any; the `*.vercel.app` addresses are allowed automatically |
| `COOKIE_SECURE` | `true` |
| `CRON_SECRET` | a random value, 16+ characters |
| `EXAM_VISION_SECRET` | a random value, 32+ characters, read by both the API and Paper Correction |
| `STORAGE_DRIVER` | `local` to start (uploads do not last on Vercel); `s3` with the `S3_*` settings for a bucket |

Paper Correction keeps its tables in the same database, in its own `exam_vision` schema
(created on first use), and on Vercel marks a sheet within the request.

## Scheduled work

`vercel.json` runs `/api/internal/cron/notifications` once a day, at 03:00 UTC (08:30 IST), to send
queued SMS, WhatsApp, e-mail and push notifications (the local server does this every minute).
That is the most Vercel's Hobby plan allows. On Pro, set the schedule to `*/10 * * * *` (every
10 minutes) so notifications go out promptly.

## Page refreshes

The website build also writes `404.html` (a copy of `index.html`), so refreshing an app page such
as `/overview` opens the app. Such a refresh is answered with HTTP status 404 even though the page
works; links and navigation inside the app are not affected.
