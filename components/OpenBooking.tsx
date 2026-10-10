"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FunnelSource } from "@/lib/funnel";

// The home page's sections are server components (no JS of their own); the
// few buttons that open the booking form reach it through this context.
export const OpenBookingContext = createContext<(source: FunnelSource) => void>(() => {});

/** Opens the home page's booking form. A no-op outside HomeClient. */
export function useOpenBooking() {
  return useContext(OpenBookingContext);
}

/** A button that opens the booking form - usable from a server component. */
export function OpenBookingButton({ source, className, children }: {
  source: FunnelSource;
  className?: string;
  children: ReactNode;
}) {
  const open = useOpenBooking();
  return <button type="button" onClick={() => open(source)} className={className}>{children}</button>;
}
