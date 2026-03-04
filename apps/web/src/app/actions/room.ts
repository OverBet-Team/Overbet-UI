"use server";

import { prisma } from "@overbet/db";
import { v4 as uuidv4 } from "uuid";

export async function createRoom(hostId: string, roomName: string) {
    // Generate a short 6-character slug for the URL
    const slug = uuidv4().substring(0, 6).toUpperCase();

    // The user host must exist in DB (upsert hack for MVP since auth isn't wired yet)
    const host = await prisma.user.upsert({
        where: { id: hostId },
        update: {},
        create: {
            id: hostId,
            username: `Player_${slug}`
        }
    });

    const room = await prisma.room.create({
        data: {
            slug,
            name: roomName,
            status: "LOBBY",
            hostId: host.id,
            settings: {
                variant: "NLH",
                smallBlind: 10,
                bigBlind: 20
            }
        }
    });

    return { success: true, roomSlug: room.slug };
}

export async function getRoom(slug: string) {
    const room = await prisma.room.findUnique({
        where: { slug },
        include: {
            host: true
        }
    });

    if (!room) return null;

    return room;
}
