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
      <RoomClient slug={slug} initialRoom={room as any} />
    </div>
  );
}
