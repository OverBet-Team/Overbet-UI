# Manus Poker Deployment Guide: Vercel (Web) + Render (Gateway)

## Overview

| Component | Platform | Purpose |
|-----------|----------|---------|
| **Next.js web app** | Vercel | UI, room creation, room loading |
| **Gateway** (Express + Socket.IO) | Render | Real-time gameplay (join, seat, actions) |
| **PostgreSQL** | Neon or Supabase | Database for both services |

```mermaid
flowchart LR
  subgraph User [User Browser]
    UI[Next.js UI]
  end

  subgraph Vercel [Vercel]
    Web[Web App]
    ServerActions[Server Actions]
  end

  subgraph Render [Render]
    Gateway[Gateway]
  end

  subgraph DB [Neon or Supabase]
    Postgres[(PostgreSQL)]
  end

  UI --> Web
  UI -->|Socket.IO| Gateway
  ServerActions --> Postgres
  Gateway --> Postgres
```

**Important:** Deploy the gateway on Render first, then deploy the web app on Vercel. You need the gateway URL to configure `NEXT_PUBLIC_GATEWAY_URL` for the web app.

---

## Part 1: Accounts and Services

### 1.1 Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Sign up with GitHub, GitLab, or Bitbucket
4. Grant access to your repository

### 1.2 Render

