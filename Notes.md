### Q-  Can you please check this error? const { fileExists = ts.sys.fileExists, readFile = ts.sys.readFile, skipProject = index_1.DEFAULTS.skipProject, project = index_1.DEFAULTS.project, tsTrace = index_1.DEFAULTS.tsTrace, } = rawApiOptions;

This error is **not related to your code**. It's almost always caused by an incompatible or broken **TypeScript/ts-node installation**.

The key part is:

```text
TypeError: Cannot read properties of undefined (reading 'fileExists')
```

This means `ts-node` is trying to access the TypeScript compiler API, but `ts` is undefined.

---

## Step 1: Check installed versions

Run:

```bash
npm ls typescript
npm ls ts-node
```

Paste the output here.

---

## Step 2: Check package.json

Paste your `devDependencies`.

I'm looking for something like:

```json
"devDependencies": {
  "@types/express": "^5.x.x",
  "@types/node": "^24.x.x",
  "nodemon": "^3.x.x",
  "ts-node": "^10.9.2",
  "typescript": "^5.8.x"
}
```

---

## Step 3: Check tsconfig

Run

```bash
npx tsc --showConfig
```

Does it work?

Or does it throw an error?

---

## Step 4: Most likely fix

Delete everything and reinstall.

On Windows:

```bash
rmdir /s /q node_modules
del package-lock.json
```

Then

```bash
npm install
```

---

## Step 5: Verify TypeScript

Run

```bash
npx tsc --version
```

Expected:

```text
Version 5.x.x
```

Then

```bash
npx ts-node --version
```

Expected

```text
v10.9.2
```

---

## Step 6: Check your tsconfig.json

Make sure it looks like this:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

---

## I suspect the actual cause

The stack trace points to:

```text
ts-node/dist/configuration.js
```

This usually happens when **TypeScript is missing, corrupted, or an unsupported version is installed**.

---

### Please paste the output of these four commands:

```bash
node -v
```

```bash
npm ls typescript
```

```bash
npm ls ts-node
```

```bash
type package.json
```

With those, I can pinpoint the exact issue in a minute.

---

### Q-  I'm getting this error while trying to test hubspot connection. Please check. ApiException [Error]: HTTP-Code: 403 Message: An error occurred. Body: {"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https://developers.hubspot.com/scopes."}

This error is actually very helpful—it tells us your **authentication is working**, but your app **doesn't have permission** to read contacts.

So we've moved from:

- ❌ Connection issue
- ❌ Authentication issue

to

- ✅ Token is valid
- ❌ Missing scopes

That's progress.

## The problem

The important part is:

```text
MISSING_SCOPES

crm.objects.contacts.read
```

Your access token doesn't have the required `crm.objects.contacts.read` scope.

---

# First, let's verify what kind of token you're using

There are two possibilities:

### Option 1 (Recommended)

You're using a **Private App** access token.

Example:

```text
pat-na1-xxxxxxxxxxxxxxxxxxxxxxxx
```

### Option 2

You're using a **Developer App OAuth token**.

For this assignment, **don't use OAuth**. It adds unnecessary complexity.

---

# If you're using a Private App

Go to:

**Settings → Integrations → Private Apps**

Open your Private App.

Under **Scopes**, enable:

```
CRM

☑ crm.objects.contacts.read
```

Save the changes.

If prompted, regenerate the token and update your `.env`.

---

# If you don't have a Private App

Create one inside your **Developer Test Account**, not just the developer account itself.

The flow should be:

```
Developer Account
      ↓
Developer Test Account
      ↓
Private App
      ↓
Access Token
```

---

# One thing I want to confirm

The assignment says:

> Set up a free HubSpot developer account

Many people create only the **Developer Account**.

That's **not enough**.

You also need a **Developer Test Account (portal)** because that's where contacts live.

---

## Please answer these two questions:

### 1. Does your token look like this?

```
pat-na1-xxxxxxxxxxxx
```

or something else?

---

### 2. Where did you create it?

- A. Developer App
- B. Private App
- C. OAuth App

---

## Also send me a screenshot (or describe) of:

