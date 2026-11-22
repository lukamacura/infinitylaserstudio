"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PAKETICI_COOKIE, PAKETICI_COOKIE_MAX_AGE, isPaketiciPassword, paketiciToken,
} from "@/lib/server/paketiciAccess";

/** The password form on /paketici (see lib/server/paketiciAccess.ts). */
export async function unlockPaketici(formData: FormData) {
  const given = String(formData.get("lozinka") ?? "").trim();
  if (!given || !isPaketiciPassword(given)) redirect("/paketici?greska=1");

  (await cookies()).set(PAKETICI_COOKIE, paketiciToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // "/" and not "/paketici": the order request goes to /api/paketici.
    path: "/",
    maxAge: PAKETICI_COOKIE_MAX_AGE,
  });
  redirect("/paketici");
}