1. Go to [render.com](https://render.com)
2. Click **Get Started**
3. Sign up with GitHub (or email)
4. Connect your GitHub account if needed

### 1.3 Neon (PostgreSQL)

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub or email
3. Create a new project (e.g. "manus-poker")
4. In **Connection Details**, copy:
   - **Pooled connection string** (`postgresql://...?sslmode=require`) → use as `DATABASE_URL`
   - **Direct connection string** (Neon often shows both) → use as `DIRECT_URL`

**Alternative:** [Supabase](https://supabase.com) or [Render Postgres](https://render.com/docs/databases) work the same way. Use the connection strings they provide for `DATABASE_URL` and `DIRECT_URL`.

---

## Part 2: Database Setup

### 2.1 Prisma connection strings

- **`DATABASE_URL`** — pooled or primary connection string
- **`DIRECT_URL`** — direct (non-pooled) connection string for migrations

For Neon, both are usually shown in the dashboard. For Supabase, use the pooler URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`.

### 2.2 Run migrations locally

Before deploying, apply the schema to your database:

```bash
cd /path/to/Manus-Poker
pnpm --filter @overbet/db generate
pnpm --filter @overbet/db db:push
# Or, for production migrations: pnpm --filter @overbet/db db:migrate deploy
```

---

## Part 3: Deploy Gateway on Render

### 3.1 Create Web Service (manual)

1. **Render Dashboard** → **New** → **Web Service**
2. Connect your repository (if not already connected)
3. Select your Manus Poker repository
4. Configure:

| Field | Value |
|-------|-------|
| **Name** | `manus-poker-gateway` |
| **Region** | Choose closest region |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | *(leave blank – monorepo root)* |
| **Runtime** | `Node` |
| **Build Command** | `corepack enable && pnpm install && pnpm --filter @overbet/db generate && pnpm --filter @overbet/gateway build` |
| **Start Command** | `node apps/gateway/dist/index.js` |
| **Instance Type** | Free |

### 3.2 Environment variables (Render)

In the service **Environment** tab, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon/Supabase direct connection string |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | Your Vercel URL, e.g. `https://manus-poker-xxx.vercel.app` (add this after you deploy the web app; you can add it later and redeploy the gateway) |

**Note:** Render sets `PORT` automatically; the gateway uses `process.env.PORT || 4000`.

### 3.3 Deploy

1. Click **Create Web Service**
2. Wait for the first deploy to complete
3. Copy the service URL (e.g. `https://manus-poker-gateway.onrender.com`)

### 3.4 Blueprint (alternative)

If your repo has `render.yaml`, you can use **New** → **Blueprint** and connect the repo. You will still need to set `DATABASE_URL` and `ALLOWED_ORIGINS` in the Environment tab.

---

## Part 4: Deploy Web App on Vercel

### 4.1 Import project

1. **Vercel Dashboard** → **Add New** → **Project**
2. Import your Manus Poker repository
3. Configure (or rely on `vercel.json`):

| Field | Value |
|-------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | *(leave blank)* |
| **Build Command** | `npx prisma@^5.10.0 generate --schema=packages/db/prisma/schema.prisma && turbo run build --filter=web` |
| **Output Directory** | `apps/web/.next` |
| **Install Command** | `pnpm install` |

### 4.2 Environment variables (Vercel)

Go to **Project** → **Settings** → **Environment Variables** and add:

| Key | Value | Environment |
|-----|-------|-------------|
| `DATABASE_URL` | Neon/Supabase pooled connection string | Production, Preview, Development |
| `DIRECT_URL` | Neon/Supabase direct connection string | Production, Preview, Development |
| `NEXT_PUBLIC_GATEWAY_URL` | Your gateway URL, e.g. `https://manus-poker-gateway.onrender.com` | Production, Preview, Development |

Do not add a trailing slash to `NEXT_PUBLIC_GATEWAY_URL`.

### 4.3 Deploy

1. Click **Deploy**
2. Wait for the build to finish
3. Copy the Vercel URL (e.g. `https://manus-poker-xxx.vercel.app`)

### 4.4 Update gateway CORS

After the first Vercel deploy, add or update `ALLOWED_ORIGINS` in the Render gateway service:

- Value: `https://manus-poker-xxx.vercel.app` (your actual Vercel URL)
- For multiple origins (including preview deploys): `https://manus-poker-xxx.vercel.app,https://*.vercel.app`

Then redeploy the gateway so the change takes effect.

---

## Part 5: CORS on the Gateway

The gateway uses the `ALLOWED_ORIGINS` environment variable to restrict which origins can connect via Socket.IO:

- **Unset (local dev):** Allows all origins (`*`)
- **Production:** Set to your Vercel URL(s), comma-separated if needed

Example:

```
ALLOWED_ORIGINS=https://manus-poker-xxx.vercel.app
```

For preview deployments:

```
ALLOWED_ORIGINS=https://manus-poker-xxx.vercel.app,https://*.vercel.app
```

---

## Part 6: Post-Deploy Checks

### 6.1 Web app

- [ ] Home page loads
- [ ] Create room works (uses Prisma)
- [ ] Room page loads (uses `getRoom` server action)

### 6.2 Gateway (real-time gameplay)

- [ ] Join room via Socket.IO
- [ ] Seat request
- [ ] Host approves
- [ ] Start game
- [ ] Actions (fold, call, raise) work

### 6.3 Render free tier

- Services spin down after ~15 minutes of inactivity
- First request after spin-down can take ~30 seconds
- If the web app connects during cold start, you may see timeouts; retry once the gateway is awake

---

## Part 7: Summary

### Flow

1. User opens Vercel URL → Next.js loads
2. Create room → Prisma writes to Neon/Supabase
3. Open room → `getRoom` loads data from the database
4. Room page connects to the gateway via `NEXT_PUBLIC_GATEWAY_URL`
5. Socket.IO handles real-time gameplay
6. Gateway uses Prisma to read/write the database

### URLs to keep

| Service | Example URL |
|---------|-------------|
| Web | `https://manus-poker-xxx.vercel.app` |
| Gateway | `https://manus-poker-gateway.onrender.com` |
| Database | From Neon/Supabase dashboard |

### Environment variables

| Platform | Variable | Example |
|----------|----------|---------|
| Vercel | `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` |
| Vercel | `DIRECT_URL` | Same format as above |
| Vercel | `NEXT_PUBLIC_GATEWAY_URL` | `https://manus-poker-gateway.onrender.com` |
| Render | `DATABASE_URL` | Same as Vercel |
| Render | `NODE_ENV` | `production` |
| Render | `ALLOWED_ORIGINS` | `https://manus-poker-xxx.vercel.app` |

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| "Unable to connect" or Socket errors | `NEXT_PUBLIC_GATEWAY_URL` is correct, uses `https://`, no trailing slash |
| Room creation fails | `DATABASE_URL` and `DIRECT_URL` on Vercel; migrations applied |
| Gateway crashes on start | `DATABASE_URL` on Render; check Render logs |
| Slow first action after idle | Render cold start on free tier; wait ~30 seconds |
| CORS errors | `ALLOWED_ORIGINS` on Render includes your Vercel URL |
| Vercel build fails | Build command runs Prisma generate; `pnpm install` succeeds |
| Render build fails | `corepack enable` before `pnpm`; Node 20 recommended |
