# Overbet Project Context

A betting/poker application built as a Node.js monorepo using Turborepo and pnpm workspaces.

## Stack
- **Monorepo Manager**: Turborepo
- **Package Manager**: pnpm
- **Frontend**: Next.js (React 19, Tailwind CSS 4) in `apps/web`
- **Database**: Prisma in `packages/db`
- **Game Engine**: Custom poker engine in `packages/engine`
- **Testing**: Vitest
- **Linting/Formatting**: ESLint, Prettier

## Scripts & Tooling
- `pnpm dev`: Run all apps/packages in development mode via Turbo.
- `pnpm build`: Build all projects via Turbo.
- `pnpm test`: Run tests using Vitest (at root or per-package).
- `pnpm lint`: Run ESLint via Turbo.
- `pnpm format`: Format code using Prettier.
- `pnpm generate`: Generate Prisma client (in `packages/db`).

## Code Conventions
- **TypeScript**: Used throughout the project.
- **Styling**: Tailwind CSS 4 utility-first approach.
- **Database**: Use Prisma Client for all DB operations.
- **Game Logic**: Core betting/poker logic should reside in `@overbet/engine`.

## Directory Structure
- `apps/web`: The Next.js web application.
- `packages/db`: Database schema (Prisma) and client.
- `packages/engine`: Core game engine and logic.
