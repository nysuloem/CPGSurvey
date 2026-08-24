# CPG Pre-Interview Survey

A Node/Express survey for the UTSC Computational Physiology Group study. Responses are stored in SQLite.

## Participant flow

1. The participant reads or downloads the Information and Consent Letter.
2. The participant records either consent or non-consent. Both choices proceed to the survey, as required for interview and gift-card eligibility.
3. The survey is presented as a sequence of short steps with Back and Next controls.
4. Name and email are required; every other survey question may be skipped.
5. The consent decision and survey answers are stored together when the survey is submitted.

## Local development

```bash
npm install
cp .env.example .env
npm start
```

Visit `http://localhost:3000`.

## Railway deployment

Attach a Railway volume at `/data` and set:

```text
DB_PATH=/data/cpg-survey.db
```

This ensures that responses and the administrator password hash survive redeployments.

## Administrator setup

Set `ADMIN_KEY` in Railway to a long, random value. It is used only as the one-time setup code.

1. Give the setup code and `https://YOUR-RAILWAY-URL/admin` to the designated data custodian.
2. The custodian enters the code and creates a private password of at least 12 characters.
3. Only a random salt and `scrypt` password hash are stored. The password itself is not stored.
4. After setup, `ADMIN_KEY` can no longer open the dashboard or exports and may be removed from Railway.

The custodian can change the password while signed in. Sessions use an HTTP-only, same-site cookie and expire after eight hours of inactivity. Five unsuccessful attempts from one address produce a 15-minute pause. The one-time setup code cannot reset a forgotten password.

## Text alerts

Textbelt alerts are optional and do not block survey submission. Configure these Railway variables:

| Variable | Purpose |
|---|---|
| `TEXTBELT_API_KEY` | Purchased Textbelt API key |
| `NOTIFY_SMS_TO` | Recipient number in `+1...` format |

Alerts contain no participant name, email address, consent choice, answers, or admin credentials. If Textbelt is unavailable, the app can use the optional SMTP email settings as a fallback.

## Response access

The designated data custodian visits `https://YOUR-RAILWAY-URL/admin`, signs in, and can:

- view the newest 200 submissions;
- see who submitted and the recorded consent decision; and
- download the complete CSV.

Administrator passwords and session tokens are never placed in the URL.

## Security boundary

This password system prevents anyone who does not know the custodian's password from using the normal dashboard and export endpoints. It does not prevent a person with control of the Railway service, persistent volume, or deployed source code from creating another technical route to the underlying data.
