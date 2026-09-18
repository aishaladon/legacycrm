# Google OAuth setup (Gmail, Calendar, Drive/Meet transcripts)

The deployed CRM backend needs its own Google API credentials — it can't
reuse the Gmail/Calendar/Drive connectors from a Claude session, since
those only work inside that session. This is a one-time setup, done by
Aisha (or anyone with access to the aishaladon@gmail.com Google account),
with no coding required.

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   sign in with **aishaladon@gmail.com**.
2. Create a new project (e.g. "Legacy CRM").

## 2. Enable the APIs

In **APIs & Services > Library**, enable each of:

- Gmail API
- Google Calendar API
- Google Drive API

## 3. Configure the OAuth consent screen

1. **APIs & Services > OAuth consent screen.**
2. User type: **External**. App name: "Legacy CRM". Support email: your own.
3. Scopes: add
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
4. Test users: add **aishaladon@gmail.com**. (While the app is in "Testing"
   mode, only test users can authorize it — that's fine, since only you
   ever will.)

## 4. Create the OAuth client

1. **APIs & Services > Credentials > Create Credentials > OAuth client ID.**
2. Application type: **Web application**.
3. Authorized redirect URIs: add
   `https://developers.google.com/oauthplayground`
   (this is Google's own token-minting tool — see step 5).
4. Save. Copy the **Client ID** and **Client secret** — these are
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 5. Mint a refresh token (no coding required)

1. Go to [OAuth Playground](https://developers.google.com/oauthplayground).
2. Click the gear icon (top right) > check **"Use your own OAuth
   credentials"** > paste in your Client ID and Client secret.
3. In the left panel, under "Input your own scopes", paste all three,
   one per line:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/drive.readonly
   ```
4. Click **Authorize APIs**, sign in as **aishaladon@gmail.com**, and
   allow access.
5. Back on the Playground, click **Exchange authorization code for
   tokens**.
6. Copy the **Refresh token** value shown — that's `GOOGLE_REFRESH_TOKEN`.

## 6. Set the environment variables

Add all three to `.env.local` for local testing, and to the same variables
in the Hostinger environment once deployed:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
OWNER_EMAIL=aishaladon@gmail.com
```

The refresh token doesn't expire under normal use (Google only revokes it
if the app is removed from your account's connected apps, the OAuth
client is deleted, or it goes unused for 6 months) — this is a one-time
setup, not something to redo per deploy.
