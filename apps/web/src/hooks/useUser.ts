"use client";

import { useEffect, useState } from "react";

export function useUser() {
    const [userId, setUserId] = useState<string>("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        // Persist the anonymous client id across refreshes when storage is available.
        const storage = window.localStorage;
        const canUseStorage =
            storage &&
            typeof storage.getItem === "function" &&
            typeof storage.setItem === "function";
        const storedId = canUseStorage ? storage.getItem("overbet_user_id") : null;
        const id = storedId || "user-" + Math.random().toString(36).substring(2, 9);
        if (!storedId && canUseStorage) {
            storage.setItem("overbet_user_id", id);
        }
        setUserId(id);
    }, []);

    return { userId };
}
