"use client";

import { useId } from "react";

/**
 * Infy's face, everywhere Infy shows: the round button, the panel, the chat.
 * public/infy/avatar.webp is a square crop of public/infy/infy.jpeg (the
 * illustration); set INFY_IMAGE to null to fall back to the drawn infinity face.
 */
const INFY_IMAGE: string | null = "/infy/avatar.webp";

export default function InfyAvatar({
  size = 56,
  thinking = false,
  className = "",
}: {
  size?: number;
  /** A ring runs around the face while Infy works on an answer. */
  thinking?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (INFY_IMAGE) {
    return (
      <span
        className={`infy-face-img relative inline-block shrink-0 rounded-full ${thinking ? "is-thinking" : ""} ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 19 KB, already sized; next/image adds nothing here */}
        <img
          src={INFY_IMAGE}
          alt=""
          width={size}
          height={size}
          decoding="async"
          className="w-full h-full rounded-full object-cover"
        />
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`infy-face ${thinking ? "is-thinking" : ""} ${className}`}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-g`} cx="35%" cy="28%" r="80%">
          {/* CSS, not attributes: only CSS resolves var() and color-mix(). */}
          <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--accent) 55%, #fff)" }} />
          <stop offset="55%" style={{ stopColor: "var(--accent)" }} />
          <stop offset="100%" style={{ stopColor: "var(--accent-deep)" }} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${id}-g)`} />
      <path
        className="infy-loop"
        d="M32 32c-4-6-7.5-9-12-9-5 0-8.5 4-8.5 9s3.5 9 8.5 9c4.5 0 8-3 12-9s7.5-9 12-9c5 0 8.5 4 8.5 9s-3.5 9-8.5 9c-4.5 0-8-3-12-9z"
        fill="none"
        style={{ stroke: "var(--on-accent)" }}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
      <g className="infy-eyes" style={{ fill: "var(--on-accent)" }}>
        <circle cx="20.5" cy="31" r="2.6" />
        <circle cx="43.5" cy="31" r="2.6" />
      </g>
    </svg>
  );
}
