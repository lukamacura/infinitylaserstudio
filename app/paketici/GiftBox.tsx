/** A four-point sparkle, centred on 0,0. */
export const SPARKLE =
  "M0 -11 C1.4 -2.6 2.6 -1.4 11 0 C2.6 1.4 1.4 2.6 0 11 C-1.4 2.6 -2.6 1.4 -11 0 C-2.6 -1.4 -1.4 -2.6 0 -11 Z";

/**
 * The gift box, drawn: beige box with a lid, gold (women's) or blue (men's)
 * ribbon and bow, and the Infinity sticker on the front. The lid floats and
 * light spills from the gap (paketici.css); `still` freezes it for small copies.
 * No hooks - usable from server and client components alike. `uid` keeps the
 * gradient ids of several boxes on one page apart.
 */
export default function GiftBox({
  ribbon = "gold",
  still = false,
  uid,
  className = "",
}: {
  ribbon?: "gold" | "blue";
  still?: boolean;
  uid: string;
  className?: string;
}) {
  const id = (name: string) => `pk-${uid}-${name}`;
  const rib = ribbon === "gold"
    ? { light: "#F4DDA4", mid: "#D9B46F", dark: "#9C7535" }
    : { light: "#C9DBF5", mid: "#86A8DC", dark: "#4E6FA3" };

  return (
    <svg
      viewBox="0 0 240 240"
      className={`${still ? "pk-box-still" : ""} ${className}`}
      role="img"
      aria-label={ribbon === "gold" ? "Infinity paketić sa zlatnom mašnom" : "Infinity paketić sa plavom mašnom"}
    >
      <defs>
        <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6ECDB" />
          <stop offset="0.55" stopColor="#EADCC3" />
          <stop offset="1" stopColor="#CDB58F" />
        </linearGradient>
        <linearGradient id={id("lid")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF4E7" />
          <stop offset="1" stopColor="#E3D1B2" />
        </linearGradient>
        <linearGradient id={id("rib")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={rib.dark} />
          <stop offset="0.45" stopColor={rib.light} />
          <stop offset="1" stopColor={rib.mid} />
        </linearGradient>
        <radialGradient id={id("spill")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF3CF" stopOpacity="1" />
          <stop offset="0.5" stopColor="#F3CF7E" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F3CF7E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("seal")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF6DC" />
          <stop offset="0.55" stopColor="#D9B46F" />
          <stop offset="1" stopColor="#8E6A2E" />
        </radialGradient>
      </defs>

      {/* Floor shadow */}
      <ellipse cx="120" cy="214" rx="82" ry="9" fill="#000" opacity="0.35" />

      <g className={still ? "" : "pk-box-float"}>
        {/* Light from the gap, behind the lid */}
        <g className="pk-box-spill">
          <ellipse cx="120" cy="104" rx="92" ry="26" fill={`url(#${id("spill")})`} />
          <path d="M78 104 L56 34 L92 100 Z M120 100 L120 18 L132 100 Z M160 104 L190 40 L150 100 Z" fill="#FFE9B0" opacity="0.18" />
        </g>

        {/* Box */}
        <rect x="42" y="108" width="156" height="100" rx="7" fill={`url(#${id("body")})`} />
        <rect x="42" y="108" width="156" height="10" fill="#000" opacity="0.07" />
        <rect x="108" y="108" width="24" height="100" fill={`url(#${id("rib")})`} />

        {/* Infinity sticker on the front */}
        <circle cx="120" cy="160" r="21" fill={`url(#${id("seal")})`} stroke="#F7E7C0" strokeWidth="1.5" />
        <circle cx="120" cy="160" r="16.5" fill="none" stroke="#FFF4D6" strokeOpacity="0.6" strokeWidth="0.8" />
        <path
          d="M120 160 C114 152 106 152 106 160 C106 168 114 168 120 160 C126 152 134 152 134 160 C134 168 126 168 120 160 Z"
          fill="none" stroke="#3B2A14" strokeWidth="2.2" strokeLinejoin="round"
        />

        {/* Lid with the bow */}
        <g className="pk-box-lid">
          <rect x="34" y="84" width="172" height="28" rx="6" fill={`url(#${id("lid")})`} />
          <rect x="34" y="106" width="172" height="6" rx="3" fill="#000" opacity="0.08" />
          <rect x="108" y="84" width="24" height="28" fill={`url(#${id("rib")})`} />
          {/* Loops */}
          <path d="M120 84 C100 56 72 58 76 74 C79 86 104 88 120 84 Z" fill={rib.mid} stroke={rib.dark} strokeWidth="1.2" />
          <path d="M120 84 C140 56 168 58 164 74 C161 86 136 88 120 84 Z" fill={rib.mid} stroke={rib.dark} strokeWidth="1.2" />
          <path d="M118 82 C104 66 88 66 88 74" fill="none" stroke={rib.light} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <path d="M122 82 C136 66 152 66 152 74" fill="none" stroke={rib.light} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          {/* Tails */}
          <path d="M116 86 L100 108 L108 106 L112 114 L120 88 Z" fill={rib.dark} />
          <path d="M124 86 L140 108 L132 106 L128 114 L120 88 Z" fill={rib.dark} />
          {/* Knot */}
          <rect x="112" y="76" width="16" height="13" rx="5" fill={`url(#${id("rib")})`} stroke={rib.dark} strokeWidth="1" />
        </g>

        {/* Sparkles */}
        {[
          { x: 40, y: 60, s: 1, t: "2.4s", d: "0s" },
          { x: 196, y: 50, s: 0.8, t: "3s", d: "0.8s" },
          { x: 206, y: 140, s: 0.6, t: "2.2s", d: "1.4s" },
          { x: 28, y: 150, s: 0.7, t: "2.8s", d: "0.4s" },
          { x: 150, y: 24, s: 0.55, t: "2.6s", d: "1.9s" },
        ].map((p, i) => (
          // The position sits on the group: the CSS animation owns the path's transform.
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
            <path
              className="pk-twinkle"
              style={{ ["--t" as string]: p.t, ["--delay" as string]: p.d }}
              d={SPARKLE}
              fill="#F6DFA6"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
