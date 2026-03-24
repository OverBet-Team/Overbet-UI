"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  /** Supabase user ID (UUID). Empty string until session is resolved. */
  userId: string;
  /** Current JWT access token for passing to gateway/APIs. Null until session is resolved. */
  accessToken: string | null;
  /** Whether auth state has been resolved (session fetched or anonymous sign-in completed). */
  isReady: boolean;
  /** The full Supabase user object, if available. */
  user: User | null;
}

const AuthContext = createContext<AuthContextValue>({
  userId: "",
  accessToken: null,
  isReady: false,
  user: null,
});

/**
 * Provides Supabase auth state to the component tree.
 *
 * On mount:
 * 1. Checks for an existing session via `getSession()`.
 * 2. If no session exists, performs an anonymous sign-in to maintain the
 *    zero-friction principle: every visitor gets a real JWT identity
 *    without any interaction.
 * 3. Subscribes to `onAuthStateChange` for live session updates
 *    (token refresh, sign-out, identity linking).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Bootstrap: check existing session, then anonymous sign-in if needed.
    async function init() {
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      if (existingSession) {
        setSession(existingSession);
        setIsReady(true);
      } else {
        // Anonymous sign-in: user gets a real Supabase UUID + JWT
        // with zero friction. They can link email/OAuth later.
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("[AuthProvider] Anonymous sign-in failed:", error.message);
        }
        if (data.session) {
          setSession(data.session);
        }
        setIsReady(true);
      }
    }

    init();

    // Listen for auth state changes (token refresh, sign-out, identity link).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    userId: session?.user?.id ?? "",
    accessToken: session?.access_token ?? null,
    isReady,
    user: session?.user ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the current auth state.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
