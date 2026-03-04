"use client";

import { useEffect, useState } from "react";

export function useUser() {
    const [userId, setUserId] = useState<string>("");

    useEffect(() => {
        const storedId = localStorage.getItem("overbet_user_id");
        const id = storedId || "user-" + Math.random().toString(36).substring(2, 9);
        if (!storedId) {
            localStorage.setItem("overbet_user_id", id);
        }
        setUserId(id);
    }, []);

    return { userId };
}
