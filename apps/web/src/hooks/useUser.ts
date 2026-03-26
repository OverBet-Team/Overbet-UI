"use client";

import { useAuth } from "@/components/providers/AuthProvider";

/**
 * Returns the current authenticated user's identity.
 *
 * This is a thin wrapper over `useAuth()` that preserves the original
 * `{ userId }` return shape for existing consumers. New code should
 * prefer `useAuth()` directly for access to `accessToken`, `isReady`,
 * and the full `user` object.
 */
export function useUser() {
  const { userId, accessToken } = useAuth();
  return { userId, accessToken };
}
