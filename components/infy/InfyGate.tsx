"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isAdminPath } from "@/lib/adminRoutes";

/**
 * Infy lives in the root layout so it stays put (and keeps the conversation)
 * while staff move between admin pages. The public site never loads it: the
 * code is fetched only on an admin path, and Infy itself shows only for a
 * signed-in admin.
 *
 * It comes a moment after the page: the calendar's data and drawing go first,
 * then Infy's code and brief, when the browser is idle. Once there it stays
 * for every later admin page.
 */
const Infy = dynamic(() => import("./Infy"), { ssr: false });

/** At least this long after the first admin page shows… */
const AFTER_MS = 900;
/** …then on the first idle moment, or after this at the latest. */
const IDLE_TIMEOUT_MS = 1500;

export default function InfyGate() {
  const admin = isAdminPath(usePathname());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!admin || ready) return;
    let idle: number | null = null;
    const t = setTimeout(() => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setReady(true), { timeout: IDLE_TIMEOUT_MS });
      else setReady(true);
    }, AFTER_MS);
    return () => {
      clearTimeout(t);
      if (idle !== null) window.cancelIdleCallback(idle);
    };
  }, [admin, ready]);

  return admin && ready ? <Infy /> : null;
}
