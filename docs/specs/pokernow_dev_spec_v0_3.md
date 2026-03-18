OverBet --- Build a Better Poker Now (Offsuit UI)\
Product + Engineering Specification • Combined Full Dev Doc (0 → 100)

Main vision (non-negotiable)

- The goal is to make the better Poker Now.

- UI inspiration: Offsuit --- clean, minimalistic, satisfying, modern.

- Target users: "degens" who play online poker daily with friends (fast
  sessions, frequent games, high repeat usage).

- Offer everything Poker Now offers (documented parity) + more:

  - Club-based communities

  - Persistent PnL tracking + leaderboards (all-time + time windows)
    across club members

  - Payout ledgers automatically calculated at end of games (settlement
    plan: who owes who)

  - Premium/Plus feature: Modding platform --- users can upload custom
    "mods" (packages) that define custom rule-sets beyond standard
    NLH/PLO family, safely.

Executive summary\
OverBet is a browser-first, real-time home-game poker platform inspired
by Poker Now, but built with:

- Offsuit-grade minimal UI + better mobile UX

- Stronger reliability (reconnect-first, no desync)

- Trust (auditable randomness, immutable audit log)

- Accounting as a first-class feature (auto PnL + settlement)

- Clubs + leaderboards (persistent community layer)

- Extensibility (modifiers/plugins; Plus mod packs)

This spec is a build-from-zero blueprint: what to build, how it behaves,
how it is implemented, and how to execute from MVP to full product (0 →
100).

Product scope\
Primary (v1)

- Play-money private home games with a shareable link (Poker Now-style).

- Variants: NLH, PLO HI, PLO8, PLO5.

- Modifiers (standard): rabbit hunting, live straddle, ante,
  run-it-twice.

- Premium modifiers: bomb pots, double board, 7-2 bounty (Plus).

- Session ledger + PnL + auto settlement exports (core differentiator).

- Clubs: persistent groups, roles, scheduled games, all-time PnL
  leaderboards.

Secondary (later in v1/near 100%)

- Sit & Go + private multi-table tournaments (MTT).

- Provably-fair verification bundle + basic anti-collusion signals.

- Enhanced replayer + searchable hand history archive.

Non-goals (v1)

- Real-money betting, rake collection, deposits/withdrawals, gambling
  compliance flows.

- Mixed games beyond Hold'em/Omaha family (Stud/Draw/OFC/etc.).

- Bots/AI opponents (analysis tools may exist; not opponents).

- Payments processing (we can generate settlement suggestions only).

Definition of done (100%)

- Poker Now parity for documented features + stable tournaments + clubs.

- Mobile-first UI fully usable on a phone.

- Provably-fair shuffle verification + host audit log + basic
  anti-collusion warnings.

- Hand history + replayer + ledger exports are production-grade.

- SLOs met: no desyncs, fast reconnect, measurable p95 latency targets.

Table of contents

1.  Product goals and principles

2.  Personas and core flows

3.  Feature set (Poker Now parity)

4.  Better-than differentiators

5.  UX specification (Offsuit-level)

6.  Requirements (FR/NFR)

7.  System architecture

8.  Real-time protocol

9.  Game engine specification

10. Game configuration schema

11. Tournaments + clubs (detailed)

12. Data model

13. Analytics, ledger, hand history

14. Security, integrity, anti-cheat

15. Dev process, repo, CI/CD

16. Execution plan (0 → 100)

17. Test strategy\
    Appendices (sources, settings, glossary)

<!-- -->

1.  Product goals and principles

Goals

- Instant home-game creation: room in seconds, link-share join.

- Deterministic realtime gameplay: server-authoritative state machine,
  zero desync.

- Trust: auditable randomness, explicit permissions, visible spectator
  status.

- Extensibility: new variants/modifiers via plugin hooks and config
  schemas.

- Delight: Offsuit-style UI, fast actions, great mobile experience.

- Accounting superiority: automatic PnL + settlement at end of every
  session; club-level PnL continuity.

Principles

- Server is the source of truth; clients submit intents only.

- Event sourcing for every hand: immutable events → replayable state.

- All actions validated: phase, actor, stack, min/max bet rules.

- Reconnect is first-class: snapshots + catch-up events.

- Least-privilege permissions + immutable audit log.

- "Never lose the math": ledger entries are explicit and versioned.

- Minimal UI: no casino clutter; dense but calm information hierarchy.

2\) Personas and core flows

Personas\
Host

- Create/manage room, approve seats, tune settings, pause/stop/resume,
  export ledger/logs.

