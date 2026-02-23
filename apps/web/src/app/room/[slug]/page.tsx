import { getRoom } from "@/app/actions/room";
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

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between h-20 px-8 border-b border-white/5 bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-1 shadow-lg shadow-accent-1/20">
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
          <span className="text-xl font-bold tracking-tight">OverBet</span>     
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-white/50">
            NLH $10 / $20
          </div>
          <div className="w-10 h-10 rounded-full border border-white/10 bg-surface flex items-center justify-center font-bold text-accent-2">
            JD
          </div>
        </div>
      </nav>

      <RoomClient slug={slug} initialRoom={room as any} />
    </div>
  );
}
