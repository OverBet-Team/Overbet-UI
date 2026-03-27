# apps/web/src — Source Structure

## Directory Map

```
src/
├── app/                        # Next.js App Router
│   ├── actions/
│   │   └── room.ts             # Server actions: createRoom, loadRoom (uses @overbet/db)
│   ├── room/[slug]/
│   │   ├── page.tsx            # Server component — loads room data, renders RoomClient
│   │   ├── RoomClient.tsx      # Main realtime client (Socket.IO, game state, UI orchestration)
│   │   └── README.md           # Room flow detail → read this before editing RoomClient
│   ├── HomeClient.tsx          # Lobby UI: room creation form, join-by-slug
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── page.tsx                # Root page — renders HomeClient
│   └── globals.css             # Tailwind base + CSS custom properties (design tokens)
│
├── components/
│   ├── poker/                  # Poker-specific UI components → see poker/README.md
│   └── ui/                     # Shared primitives
│       ├── Modal.tsx           # BaseModal: Dialog.Root + AnimatePresence wrapper
│       ├── Popover.tsx         # Radix Popover wrapper
│       └── Tooltip.tsx         # Radix Tooltip wrapper
│
├── hooks/                      # Client-side React hooks → see hooks/README.md
│   └── useUser.ts              # Anonymous session ID (localStorage)
│
├── lib/                        # Pure adapters and formatters → see lib/README.md
│   ├── overbet-to-player-view.ts  # Maps gateway state → PlayerPerspectiveView props
│   ├── pot-display.ts             # Pot/side-pot math
│   └── gameLogFormatters.ts       # GameLog constants and card/action formatters
│
└── types/
    └── lucide-icons.d.ts       # Module declaration for direct lucide icon imports
```

## Key Patterns

- **Server actions** (`app/actions/`) use `@overbet/db` directly — they run on the server only.
- **Client components** receive socket snapshots and derive view models locally via adapters in `lib/`.
- **`'use client'`** is required on any component that uses hooks, socket events, or browser APIs.
- Custom CSS properties (design tokens like `--accent`, `--bg-surface`, `--danger`) are defined in `globals.css`.
