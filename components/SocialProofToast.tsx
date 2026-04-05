"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarCheck, X } from "lucide-react";

const NAMES = [
  "Tara", "Mina", "Katarina", "Stefana", "Svetlana",
  "Petra", "Branka", "Lena", "Melanija", "Zorica", "Mirjana",
];

const SESSION_KEY = "social_proof_shown";

export default function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [name, setName] = useState("");

  const dismiss = useCallback(() => {
    setAnimating(false);
    setTimeout(() => setVisible(false), 350);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (window.location.pathname.startsWith("/admin")) return;

    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
    setName(randomName);

    const show = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    }, 3000);

    return () => clearTimeout(show);
  }, []);

  useEffect(() => {
    if (!animating) return;
    const hide = setTimeout(dismiss, 5000);
    return () => clearTimeout(hide);
  }, [animating, dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-4 left-1/2 z-[60]"
      style={{
        transform: `translateX(-50%) translateY(${animating ? "0" : "-110%"})`,
        opacity: animating ? 1 : 0,
        transition: "transform 350ms cubic-bezier(0.34,1.56,0.64,1), opacity 350ms ease",
      }}
    >
      <div className="flex items-center gap-3 bg-white rounded-2xl shadow-lg border border-foreground/8 px-4 py-3 max-w-xs w-max">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#fce7ef" }}
        >
          <CalendarCheck size={16} style={{ color: "#E85D8A" }} />
        </div>

        <p className="font-poppins text-sm text-foreground/80 leading-snug">
          <span className="font-semibold text-foreground">{name}</span>
          {" "}je rezervisala svoj 1. tretman
        </p>

        <button
          onClick={dismiss}
          className="ml-1 text-foreground/30 hover:text-foreground/60 transition-colors shrink-0 cursor-pointer"
          aria-label="Zatvori"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
