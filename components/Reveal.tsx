"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Lightweight stand-in for framer-motion's `whileInView` (once: true).
// An IntersectionObserver plus a CSS transition keeps ~48 KB of framer-motion
// out of the homepage bundle — it now loads only with the booking modal.

const EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

type Props = {
  as?: "div" | "h2" | "p";
  /** Vertical offset (px) to rise from. Ignored when `from`/`to` are given. */
  y?: number;
  /** Custom start/end styles, e.g. a bar growing from width 0% to 91%. */
  from?: CSSProperties;
  to?: CSSProperties;
  duration?: number;
  delay?: number;
  /** IntersectionObserver rootMargin — negative shrinks the trigger area. */
  margin?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export default function Reveal({
  as: Tag = "div",
  y = 32,
  from,
  to,
  duration = 0.7,
  delay = 0,
  margin = "-80px",
  className,
  style,
  children,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: `${margin} 0px ${margin} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  const hidden = from ?? { opacity: 0, transform: `translateY(${y}px)` };
  const visible = to ?? { opacity: 1, transform: "none" };
  const props = Object.keys(visible).map((k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

  return (
    <Tag
      // Callback ref keeps the union-typed Tag happy without a cast per element.
      ref={(node: HTMLElement | null) => { ref.current = node; }}
      data-reveal=""
      className={className}
      style={{
        ...style,
        ...(shown ? visible : hidden),
        transition: props.map((p) => `${p} ${duration}s ${EASE} ${delay}s`).join(", "),
      }}
    >
      {children}
    </Tag>
  );
}