```
Settings
   ↓
Integrations
      ↓
Private Apps
```

or

```
Developer Dashboard
```

so I can tell you exactly what needs to be changed.

I suspect this is just a scope configuration issue, and we'll have it resolved in a couple of minutes.

---

### Q-  Guide me through the steps create a Cloud project and enable the Calendar API. Perfect. Let's set up **Google Calendar** for the assignment properly. We'll use a **Service Account**, because it's the easiest and most reliable option for a backend service.

---

# Step 1: Create a Google Cloud Project

1. Go to the **Google Cloud Console**.
2. Click the project selector at the top.
3. Click **New Project**.
4. Name it something like:

```
sync-pipeline
```

5. Click **Create**.
6. Wait for the project to be created and switch to it.

---

# Step 2: Enable the Google Calendar API

1. In the left sidebar, go to:

```
APIs & Services
    ↓
Library
```

2. Search for:

```
Google Calendar API
```

3. Open it.
4. Click **Enable**.

---

# Step 3: Create a Service Account

Go to:

```
IAM & Admin
    ↓
Service Accounts
```

Click:

```
Create Service Account
```

Example:

```
Name:
sync-pipeline

ID:
sync-pipeline
```

Click:

```
Create and Continue
```

You don't need to assign any IAM roles for this project.

Click:

```
Done
```

---

# Step 4: Generate a JSON Key

Open the service account you just created.

Go to:

```
Keys
```

Click:

```
Add Key
    ↓
Create New Key
```

Choose:

```
JSON
```

Click:

```
Create
```

A JSON file will download automatically.

Example:

```
sync-pipeline-3d4f1d9b7f.json
```

---

# Step 5: Store the Key

In your project:

```
sync-pipelines/

src/

secrets/

google-service-account.json
```

Move the downloaded JSON into:

```
secrets/google-service-account.json
```

Then update your `.env`:

```env
GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/google-service-account.json
```

---

# Step 6: Copy the Service Account Email

Open the JSON file.

You'll see something like:

```json
{
  ...
  "client_email":
  "sync-pipeline@sync-pipeline-123456.iam.gserviceaccount.com"
}
```

Copy the value of:

```
client_email
```

---

# Step 7: Share Your Calendar

Go to:

