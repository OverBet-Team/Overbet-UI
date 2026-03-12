# Deploy: Step by Step

Deploy **gateway first**, then **web**. Use your existing Supabase DB URLs/keys.

---

## 1. Run migrations locally

```bash
cd /path/to/Manus-Poker
pnpm --filter @overbet/db generate
pnpm --filter @overbet/db db:push
```

Use your Supabase Postgres URL in `packages/db/.env` (or env) as `DATABASE_URL` / `DIRECT_URL` if Prisma asks.

---

## 2. Deploy gateway (Render)

1. [render.com](https://render.com) → **New** → **Web Service**
2. Connect repo → select **ColtFourtyFive/Overbet-UI** (or this repo).
3. On the **Configure** step, fill the form:

| On the page (label) | Enter this |
|---------------------|------------|
| **Name** | `manus-poker-gateway` (or keep Overbet-UI) |
| **Language** | Node *(already set)* |
| **Branch** | `main` *(already set)* |
| **Region** | Oregon or your choice |
| **Root Directory** | Leave blank |
| **Build Command** | Replace with: `corepack enable && NODE_ENV=development pnpm install && npx prisma@5.22.0 generate --schema=packages/db/prisma/schema.prisma && NODE_ENV=production pnpm --filter @overbet/gateway build` |
| **Start Command** | Replace with: `node apps/gateway/dist/index.js` |
| **Instance Type** | Free *(already set)* |

4. **Environment Variables** (same page, scroll down):
   - Click **Add Environment Variable** for each row below.

| NAME_OF_VARIABLE (key) | value |
|------------------------|--------|
| `DATABASE_URL` | Your Supabase **direct** Postgres URL (e.g. value of `DB_POSTGRES_URL_NON_POOLING`) |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | Leave empty for now; add after step 4. |

5. Leave **Health Check Path**, **Pre-Deploy Command**, **Build Filters** as default. Click **Create Web Service** (or **Deploy**).
6. Wait for deploy → copy the service URL (e.g. `https://manus-poker-gateway.onrender.com`).

---

## 3. Deploy web (Vercel)

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import this repo
2. **Settings** → **General** → **Node.js Version** → set to **20.x**. (If you see `ERR_INVALID_THIS`, use 20.x and the Install Command below.)
3. Build settings (or use `vercel.json`):

| Field | Value |
|-------|--------|
| Framework | Next.js |
| Root Directory | *(blank)* |
| Build Command | `npx prisma@^5.10.0 generate --schema=packages/db/prisma/schema.prisma && turbo run build --filter=web` |
| Output Directory | `apps/web/.next` |
| Install Command | `corepack enable && pnpm install` *(uses pnpm from package.json to avoid ERR_INVALID_THIS)* |

4. **Settings** → **Environment Variables** → Add (Production, Preview, Development):

| Key | Paste value of |
|-----|-----------------|
| `NODE_VERSION` | `20` *(so build uses Node 20)* |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` *(optional; ensures Corepack uses pnpm version from package.json)* |
| `DATABASE_URL` | Your Supabase **pooled** Postgres URL (e.g. `DB_POSTGRES_PRISMA_URL` or `DB_POSTGRES_URL`) |
| `DIRECT_URL` | Your Supabase **direct** Postgres URL (e.g. `DB_POSTGRES_URL_NON_POOLING`) |
| `NEXT_PUBLIC_GATEWAY_URL` | The Render gateway URL from step 2 (no trailing slash) |

5. **Deploy** → wait → copy the Vercel URL (e.g. `https://xxx.vercel.app`).

---

## 4. Set gateway CORS

1. Render → your gateway service → **Environment**
2. Set `ALLOWED_ORIGINS` = your Vercel URL from step 3 (e.g. `https://xxx.vercel.app`). For previews too: `https://xxx.vercel.app,https://*.vercel.app`
3. **Save** → trigger a redeploy.

---

## 5. Verify

- Open Vercel URL → create room → open room
- Join room, request seat, host approves, start game, fold/call/raise

---

## Quick reference: where each value goes

| Where | Variable | Use value from |
|-------|----------|----------------|
| **Vercel** | `DATABASE_URL` | Supabase pooled URL (`DB_POSTGRES_PRISMA_URL` / `DB_POSTGRES_URL`) |
| **Vercel** | `DIRECT_URL` | Supabase direct URL (`DB_POSTGRES_URL_NON_POOLING`) |
| **Vercel** | `NEXT_PUBLIC_GATEWAY_URL` | Render gateway URL (step 2) |
| **Render** | `DATABASE_URL` | Same Supabase direct URL (`DB_POSTGRES_URL_NON_POOLING`) |
| **Render** | `ALLOWED_ORIGINS` | Vercel app URL (step 3) |
