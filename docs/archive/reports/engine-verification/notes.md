# Engine Verification Pass — Notes

## Assumptions
- Engine package at `packages/engine`
- `pnpm test` runs Vitest with default config
- No env vars required
- Simulation uses `BASE_SEED = 12345` and per-scenario offset (`playerCount * 1000`)

## How to Rerun
```bash
cd packages/engine
pnpm test -- test/simulation.test.ts   # simulation only
pnpm test                              # full suite
```

## Invariants Verified (per hand, post-action)
- Card integrity
- Board progression (0/3/4/5 by street)
- Chip conservation
- Turn validity
- Status sanity

## Risks Not Covered
- loadEvents replay fidelity
- 8–10 player tables
- Very large stacks / table stakes edge cases