[https://calendar.google.com](https://calendar.google.com)

On the left:

```
My Calendars
```

Hover over your calendar.

Click:

```
⋮

Settings and sharing
```

Scroll down to:

```
Share with specific people
```

Click:

```
Add people
```

Paste the service account email.

Example:

```
sync-pipeline@sync-pipeline-123456.iam.gserviceaccount.com
```

Permission:

```
Make changes to events
```

Click:

```
Send
```

This step is essential because a service account **cannot access your personal calendar unless you explicitly share it**.

---

# Step 8: Calendar ID

Still in **Settings and sharing**.

Scroll to:

```
Integrate Calendar
```

Copy:

```
Calendar ID
```

If you're using your primary calendar, it might look like:

```
yourname@gmail.com
```

or

```
primary
```

Update `.env`:

```env
GOOGLE_CALENDAR_ID=yourname@gmail.com
```

Using the actual Calendar ID is more reliable than `primary` with a service account.

---

# Step 9: Seed Some Events

Create about five events manually.

For example:

| Title               | Start          | End            |
| ------------------- | -------------- | -------------- |
| Team Standup        | 9:00           | 9:30           |
| Client Meeting      | 11:00          | 12:00          |
| Sprint Planning     | 2:00           | 3:00           |
| Demo Session        | 4:00           | 5:00           |
| Architecture Review | Tomorrow 10:00 | Tomorrow 11:00 |

These will be used for the sync.

---

# Step 10: Install the Google Library

```bash
npm install googleapis
```

---

# Step 11: Test the Connection

Create:

```
src/testGoogleCalendar.ts
```

```ts
import "dotenv/config";
import { google } from "googleapis";

async function test() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({
    version: "v3",
    auth,
  });

  const response = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  console.log(response.data.items);
}

test().catch(console.error);
```

Run:

```bash
npx ts-node src/testGoogleCalendar.ts
```

If everything is configured correctly, you'll see the events you created.

---

# Why Google Calendar is Perfect for This Assignment

One reason the assignment likely chose Google Calendar is that it provides a **real incremental synchronization mechanism**:

- **Full sync**: `events.list()`
- **Incremental sync**: `events.list(syncToken=...)`
- **Stale cursor handling**: If the `syncToken` expires, the API returns **HTTP 410 Gone**, exactly matching the assignment's requirement to detect a stale cursor and perform a full backfill instead of silently losing data.

This makes it an excellent demonstration of robust sync pipeline design.

---

## Before we write `GoogleCalendarProvider`

Please complete these steps and confirm:

1. ✅ Google Cloud project created.
2. ✅ Google Calendar API enabled.
3. ✅ Service account created.
4. ✅ JSON key downloaded and placed in `secrets/`.
5. ✅ Calendar shared with the service account email.
6. ✅ Five sample events created.
7. ✅ `testGoogleCalendar.ts` successfully lists those events.

Once that's working, we'll implement `GoogleCalendarProvider` with both full and incremental sync using `syncToken`, including the required fallback behavior for expired tokens.

---

### Q-  I'm getting this TS error which I think is related to PGSQL. Can you please check and guide me through the fix?return new TSError(diagnosticText, diagnosticCodes, diagnostics); ^ TSError: ⨯ Unable to compile TypeScript: src/config/database.ts:2:34 - error TS7016: Could not find a declaration file for module 'pg'. 'C:/Users/visha/Downloads/sync-metrics-service/sync-metrics-service/node_modules/pg/lib/index.js' implicitly has an 'any' type. Try npm i --save-dev @types/pg if it exists or add a new declaration (.d.ts) file containing declare module 'pg'; 2 import { types as pgTypes } from "pg";

This one is straightforward.

The error says:

```text
Could not find a declaration file for module 'pg'
```

You're using TypeScript, and the PostgreSQL driver (`pg`) doesn't include its own type definitions in the version you're using.

## Fix

Install the type definitions:

```bash
npm install -D @types/pg
```

Then run:

```bash
npm run migrate
```

---

## If another package reports the same error

You may also need the corresponding `@types` package. Common ones are:

```bash
npm install -D @types/node
npm install -D @types/express
npm install -D @types/pg
```

---

## Verify your dependencies

Run:

```bash
npm ls pg
npm ls @types/pg
```

You should see something like:

```text
pg@8.x.x
@types/pg@8.x.x
```

---

### If you still get compilation errors

Paste the output of:

```bash
type package.json
```

and

```bash
type tsconfig.json
```

There may be another TypeScript configuration issue, but the missing `@types/pg` package is the first thing to fix.

### Q-  After creating the build, render is not able to run the application. I think the issue is the file path mismatch. Can you please check the issue?

That output tells us your build is succeeding, but it also reveals the real issue.

Your compiled entry point is:

```text
dist/src/server.js
```

But Render is trying to start:

```text
dist/server.js
```

That's why it fails with:

```text
Error: Cannot find module '/opt/render/project/src/dist/server.js'
```

## Option 1 (Recommended): Change the Render start command

Update your Render service:

- **Build Command**

  ```bash
  npm install && npm run build
  ```

- **Start Command**

  ```bash
  node dist/src/server.js
  ```

This matches the output generated by your current `tsconfig.json`.

---

## Option 2 (Cleaner Project Structure)

If you want the output to be `dist/server.js` instead of `dist/src/server.js`, restructure your TypeScript build.

For example:

```json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

You would then need separate handling for your `scripts/` (or move them under `src/scripts/`).

Since your project includes `scripts/`, **Option 1 is the quickest fix**.

---

## Also update `package.json`

Since your build currently generates `dist/src/server.js`, your `start` script should match:

```json
"scripts": {
  "build": "tsc -p tsconfig.json",
  "start": "node dist/src/server.js"
}
```

Then in Render, you can simply use:

- **Build Command**

  ```bash
  npm install && npm run build
  ```

- **Start Command**

  ```bash
  npm start
  ```

This keeps your deployment configuration aligned with your project and makes it easier to change the entry point later if needed.

### Q-  I'm facing issue connecting to supabase from render. I'm posting the exact error logs here. Help me fix this.GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:134:8) { 2026-07-11T23:18:41.153362955Z errno: -101, 2026-07-11T23:18:41.153366505Z code: 'ENETUNREACH', 2026-07-11T23:18:41.153369305Z syscall: 'connect', 2026-07-11T23:18:41.153372105Z address: '2406:da1a:b00:1300:6a7e:8c92:768c:e6cf', 2026-07-11T23:18:41.153375175Z port: 5432 2026-07-11T23:18:41.153377925Z }, 2026-07-11T23:18:41.153380966Z original: Error: connect ENETUNREACH 2406:da1a:b00:1300:6a7e:8c92:768c:e6cf:5432 - Local (:::0)

This error is much more specific than the previous one.

```
ENETUNREACH
connect 2406:da1a:b00:1300:6a7e:8c92:768c:e6cf:5432
```

The important part is that your application is trying to connect to an **IPv6 address** (`2406:...`).

Render's free web services often don't have outbound IPv6 connectivity, while your Supabase hostname is resolving to IPv6 first.

## Solution 1 (Recommended): Use Supabase Session Pooler

Instead of using the direct host:

```
db.xxxxx.supabase.co
```

use the **Session Pooler** connection string.

In Supabase:

1. **Settings**
2. **Database**
3. Scroll to **Connection pooling**
4. Copy the **Session Pooler URI**

It looks similar to:

```
postgresql://postgres.xxxxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

Notice:

- Host ends with `pooler.supabase.com`
- Port is usually **6543**, not **5432**

Replace your `DATABASE_URL` on Render with that value and redeploy.

---

## Solution 2: Enable IPv4 Add-on (if available)

Some newer Supabase projects expose an IPv4-compatible endpoint under **Connection String → Direct Connection (IPv4)**. If your project has that option, use it instead of the standard direct host.

---

## I need one thing from you

Please tell me **which Supabase plan you're using**:

- Free
- Pro
- Team

Also, open:

**Supabase → Settings → Database → Connection string**

and tell me which options you see.

For example, do you see:

- Direct connection
- Session pooler
- IPv4
- IPv6

or paste a screenshot (with the password hidden). That will let me tell you exactly which connection string to use.

---

### Q-  I think now I have a different error. Please check the logs here:2026-07-11T23:22:31.236159946Z at TLSWrap.onStreamRead (node:internal/stream_base_commons:189:23) { 2026-07-11T23:22:31.236162846Z length: 71, 2026-07-11T23:22:31.236165676Z severity: 'FATAL', 2026-07-11T23:22:31.236168517Z code: '28P01', 2026-07-11T23:22:31.236171206Z detail: undefined, 2026-07-11T23:22:31.236173797Z hint: undefined, 2026-07-11T23:22:31.236176447Z position: undefined, 2026-07-11T23:22:31.236179047Z internalPosition: undefined, 2026-07-11T23:22:31.236181687Z internalQuery: undefined, 2026-07-11T23:22:31.236184217Z where: undefined, 2026-07-11T23:22:31.236186717Z schema: undefined, 2026-07-11T23:22:31.236189307Z table: undefined, 2026-07-11T23:22:31.236191807Z column: undefined, 2026-07-11T23:22:31.236194367Z dataType: undefined, 2026-07-11T23:22:31.236196997Z constraint: undefined, 2026-07-11T23:22:31.236199567Z file: undefined, 2026-07-11T23:22:31.236202087Z line: undefined, 2026-07-11T23:22:31.236204717Z routine: undefined 2026-07-11T23:22:31.236207587Z }

This is actually good news—you've made progress.

Previously the error was:

- ❌ `ENETUNREACH` (couldn't reach the database)

Now it's:

- ✅ **Connected to the database server**
- ❌ **Authentication failed**

The key line is:

```text
password authentication failed for user "postgres"
SQLSTATE: 28P01
```

This means your Render service is reaching Supabase, but the `DATABASE_URL` contains the wrong username or password.

## Step 1: Verify the connection string

In Supabase:

1. Go to **Settings → Database**.
2. Under **Connection string**, copy the URI again.
3. It should look similar to:

```text
postgresql://postgres:[YOUR_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

or

```text
postgresql://postgres.xxxxx:[YOUR_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

**Important:** Some pooler connection strings use a username like `postgres.<project-ref>` instead of just `postgres`. Use exactly what Supabase provides.

## Step 2: Check the password

Make sure you are using the **database password** you set when creating the Supabase project—not your Supabase account password.

If you're unsure:

1. Go to **Settings → Database**.
2. Click **Reset database password**.
3. Set a new password.
4. Update `DATABASE_URL` in Render with the new password.
5. Redeploy.

## Step 3: URL-encode special characters

If your password contains characters like:

```
@
:
/
?
#
&
%
```

they must be URL-encoded in the connection string.

For example:

- `@` → `%40`
- `#` → `%23`
- `%` → `%25`

A password like:

```text
MyPass@123
```

must become:

```text
MyPass%40123
```

## Step 4: Double-check the username

If you're using the Session Pooler, don't change the username manually. Use the username exactly as shown by Supabase.

---

### Please paste (with the password hidden):

Your current `DATABASE_URL`, for example:

```text
DATABASE_URL=postgresql://postgres:********@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

Leave the host and username visible, but replace only the password with `********`. That will let me verify whether the username, host, and port are correct.

---

### Q-  After integrating the calendar successfully, the API is staying in a pending state and not returning any response. Is there something that I'm missing?

A request that stays in **Pending** (never returning a response) is a very different symptom from getting a 500 error.

This almost always means **one of your async operations never resolves**, so Express never reaches `res.json(...)`. Express route handlers must eventually send a response or end the request; otherwise the client will wait indefinitely. ([Express.js][1])

Since this only started after enabling Google Calendar, I suspect the request is hanging in the calendar adapter.

## Let's isolate it in 2 minutes

### 1. Show me your `/sync/run` route

Please paste:

```ts
src / routes / sync.ts;
```

or wherever you have

```ts
router.post("/sync/run");
```

or

```ts
app.post("/sync/run");
```

I want to see how the orchestrator is called.

---

### 2. Add logging

Around the sync call:

```ts
console.log("Starting sync");

const result = await orchestrator.run();

console.log("Sync finished");

res.json(result);
```

Then inside the Google adapter:

```ts
console.log("Before getAccessToken");

const token = await getAccessToken();

console.log("Token received");

console.log("Before Google fetch");

const res = await fetch(...);

console.log("Google responded", res.status);
```

After deploying, check the Render logs.

If you see:

```
Starting sync
Before getAccessToken
```

and nothing else...

➡️ the hang is inside

```ts
await auth.getClient();
```

or

```ts
await client.getAccessToken();
```

---

If you see

```
Before Google fetch
```

and nothing afterwards...

➡️ the HTTP request to Google is hanging.

---

### 3. Even better: add a timeout

Wrap the fetch:

```ts
const controller = new AbortController();

setTimeout(() => controller.abort(), 10000);

const res = await fetch(url, {
  headers,
  signal: controller.signal,
});
```

If it times out after 10 seconds, you'll know exactly where it's stuck.

---

## My main suspicion

Earlier you mentioned that on Render you set:

```
GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/google-service-account.json
```

If the file doesn't exist in the deployed container, or the auth library is waiting on credentials in an unexpected state, the request can appear to hang before your route responds.

## Please paste these two files:

1. `src/server.ts`
2. The `/sync/run` route (or the orchestrator invocation)

Those two files are enough to pinpoint why the request never completes.

[1]: https://expressjs.com/en/5x/guide/routing/?utm_source=chatgpt.com "Routing · Express.js"

### Q-  I think the issue is in this router. Can you please verify?
import dotenv from "dotenv";
dotenv.config();

async function main() {
await sequelize.authenticate();
app.listen(PORT, () => {
// eslint-disable-next-line no-console
console.log(`sync-metrics-service listening on :${PORT}`);
});
}

main().catch((err) => {
// eslint-disable-next-line no-console
console.error("Failed to start server:", err);
process.exit(1);
});

syncRouter.post("/run", async (\_req: Request, res: Response) => {
const summaries = await runFullSync([
hubspotSource as any,
googleCalendarSource as any,
stripeSource as any,
]);
res.json({ summaries });
});

Your route itself looks fine. The fact that the request stays **Pending forever** means one of the following is happening:

1. `runFullSync()` never resolves.
2. One of the sources (`hubspot`, `google_calendar`, `stripe`) never returns.
3. An infinite loop exists inside `runFullSync()`.

Since it worked before adding Google Calendar, my suspicion is still the Google adapter, **but we need to prove it**.

## Step 1: Isolate the culprit

Temporarily disable Google Calendar:

```ts
syncRouter.post("/run", async (_req, res) => {
  const summaries = await runFullSync([
    hubspotSource,
    // googleCalendarSource,
    stripeSource,
  ]);

  res.json({ summaries });
});
```

If `/sync/run` immediately returns, you've confirmed the issue is inside the Google source.

---

## Step 2: I want to see `runFullSync()`

Please paste the entire function.

I'm specifically looking for code like:

```ts
while (hasMore) {
   ...
}
```

or

```ts
for (;;) {
```

or

```ts
do {
```

because Google Calendar pagination is commonly implemented with a loop. If `nextPageToken` isn't updated correctly, the loop never exits.

---

## Step 3: A bug I already noticed

Your `fetchFull()` returns:

```ts
return {
  records: valid,
  nextCursor: body.nextSyncToken ?? pageToken ?? null,
  hasMore: !!body.nextPageToken,
};
```

Notice what's missing?

You're **not returning `nextPageToken`**.

If `runFullSync()` expects something like:

```ts
let pageToken;

do {
  const result = await source.fetchFull(pageToken);

  pageToken = result.nextPageToken;
} while (result.hasMore);
```

then `pageToken` will remain `undefined` forever, causing the **first page to be fetched repeatedly**, which results in an infinite loop and a request that never completes.

---

## Step 4: Add logs

Inside the route:

```ts
console.log("Starting sync");

const summaries = await runFullSync(...);

console.log("Finished sync");

res.json({ summaries });
```

Inside `fetchFull()`:

```ts
console.log("Fetching page", pageToken);

...

console.log(
  "Items:",
  valid.length,
  "Next page:",
  body.nextPageToken,
  "Next sync:",
  body.nextSyncToken
);
```

If Render prints:

```
Fetching page undefined
Items: 10 Next page: ABC123
Fetching page undefined
Items: 10 Next page: ABC123
Fetching page undefined
Items: 10 Next page: ABC123
...
```

then we've found the bug.

---

### Please paste **only** the implementation of:

```ts
runFullSync();
```

I'm fairly confident the issue is in that function's pagination logic, and I can pinpoint the exact line once I see it.

---

### Q-  Give me a test stripe card details

You can use Stripe's official test cards in **test mode**. They only work with your Stripe test API keys.

### Successful payment (Visa)

- **Card number:** `4242 4242 4242 4242`
- **Expiry:** Any future date (e.g. `12/34`)
- **CVC:** Any 3 digits (e.g. `123`)
- **ZIP/Postal code:** Any valid value (e.g. `10001`)

### Authentication required (3D Secure)

- **Card number:** `4000 0025 0000 3155`
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any value

### Card declined

- **Card number:** `4000 0000 0000 0002`
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any value

### Insufficient funds

- **Card number:** `4000 0000 0009 9995`
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any value

### Expired card

- **Card number:** `4000 0000 0000 0069`
- **Expiry:** Any past date (or use Stripe's test scenario)
- **CVC:** Any 3 digits
- **ZIP:** Any value

### Incorrect CVC

- **Card number:** `4000 0000 0000 0127`
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any value

These cards are safe to use because they are **official Stripe test cards** and do not represent real payment accounts.

If you're testing subscriptions, Payment Intents, or Stripe Checkout, let me know which integration you're using and I can recommend the most relevant test cards for those flows.
