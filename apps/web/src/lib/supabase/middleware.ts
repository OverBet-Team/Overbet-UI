import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request.
 *
 * This is critical: Supabase JWTs are short-lived. Without middleware refresh,
 * Server Components would see expired sessions and force re-auth. The middleware
 * reads the current cookies, calls `getUser()` (which triggers a refresh if
 * needed), and writes the updated cookies back into the response.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write into the request so downstream Server Components see them.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Also write into the response so the browser receives them.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Trigger token refresh. Do NOT use getSession() here — it reads from
  // cookies without server verification, making it unsafe for middleware.
  await supabase.auth.getUser();

  return supabaseResponse;
}
