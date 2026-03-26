"use client";

import { useState, useEffect } from "react";

export type UIVersion = "v1" | "v2";

/**
 * Feature flag hook for UI version switching.
 *
 * Returns 'v2' when the URL contains ?ui=v2, 'v1' otherwise.
 * SSR-safe: defaults to 'v1' during server rendering.
 * Client-only: reads window.location.search in useEffect.
 *
 * Usage:
 *   const { uiVersion } = useUIVersion();
 *   if (uiVersion === 'v2') return <V2GameContainer ... />;
 */
export function useUIVersion(): { uiVersion: UIVersion } {
  const [uiVersion, setUIVersion] = useState<UIVersion>("v1");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUIVersion(params.get("ui") === "v2" ? "v2" : "v1");
  }, []);

  return { uiVersion };
}
