# Deploying Edunex on Vercel

`vercel.json` deploys the repository as one Vercel project with three services:

| Service | Folder | Reached at |
|---|---|---|
| `web` | `frontend/` (Vite) | `/` — every path not under `/api` |
| `api` | `backend/` (Express, entry `src/vercel.ts`) | `/api/*` |
| `exam-vision` | `exam-vision/backend/` (FastAPI) | internal only — the API calls it through the `EXAM_VISION_URL` binding |

Local development is unchanged (`npm run dev`); none of the settings below are needed on a PC.

## Before the first deploy

1. **Database.** A hosted PostgreSQL that Vercel can reach. Run the migrations and seed against it
   from a PC once: set `DATABASE_URL` (and `DATABASE_SSL`) in `.env`, then `npm run db:migrate`
   (and `npm run db:seed` for demo data). Prefer the provider's connection pooler URL.
2. **File store.** A private bucket on any S3-compatible store (AWS S3, Cloudflare R2, Supabase
   Storage, MinIO) and an access key that can read and write it.
3. **Paper Correction** keeps its tables in the same database, in its own `exam_vision` schema
   (created on first use). Answer-sheet pages are stored in the database. On Vercel it reads and
   marks a sheet within the request instead of in a background worker, so an upload with
   automatic reading waits until the AI has finished (usually under two minutes).

## Environment variables (Project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the hosted database (pooler URL) |
| `DATABASE_SSL` | `require` (or `verify` with `DATABASE_CA_CERT`) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | two different random values, 32+ characters |
| `CORS_ORIGINS` | the site's address, e.g. `https://edunex.example.com` |
| `COOKIE_SECURE` | `true` |
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the bucket and its key |
| `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | as the provider documents (`auto` and the R2 endpoint for R2; `true` for Supabase/MinIO) |
| `CRON_SECRET` | a random value, 16+ characters |
| `EXAM_VISION_SECRET` | a random value, 32+ characters — read by both the API and Paper Correction |

Do **not** set `EXAM_VISION_URL`: the binding injects it. Paper Correction finds the database
through `DATABASE_URL` (or `EXAM_DATABASE_URL` to use a different one).

## Scheduled work

`vercel.json` runs `/api/internal/cron/notifications` every 10 minutes to send queued SMS,
WhatsApp, e-mail and push notifications (the local server does this every minute). Vercel's Hobby
plan only allows daily cron jobs: on Hobby, change the schedule to once a day or move to Pro.

## Page refreshes

The website build also writes `404.html` (a copy of `index.html`), so refreshing an app page such
as `/overview` opens the app. Such a refresh is answered with HTTP status 404 even though the page
works; links and navigation inside the app are not affected.
