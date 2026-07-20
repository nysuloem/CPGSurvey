# CPG Pre-Interview Survey

A small Node/Express app that collects the pre-interview background
questionnaire described in the CPG study's Information and Consent Letter,
and stores responses in a SQLite database.

## What it does

- Serves a single-page survey at `/` (identification, background, CPG
  snapshot, confidence ratings, activity/support checklists, and an
  optional note to the interviewer).
- Saves each submission to a `responses` table via `POST /api/submit`.
- Requires only name and email; every other question can be skipped.
- Optionally emails Gursimar a short notification each time someone submits
  (see "Email notifications" below) — this is skipped gracefully if not
  configured, so submissions never fail because of it.
- Lets you download all responses as CSV from a key-protected endpoint:
  `GET /admin/export?key=YOUR_ADMIN_KEY`.

## Local development

```bash
npm install
cp .env.example .env   # then edit ADMIN_KEY
npm start
```

Visit `http://localhost:3000`. Responses are saved to `cpg-survey.db`
in the project folder (ignored by git).

## Deploying to Railway

1. Push this folder to a GitHub repo (or use the Railway CLI to deploy
   directly — `railway up` from inside this folder).
2. In Railway, create a new project from that repo. It will detect
   Node automatically via Nixpacks; `railway.json` sets the start
   command (`npm start`) for you.
3. **Set the `ADMIN_KEY` variable** in the Railway service's Variables
   tab — pick something long and random. This is what protects the
   CSV export.
4. **Attach a Volume** (Railway → your service → Settings → Volumes)
   mounted at `/data`, and set the variable `DB_PATH=/data/cpg-survey.db`.
   Without this, the SQLite file lives on Railway's ephemeral
   filesystem and **will be wiped on every redeploy** — since this is
   research data, don't skip this step.
5. Deploy. Railway gives you a public URL — that's what you send to
   CPG members to fill out before their interview.

## Email notifications

To have Gursimar get an email whenever someone submits the survey, set
these variables (in `.env` locally, or Railway's Variables tab in
production):

| Variable | Example | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Or your provider's SMTP host |
| `SMTP_PORT` | `587` | `465` for implicit TLS, `587` for STARTTLS |
| `SMTP_USER` | `yourlab@gmail.com` | The sending account |
| `SMTP_PASS` | *(app password)* | **Not** your regular password — see below |
| `FROM_EMAIL` | `yourlab@gmail.com` | Defaults to `SMTP_USER` if omitted |
| `NOTIFY_EMAIL` | `gursimar.taunk@mail.utoronto.ca` | Where the notification goes |

**If using Gmail:** you can't use your normal password over SMTP. Create
an [App Password](https://myaccount.google.com/apppasswords) on the
sending Google account (requires 2-Step Verification to be enabled) and
use that as `SMTP_PASS`. A personal Gmail or a shared lab Gmail both work.

**If using Outlook/Office365 (e.g., a UofT-linked account):** use
`smtp.office365.com`, port `587`, and your normal account credentials
(or an app password, depending on your organization's MFA policy).

If any of `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `NOTIFY_EMAIL` are
missing, notifications are silently skipped — the survey still works
normally, Gursimar just won't get pinged. Check the Railway deploy logs
if you expect an email and don't see one; failures are logged there
(e.g., wrong password) without affecting the student's submission.

## Getting the data out

Once you're ready to pull responses (e.g., after each participant's
2-week withdrawal window has closed), visit:

```
https://<your-railway-url>/admin/export?key=YOUR_ADMIN_KEY
```

This downloads a CSV with one row per response. Hand this to Gursimar
alongside the corresponding interview transcript so he can link them
before de-identifying, per the consent letter.

## Notes on the data model

- `full_name` and `email` are the only required fields — everything
  else can be skipped, matching "you may skip any question" in the
  consent letter.
- `activities` and `supports` are stored as JSON arrays (e.g.
  `["Peer mentoring","Written documentation"]`) — parse with
  `JSON.parse()` or your analysis tool of choice (pandas'
  `ast.literal_eval` works too).
- Confidence ratings (`conf_entry_*`, `conf_today_*`) are stored as
  integers 1–5, so the before/after delta per domain is a simple
  subtraction once exported.

## Security notes

- The export endpoint is protected only by a shared key in the URL —
  fine for a small internal tool, but don't share the link outside
  the research team, and rotate `ADMIN_KEY` if you ever suspect it's
  leaked.
- There's no authentication on the survey form itself (anyone with
  the link can submit) — reasonable for a small, known participant
  pool contacted directly, but not suited for a public-facing survey.
