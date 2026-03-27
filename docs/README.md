# Documentation Layout

This repository keeps active documentation in `docs/` and preserves historical material in explicit archive locations.

## Active Documentation

- `docs/design/`
  - Long-lived design references and visual system docs.
- `docs/specs/`
  - Product, protocol, and implementation specs kept for reference.

These folders are the right place for durable project documentation that may still inform work, but should not be treated as more authoritative than current code.

## Archived Documentation

- `docs/archive/planning/`
  - Historical sprint plans, prompts, and planning material.
- `docs/archive/reports/`
  - Checked-in reports worth preserving for historical context.

Archive docs when they describe completed work, superseded plans, or one-off reporting that should not live at the repository root.

## Artifact Storage

- `artifacts/verification/`
  - Preserved command logs, stdout captures, and other machine-generated verification outputs.

Artifacts belong here when they are intentionally kept in the repository for audit/history purposes. Do not scatter generated outputs across feature folders or ad hoc root directories.

## Archived Tooling State

- `.archive/serena/`
  - Archived Serena project configuration and memory history.

This location is for preserved tool state, not active product code or user-facing documentation.

## Root-Level Rules

Keep the repository root limited to:
- active entry-point docs such as `README.md`, `DEPLOYMENT.md`, and `AGENTS.md`
- workspace/package configuration files
- actual source/test/application directories

Do not add:
- completed sprint plans at the root
- generated reports at the root
- one-off logs under random project folders
- duplicate tool/skill directories

## Cleanup Guidance

When adding new non-code material:
- put active reference docs in `docs/design/` or `docs/specs/`
- put historical material in `docs/archive/...`
- put preserved generated output in `artifacts/...`
- keep hidden tool state under a single dedicated location instead of duplicating it across `.agent/`, `.pi/`, and other folders
