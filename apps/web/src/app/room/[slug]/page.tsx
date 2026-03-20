import { getRoom } from "@/app/actions/room";
import { ChipAmount } from "@/components/poker/ChipAmount";
import { notFound } from "next/navigation";
import RoomClient from "./RoomClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { slug } = await params;
  const room = await getRoom(slug);

  if (!room) {
    notFound();
  }

  const settings = (room.settings ?? {}) as { smallBlind?: number; bigBlind?: number };

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between h-14 sm:h-20 px-3 sm:px-8 border-b border-white/[0.05] bg-[--bg-surface]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[--accent] shadow-lg shadow-[--accent]/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M5 11a7 7 0 0 1 14 0c0 4.418-7 11-7 11s-7-6.582-7-11Z" />
            </svg>
          </div>
          <span className="text-base sm:text-xl font-bold tracking-tight font-display text-[--text-primary]">OverBet</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-semibold uppercase tracking-wider text-[--text-secondary]">
            <span>NLH</span>
            <ChipAmount
              amount={settings.smallBlind ?? 10}
              iconSize={12}
              amountStyle={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700 }}
            />
            <span>/</span>
            <ChipAmount
              amount={settings.bigBlind ?? 20}
              iconSize={12}
              amountStyle={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700 }}
            />
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-white/10 bg-[--bg-elevated] flex items-center justify-center font-bold text-[--accent] text-xs sm:text-sm">
            JD
          </div>
        </div>
      </nav>

      <RoomClient slug={slug} initialRoom={room as any} />
    </div>
  );
}
