"use server";

import { prisma } from "@overbet/db";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/server";

type CreateRoomSettings = {
    smallBlind: number;
    bigBlind: number;
};

/**
 * Creates a new poker room. The host is determined from the authenticated
 * Supabase session — never from client-supplied IDs.
 */
export async function createRoom(
    roomName: string,
    settings: CreateRoomSettings,
) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { success: false, error: "Not authenticated" };
    }

    const hostId = user.id;

    const smallBlind = Number.isFinite(settings.smallBlind) ? Math.max(1, Math.trunc(settings.smallBlind)) : 10;
    const bigBlind = Number.isFinite(settings.bigBlind) ? Math.max(1, Math.trunc(settings.bigBlind)) : 20;

    // Generate a short 6-character slug for the URL
    const slug = uuidv4().substring(0, 6).toUpperCase();

    // Ensure the user exists in our Prisma DB, synced from Supabase auth.
    // The Supabase user ID is the canonical identity.
    const host = await prisma.user.upsert({
        where: { id: hostId },
        update: {
            email: user.email ?? undefined,
            isGuest: user.is_anonymous ?? false,
        },
        create: {
            id: hostId,
            username: user.user_metadata?.display_name || `Player_${slug}`,
            email: user.email ?? null,
            isGuest: user.is_anonymous ?? false,
        },
    });

    const room = await prisma.room.create({
        data: {
            slug,
            name: roomName,
            status: "LOBBY",
            hostId: host.id,
            settings: {
                variant: "NLH",
                smallBlind,
                bigBlind,
            },
        },
    });

    return { success: true, roomSlug: room.slug };
}

export async function getRoom(slug: string) {
    const room = await prisma.room.findUnique({
        where: { slug },
        include: {
            host: true,
        },
    });

    if (!room) return null;

    return room;
}