Player

- Join by link, request seat, buy-in, play, adjust personal prefs,
  review hands, confirm/dispute ledger.

Spectator

- Watch; hole-card visibility only if explicitly enabled + granted.

Club Admin

- Manage members, roles, seasons, club rules, leaderboards, scheduled
  games.

Tournament Director

- Configure structures, registration/check-in, balancing, pause/resume,
  payouts export.

Core flows (must be flawless)

- Create room → configure → share link → seat approvals → start dealing.

- Join → identity → request seat → buy-in → play → cash out.

- Reconnect mid-hand → resume action without missing state.

- Host pause / stop-next-hand → resume later with correct button + blind
  positions.

- End session → auto ledger + net PnL → auto settlement plan → exports +
  confirmations.

- Club: sessions roll up into persistent player stats and all-time PnL
  leaderboards.

- Tournament: create → registration/check-in → start → balancing →
  payouts + report.

3\) Feature set (Poker Now parity)

3.1 Variants (Hold'em / Omaha family)

- NLH (No-Limit Hold'em)

- PLO HI (Pot-Limit Omaha Hi)

- PLO8 (Omaha Hi/Lo 8-or-better)

- PLO5 (5-card Omaha)

Note: Pineapple is not required for parity based on Poker Now's listed
supported variants.

3.2 Modifiers / game spice (parity + premium)\
(Each modifier should be implemented via engine hooks: HandInit /
Streets / Showdown / PostHand)

Ante

- Per-hand ante collected from all seated players.

Live straddle

- Optional pre-deal blind raise (classic UTG 2x BB supported).

- Also support "Auto Straddle 2 BB when UTG?" as a player preference
  (only if host enables straddle).

Rabbit hunting

- Reveal undealt streets after early hand termination.

- Each seated player may press "Reveal".

Run it twice (cash)

- If all-in before river: deal remaining board twice; split pot across
  runs.

- Allowed variants: NLH and PLO HI.

Bomb pots (premium/Plus)

- Everyone antes; flop dealt immediately; action starts on flop.

- Config: frequency/probability (1--100%), sizing = BB multiple.

Double board (premium/Plus)

- Two boards; pot split by board; scoop possible.

7-2 bounty (premium/Plus)

- Win with 7-2 → collect bounty from each opponent; must show to
  collect.

3.3 Roles, permissions, anti-chaos

- Seat requests with host approval/rejection.

- Spectator mode: explicit indicator; hole cards only when enabled and
  granted.

- Config visibility: anyone can view; only owner/host can edit; all
  edits audited.

3.4 Gameplay operations

- Pause

- Disable auto-deal

- Stop after next hand (safe stop)

- Seat reshuffle after stoppage (optional)

- Respect "deal hands to away/offline players?" setting

3.5 Ledger, logs, replay (parity baseline)

- Session ledger (buy-in/cash-out + net).

- Ledger CSV export + sortable columns.

- Full session log export (JSONL/NDJSON).

- Hand history archive + enhanced replayer (filters, net earnings).

4\) Better-than differentiators (how we win)

4.1 Clubs-first communities (core differentiator)

- Clubs as persistent communities with:

  - membership, roles, invite controls, bans

  - seasons and scheduled events (weekly games)

  - room presets (default variant/modifiers, buy-in norms, timebanks)

  - persistent identities per club (aliases, avatar, notes)

- Club moderation panel:

  - approvals queue, quick kick/ban, seat-lock, policy toggles

  - audit log of admin actions

4.2 Persistent PnL + leaderboards (all-time)

- All-time PnL leaderboard per club (primary value prop).

- Time windows: 7d / 30d / season / custom.

- Metrics:

  - net PnL (unit-of-account)

  - BB won, BB/100 (optional)

  - optional poker stats (VPIP/PFR/3bet/showdown/aggression)

- Filters:

  - cash vs tournament

  - variant/mod pack

  - stakes

  - date range

  - table size

- Rivalries:

  - head-to-head PnL between two players within a club

4.3 Auto payout ledger at end of games (settlement matrix)\
Cash sessions

- Automatic PnL computation from:

  - explicit buy-ins/top-ups/add-ons

  - explicit cash-outs

  - final stack at end/leave

- Generate a settlement plan (who pays whom) minimizing number of
  transfers.

- Exports:

  - CSV

  - shareable link

  - "copy payment list" for Venmo/PayPal/Cash App messaging

- Confirm/dispute flow:

  - host approves final version

  - players can confirm or dispute

  - edits are versioned + auditable

Tournaments

- Automatic PnL from entries/re-entries/add-ons and final payouts.

- Support chops/ICM by allowing host-edited payout ledger.

4.4 Trust & integrity upgrades

- Provably fair shuffles: commit-reveal per hand + downloadable
  verification bundle.

- Host action audit log + "who changed what" UI.

- Spectator/stream safety: explicit badge + per-user permissions.

- Anti-collusion warnings (warnings, not bans by default):

  - IP clustering, chip-dumping heuristics, soft-play heuristics.

4.5 UX upgrades (Offsuit-level)

- Mobile-first layout: thumb-friendly actions, collapsible panels.

- Fast bet sizing: presets + slider + numeric entry.

- Accessibility: keyboard controls, screen reader labels, color-blind
  palettes.

- Low bandwidth mode: reduces animations/payloads.

4.6 Plus Feature: Modding platform (custom game packages)\
Goal

- Let users create and upload "mods" that define custom rule-sets beyond
  standard NLH/PLO family---safely.

What a mod can change

- Rules toggles: forced straddles, bring-ins, kill pots, alternate
  button rules, bomb-pot triggers.

- Betting structure: caps, fixed-limit-like caps, custom timebanks,
  custom blind schedules.

- Dealing mechanics: custom run-it-twice policy, rabbit-hunting policy,
  board variants.

- Side games: 7-2 bounty variants, stand-up-game style rules.

- UI affordances: action presets, labels, in-game rule reminders.

Non-negotiables (security/fairness)

- No arbitrary server code execution.

- Deterministic outcomes: same seed + events → same replay.

- No network/file access; strict CPU/memory/time limits.

- No randomness beyond platform RNG.

- Signed packages + version pinning per room.

Implementation approach\
Tier 1 (ship first): Declarative Rules DSL (JSON/YAML)

- Server validates + interprets; safe, quick to ship.

Tier 2 (later): WASM sandbox with strict hooks

- Limited hooks: action validation, pot split/scoring, payouts.

- Strict resource constraints, deterministic runtime.

Mod package format (example)

- mod.json manifest:

  - id, name, description, author

  - base_variant: NLH \| PLO_HI \| PLO8 \| PLO5 \| custom

  - rules: {...} (DSL)

  - ui: { presets, labels, help_text }

  - tests: \[hand_scenarios...\] (recommended)

  - version, changelog

  - permissions: club_only \| public_marketplace

  - signature: signed_by_platform true/false

Upload + distribution flow

- Creator builds locally (CLI) → upload → platform validation +
  deterministic tests.

- Public mods: review + platform signing.

- Club-only mods: admin approval + optional signing.

- Room binds immutable (mod_id, mod_version) once game starts.

- Telemetry for stability + disputes; rollback/deprecate supported.

5.  UX specification (screens + requirements)

Screens\
Landing

- Start new game, join by link, community, clubs, help

Create game

- Variant + blinds + buy-in + access + modifiers + preset + (optional)
  club context

Lobby

- Seat requests, chat, players list, settings, start/pause/stop, ledger
  preview

Table

- Minimal felt, seats, board(s), pot(s), action controls, timers, chat
  drawer

Ledger

- Transactions, net, settlement plan, exports, confirm/dispute

Replayer

- Step-through events, filters, net outcomes

Tournament dashboard

- Structure, registration/check-in, balancing, payouts

Club admin

- Members, roles, wallet/ledger rules, logs, scheduled events,
  leaderboards

Player settings

- Deck colors, units, sound, timebank, gesture visibility, warnings

Table UI requirements (desktop)

- Always visible: pot, board, button, blinds, street, active player
  highlight

- Actions: Fold/Check/Call/Bet/Raise with min/max + presets

- Acting player timer always visible

- Chat docked + collapsible, new message indicator + beep toggle

Table UI requirements (mobile)

- Actions anchored at bottom with large tap targets; bet slider in
  bottom sheet

- Chat and seat list as drawers; swipe navigation

- Low bandwidth mode supported

6.  Requirements (FR/NFR)

Functional requirements

- Room creation and link-based joining (guest + optional account).

- Seat requests/approvals; buy-in/cash-out; sit out/away.

- Authoritative NLH + PLO family gameplay with timebanks and reconnect
  correctness.

- Modifiers: ante, straddle, rabbit hunting, run-it-twice; premium: bomb
  pots, double board, 7-2 bounty.

- Spectator mode with explicit indicator and permission gating.

- Chat + gestures with player visibility settings.

- Ledger + settlement matrix + CSV export; session event log export.

- Hand history archive + replayer (filters + net outcomes).

- Sit & Go + MTT + check-in/invites; clubs + roles + logs +
  leaderboards.

- Audit log for host/admin actions.

- Plus mod platform (DSL first; WASM later).

Non-functional requirements

- Latency: p95 action-to-broadcast \< 150ms (regional).

- Consistency: server authoritative; deterministic replay.

- Reconnect \< 2s typical broadband.

- 99.9% monthly uptime for core services.

- Scale: 10k rooms / 100k sockets via horizontal scaling.

- Security: TLS, rate limits, least privilege, audit, replay protection.

- Observability: logs/traces/metrics with alerts for event lag/desync.

7.  System architecture

Services\
Web (Next.js)

- UI, auth, routing, renderer, replayer

Realtime gateway

- WSS termination, auth, room routing, fanout

Game service

- State machine, rules, RNG, hand event stream

Tournament service

- Registration/check-in, balancing, payouts

Club service

- Membership, roles, leaderboards, policies

Ledger/Analytics service

- Ledger aggregation, settlement computation, exports, indexing

Infra dependencies

- Postgres (Supabase): core data + ledger entries + clubs + audit logs

- Redis: presence, rate limiting, ephemeral routing/session state

- Object storage (S3): exports, replay bundles, logs

- Observability stack: metrics + tracing + logs

Reference diagram (conceptual)\
Clients\
\| HTTPS \| WSS\
v v\
\[Next.js Web\] \[Realtime Gateway\] \<-\> \[Redis\]\
\| REST/GraphQL \|\
v v\
\[APIs\] \[Game Service\] \<-\> \[Postgres\]\
\|\
v\
\[S3 Exports\]

8.  Real-time protocol

Core idea

- Client sends INTENT\_\* (requests).

- Server emits EVENT\_\* (authoritative updates) with server sequence
  numbers.

- Idempotency: client_msg_id ensures safe retries.

- Reconnect: snapshot + incremental catch-up events.

Example intent\
{\
\"type\":\"INTENT_PLAYER_ACTION\",\
\"schema_version\":1,\
\"room_id\":\"r_abc123\",\
\"hand_id\":\"h_45\",\
\"client_msg_id\":\"cmsg_x\",\
\"action\":{\"kind\":\"RAISE\",\"amount\":240}\
}

9.  Game engine specification

State machine phases\
HAND_INIT → POST_BLINDS_ANTES → DEAL_PRIVATE → BETTING/STREETS →
SHOWDOWN → PAYOUT → CLEANUP

Server-authoritative rules

- Validate actor (whose turn), phase, stack, min/max bet rules, betting
  structure constraints.

- Reject illegal actions; emit reason codes for client UX.

- Support timebank and auto-actions (auto-fold/check) based on rules.

Randomness (better-than)

- CSPRNG seeds.

- Commit-reveal:

  - Publish commit hash at hand start.

  - Reveal seed after hand end.

  - Provide downloadable verifier bundle (events + commits + reveals)
    for audit.

Plugin hooks (for modifiers/mods)

- HandInit / Streets / Showdown / PostHand

- Plugins can:

  - apply forced posts (ante/bomb)

  - alter board dealing (double-board)

  - alter payout handling (run-it-twice)

  - compute bounties (7-2)

- Server always enforces; client only renders.

10. Game configuration schema

RoomConfig (example)\
RoomConfig {\
variant,\
max_players,\
blinds,\
buyin,\
ante,\
straddle,\
timebank,\
auto_deal,\
deal_to_away,\
spectator,\
run_it_twice,\
rabbit_hunting,\
bomb_pots,\
double_board,\
seven_two_bounty,\
club_id (optional),\
mod_id/mod_version (optional, Plus),\
created_by,\
updated_at,\
config_version\
}

Config rules

- Anyone can view config; only owner/host can edit.

- Every change writes to audit_log with diff + actor + timestamp.

11. Tournaments + clubs (detailed)

11.1 Tournament essentials (Sit & Go + MTT)

- Registration approvals; invitation codes optional; check-in windows
  optional.

- Balancing algorithm; blind schedule; late reg and re-entries;
  pause/breaks.

- Exports: payouts report, standings, event logs.

- Tournament Director panel:

  - start/pause/resume, re-entry approvals, table balancing, payout
    editing, exports.

11.2 Clubs essentials (persistent communities)

- Roles: owner/admin/mod/member

- Membership policies: invite-only, approval queue, invite codes

- Scheduled games: calendar-like creation, RSVP, reminders

- Club stats:

  - all-time PnL leaderboards

  - season tracking

  - rivalry view

- Club policies:

  - ledger rules (who can record buy-ins/cash-outs)

  - mod allowances (club_only mods, approved public mods)

  - default room presets

12. Data model (high level)

Core tables (minimum)

- users

- rooms

- room_members

- seat_requests

- seats

- hands

- hand_events (append-only)

- ledger_entries (append-only + version references)

- settlements (computed plans + versions)

- tournaments

- tournament_players

- tournament_tables

- clubs

- club_members

- club_leaderboard_snapshots

- audit_log

Mod platform tables (Plus)

- mod_packages

- mod_versions

- club_allowed_mods

- room_mod_bindings

13. Analytics, ledger, hand history

Ledger system (first-class)

- Ledger entries capture:

  - buy-in

  - top-up/add-on

  - cash-out

  - admin adjustment

  - fee/penalty (optional)

- Every ledger mutation is audited and versioned.

PnL definitions\
Cash:\
PnL_cash(player) =\
(cash_out_value + final_stack_value)

- (sum(buy_in_value) + sum(add_on_value))

- (optional fees/penalties)

Tournament:\
PnL_tourney(player) =\
(prize_payout_value)

- (entry_fee + re_entries + add_ons)

- (optional fees)

Settlement plan (min transfers)

- Compute net balances; split into creditors and debtors.

- Greedy matching to minimize transfer count.

- Deterministic ordering so everyone sees same plan.

- Exports: CSV, JSON, "copy payment list".

Hand history + replayer

- Event-sourced by default.

- Snapshots every N events for fast replay and reconnect.

- Replayer features:

  - step-through events

  - filters (big pots, net outcomes)

  - searchable archive (Plus tiers can expand retention)

14. Security, integrity, anti-cheat

Security baseline

- TLS everywhere

- JWT/session auth

- Rate limits (per IP, per user)

- Replay protection (client_msg_id idempotency)

- Least-privilege permissions model

- Immutable audits for all host/admin actions

Integrity

- Provably fair commit-reveal shuffles

- Explicit spectator indicator + permission gating

- Encrypted/private card delivery (server-to-client only; never
  broadcast hole cards unless authorized)

Anti-collusion (warnings)

- IP clustering

- chip-dumping heuristics

- soft-play heuristics

- produce warnings + review tools, not automatic bans by default

15. Dev process, repo, CI/CD

Monorepo layout (suggested)\
/apps\
/web (Next.js)\
/gateway (WSS)\
/game (engine/service)\
/tournament\
/club\
/packages\
/proto (schemas)\
/poker-core (hand eval, rules)\
/ui (design system)\
/infra\
/docs

CI/CD

- lint + typecheck + unit tests + engine golden tests

- preview deploys per PR

- load test gates for realtime performance regressions

16. Execution plan (0 → 100)

Phase 0 → 20 (Foundation)\
Goal

- Prove realtime + core state sync with Offsuit-level UI shell.\
  Deliverables

- Repo/CI, room create/join, WSS gateway, presence, snapshots, NLH
  skeleton.

Phase 20 → 50 (MVP)\
Goal

- Play NLH cash reliably; ledger v1 with exports.\
  Deliverables

- Seating/approvals, chat, timebank, reconnect, pause/stop-next-hand,
  ledger (buy-in/cash-out), net PnL, CSV export, session logs export.

Phase 50 → 75 (Parity)\
Goal

- Poker Now parity for variants + standard modifiers.\
  Deliverables

- PLO HI/PLO8/PLO5, spectator mode, rabbit hunting, straddle/ante,
  run-it-twice, away logic controls.

Phase 75 → 90 (Premium + Clubs)\
Goal

- Clubs become the retention loop; premium spice features land.\
  Deliverables

- Bomb pots/double board/7-2 bounty, clubs + roles + scheduled games,
  all-time PnL leaderboards, rivalry view, enhanced replay filters.

Phase 90 → 100 (Tournaments + Trust + Polish)\
Goal

- Tournament readiness + provably fair + SLO hardening.\
  Deliverables

- Sit&Go/MTT, check-in/invites, tournament director tools, provably-fair
  verification bundles, audit UI, anti-collusion warnings, p95 latency
  targets and reconnect targets met.

100+ (Plus modding)

- Tier 1 DSL mods (club_only first)

- Mod review/signing pipeline

- Tier 2 WASM sandbox (advanced hooks)

- Public marketplace (optional; only if moderation and safety mature)

17. Test strategy

Rules engine correctness

- Unit tests for rules

- Property tests:

  - chip conservation

  - pot split correctness

  - side pot correctness

- Golden tests for hand evaluation across variants

Deterministic replay

- Event log rebuilds state exactly

- Snapshot + catch-up consistency

- Commit-reveal verification bundle tests

Realtime + scale

- Load tests: rooms/sockets, message throughput

- Latency budgets: p95 action-to-broadcast \< 150ms

- Chaos tests: disconnect storms, reconnection correctness

Ledger correctness

- PnL sums to zero (within rounding rules)

- Settlement plan totals match net balances

- Versioned disputes preserve audit trail

Appendix A --- Poker Now sources referenced (for parity validation)\
[[https://www.pokernow.com/\
](https://www.pokernow.com/)[https://network.pokernow.com/blog/2020-poker-now-recap\
](https://network.pokernow.com/blog/2020-poker-now-recap)[https://network.pokernow.com/blog/what-is-the-run-it-twice-feature\
](https://network.pokernow.com/blog/what-is-the-run-it-twice-feature)[https://network.pokernow.com/blog/what-is-the-rabbit-hunting-feature\
](https://network.pokernow.com/blog/what-is-the-rabbit-hunting-feature)[https://network.pokernow.com/blog/how-to-use-poker-now-spectator-mode\
](https://network.pokernow.com/blog/how-to-use-poker-now-spectator-mode)[https://network.pokernow.com/blog/update-january-11-2021\
](https://network.pokernow.com/blog/update-january-11-2021)[https://network.pokernow.com/blog/update-february-3-2021\
](https://network.pokernow.com/blog/update-february-3-2021)[https://network.pokernow.com/blog/exploring-bomb-pots-in-poker-a-burst-of-excitement-at-the-table\
](https://network.pokernow.com/blog/exploring-bomb-pots-in-poker-a-burst-of-excitement-at-the-table)[https://network.pokernow.com/blog/double-board-poker-on-poker-now\
](https://network.pokernow.com/blog/double-board-poker-on-poker-now)[https://network.pokernow.com/blog/the-7-2-game-in-poker-adding-a-twist-of-fun-to-the-classic-card-game\
](https://network.pokernow.com/blog/the-7-2-game-in-poker-adding-a-twist-of-fun-to-the-classic-card-game)[https://www.pokernow.com/subscription/plus\
](https://www.pokernow.com/subscription/plus)[https://www.pokernow.com/poker-now-coins\
](https://www.pokernow.com/poker-now-coins)[https://network.pokernow.com/blog/private-poker-multi-table-tournament\
](https://network.pokernow.com/blog/private-poker-multi-table-tournament)<https://network.pokernow.com/blog/managing-participation-invites-on-multi-table-tournament>]{.underline}

Appendix B --- Player preferences/settings inventory (player-level UI
prefs)

- Deck Style: Four Colors \| Two Colors

- Auto Straddle 2 BB when UTG?: Yes \| No (requires straddle enabled by
  host)

- Hide wins/re-entries badge: Yes \| No

- Hide achievement badges: Yes \| No

- Values display style: Big Blinds \| Formatted \| None (toggle BB with
  'b')

- Hide mood emoji: Yes \| No

- Disable secondary sound effects: Yes \| No

- Disable new chat beep: Yes \| No

- Run it twice (player pref): Yes \| No \| Ask each time

- Auto activate extra time: Yes \| No

- Hide hand review notification: Yes \| No

- Gestures visibility: Hide \| Sound Muted \| Show

- Show promotional content: Show \| Hide (Plus)

- Show quick accept warning: Show \| Hide

- Show video/voice enabled warning: Show \| Hide

Appendix C --- Glossary

Room\
A single poker table session accessed by link.

Hand\
One deal from blinds posting through payout.

Event sourcing\
Append-only event log used to rebuild state and replays.

Timebank\
Per-action timer plus optional extra-time bank.

Bomb pot\
Forced ante hand where action starts on the flop.

Double board\
Two boards dealt in parallel; pot split by board.

Run it twice\
Deal remaining community cards twice after an all-in to reduce variance.

Rabbit hunting\
Reveal undealt cards after a hand ends early.

Club\
Persistent community layer with leaderboards and policy controls.

Settlement plan\
Auto-generated "who owes who" list derived from final PnL.

Mod package\
A versioned ruleset package (DSL/WASM later) that defines custom game
behavior.
