# Testing Infrastructure Plan
- **Tech Stack**: Vitest, React Testing Library, Supertest, Socket.io-client.
- **Root Setup**: Monorepo workspace config (`vitest.workspace.ts`) with a global `pnpm test` script.
- **Engine Tests**: Migrate manual `test.ts` to `test/engine.test.ts` and `test/ledger.test.ts`.
- **Gateway Tests**: Add basic `socket.test.ts` using `supertest`.
- **Web Tests**: Basic component tests with React Testing Library.
- **DB Tests**: Basic Prisma mock/connection tests.
- **CI**: Github action for `pnpm test`.

The plan is available in `.agent/plan.json` for execution via `/orchestrate` or `/coordinate`.