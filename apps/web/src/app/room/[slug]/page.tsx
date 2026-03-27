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
      {/* Header is now integrated in RoomClient */}
      <RoomClient slug={slug} initialRoom={room as any} />
    </div>
  );
}
