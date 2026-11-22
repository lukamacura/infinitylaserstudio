/**
 * Falling snow over the whole page - plain CSS (paketici.css), no JS. The
 * flakes come from a fixed seed, so server and browser draw the same sky.
 */
const COUNT = 26;

/** 0…1 from an integer - integer math only, so every JS engine gets the same flakes. */
function rand(seed: number): number {
  let t = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

const FLAKES = Array.from({ length: COUNT }, (_, i) => {
  const r = (k: number) => rand(i * 7 + k);
  const size = 2 + r(1) * 4.5;
  const duration = 11 + r(2) * 12;
  return {
    "--x": `${(r(3) * 100).toFixed(2)}%`,
    "--s": `${size.toFixed(1)}px`,
    "--o": (0.35 + r(4) * 0.5).toFixed(2),
    "--b": `${size > 5 ? 1.2 : 0.3}px`,
    "--d": `${duration.toFixed(1)}s`,
    // Negative: already mid-fall when the page opens.
    "--delay": `${(-r(5) * duration).toFixed(1)}s`,
    "--dx": `${((r(6) - 0.5) * 60).toFixed(0)}px`,
  } as React.CSSProperties;
});

export default function Snow() {
  return (
    <div className="pk-snow" aria-hidden="true">
      {FLAKES.map((style, i) => (
        <span key={i} className="pk-flake" style={style} />
      ))}
    </div>
  );
}
