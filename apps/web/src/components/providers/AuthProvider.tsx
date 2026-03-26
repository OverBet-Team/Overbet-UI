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
 * 1. Verifies the current user via `getUser()` (server-verified, not cookie-only).
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

    // Bootstrap: verify user with server, then anonymous sign-in if needed.
    async function init() {
      // Verify identity with the server first — getSession() only reads
      // unverified cookies and can be spoofed.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // User is server-verified. Now safe to read the local session
        // for the access_token (getSession is fine after getUser succeeds).
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setIsReady(true);
        } else {
          // Server verified user but no local session — shouldn't happen.
          // Treat as no session and fall through to anonymous sign-in.
          setIsReady(true);
        }
      } else {
        // No verified user — anonymous sign-in.
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
