"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { locationTheme, type LocationId } from "@/lib/locations";
import { deleteUpit, markFollowedUp, setUpitRemind, setUpitStatus } from "@/lib/upiti";
import { announceDataChanged } from "@/lib/infy/events";
import { currentLocation, infyPost, readStore, writeStore } from "@/lib/infy/client";
import { addDays, belgradeToday, longDay } from "@/lib/infy/time";
import type { Brief, ChatMessage, ChatResponse, ConfirmResponse, InfyCard } from "@/lib/infy/types";
import InfyAvatar from "./InfyAvatar";
import BriefView, { Typewriter, type CallAction, type UpitAction } from "./BriefView";
import { ProposalCard, UpitCard, type UiCard } from "./InfyCards";

/**
 * Infy, on every admin page: a round button in the bottom-right corner that
 * opens a panel - the brief (who to call or write to, who booked, gaps in the
 * calendar, capacity, who is due back) and a conversation. It opens by itself
 * on the first admin visit of the day.
 *
 * Bookings, moves and cancellations only ever happen from a paper sheet the
 * staff confirm (components/infy/InfyCards.tsx → app/api/infy/confirm).
 */

type UiMessage = { id: string; role: "user" | "infy"; text: string; cards?: UiCard[]; error?: boolean };
/** day: the Belgrade date the conversation started - a new day starts a new one. */
type Chat = { messages: UiMessage[]; history: ChatMessage[]; day: string };

const CHAT_KEY = "infy-chat-v2";
/** Messages kept on screen; older ones scroll away (what the model sees is trimmed on the server). */
const MAX_SHOWN = 60;

function newChat(): Chat {
  return { messages: [], history: [], day: belgradeToday() };
}
const BRIEF_KEY = "infy-brief-v1";
const SEEN_KEY = "infy-seen";
/** A brief older than this is loaded again when the panel opens. */
const BRIEF_FRESH_MS = 5 * 60 * 1000;

const QUICK = [
  "Koga da zovem danas?",
  "Slobodni termini sutra",
  "Upiši upit sa Instagrama",
  "Kako stojimo ove nedelje?",
];

const CONFIRM_ERRORS: Record<string, string> = {
  expired: "Predlog je istekao. Traži od Infy novi.",
  too_late: "To vreme je prošlo.",
  not_found: "Termin više ne postoji.",
  inactive: "Termin je otkazan ili je na crnoj listi.",
  unchanged: "Termin je već u to vreme.",
  invalid_promo: "Iz tog paketa više nema slobodnih tretmana.",
  laser_off: "Taj laser tog dana još ne prima termine.",
  forbidden: "Prijava je istekla - osveži stranicu i prijavi se.",
  invalid: "Predlog nije ispravan. Traži novi.",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** A newer proposal for the same booking replaces the older card. */
function markReplaced(messages: UiMessage[], incoming: InfyCard[]): UiMessage[] {
  const subjects = new Set(incoming.flatMap((c) => (c.type === "proposal" ? [c.subject] : [])));
  if (!subjects.size) return messages;
  return messages.map((m) => (!m.cards ? m : {
    ...m,
    cards: m.cards.map((c) =>
      c.type === "proposal" && subjects.has(c.subject) && (c.status === "pending" || c.status === "error")
        ? { ...c, status: "replaced" as const }
        : c),
  }));
}

export default function Infy() {
  const pathname = usePathname() ?? "/admin";
  const reduceMotion = useReducedMotion();

  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<LocationId>("novi_sad");
  // Mounted only in the browser (ssr: false), so the saved brief and the
  // conversation can be read right away.
  const [brief, setBrief] = useState<Brief | null>(() => {
    const cached = readStore<Brief>("session", BRIEF_KEY);
    return cached && cached.today === belgradeToday() ? cached : null;
  });
  const [briefState, setBriefState] = useState<"idle" | "loading" | "ready" | "failed">(() => (brief ? "ready" : "idle"));
  /** The headline already written out once - it is not typed again. */
  const [typed, setTyped] = useState<string | null>(() => brief?.headline ?? null);
  const [tab, setTab] = useState<"dan" | "nedelja">("dan");
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  // Yesterday's conversation is not carried into today (nor billed again).
  const [chat, setChat] = useState<Chat>(() => {
    const saved = readStore<Chat>("session", CHAT_KEY);
    return saved && saved.day === belgradeToday() ? saved : newChat();
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Who is signed in ──────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { if (active) setAdmin(false); return; }
      const { data: ok } = await supabase.rpc("is_admin");
      if (active) setAdmin(ok === true);
    }
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAdmin(false);
        setOpen(false);
        setChat(newChat());
        writeStore("session", BRIEF_KEY, null);
      }
      else if (event === "SIGNED_IN") void check();
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // The conversation survives moving between admin pages and a reload.
  useEffect(() => {
    writeStore("session", CHAT_KEY, chat.messages.length ? chat : null);
  }, [chat]);

  // Proposals expire after 30 minutes - the cards need a clock.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  // ── The brief ─────────────────────────────────────────────────────────────
  const loadBrief = useCallback(async (ai: boolean) => {
    setBriefState((s) => (s === "ready" ? s : "loading"));
    const res = await infyPost<{ ok: boolean; brief?: Brief }>("/api/infy/brief", { ai }, 35_000);
    const next = res?.data?.ok ? res.data.brief : undefined;
    if (!next) {
      setBriefState((s) => (s === "ready" ? s : "failed"));
      return;
    }
    // A quiet refresh (no AI) keeps the sentences Infy already wrote today.
    setBrief((prev) => {
      const keep = !next.ai && prev?.ai && prev.today === next.today;
      const merged = keep ? { ...next, headline: prev.headline, ai: true } : next;
      writeStore("session", BRIEF_KEY, merged);
      return merged;
    });
    setBriefState("ready");
  }, []);

  // Signed in as admin: the brief, and on the day's first visit the panel opens.
  useEffect(() => {
    if (!admin) return;
    const cached = readStore<Brief>("session", BRIEF_KEY);
    const today = belgradeToday();
    const sameDay = !!cached && cached.today === today;
    const fresh = sameDay && Date.now() - Date.parse(cached.generatedAt) < BRIEF_FRESH_MS;
    // Infy writes the day's sentences once; later loads only refresh the numbers.
    if (!fresh) void loadBrief(!(sameDay && cached.ai));

    if (readStore<string>("local", SEEN_KEY) !== today) {
      writeStore("local", SEEN_KEY, today);
      const t = setTimeout(() => { setLocation(currentLocation()); setOpen(true); }, 700);
      return () => clearTimeout(t);
    }
  }, [admin, loadBrief]);

  function openPanel() {
    setLocation(currentLocation());
    setOpen(true);
    if (brief && Date.now() - Date.parse(brief.generatedAt) > BRIEF_FRESH_MS) void loadBrief(false);
  }

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A new message or "Infy piše…": keep the latest in view. Opening the panel
  // alone starts at the top, with the brief.
  const scrolledFor = useRef(`${chat.messages.length}:false`);
  useEffect(() => {
    const key = `${chat.messages.length}:${sending}`;
    if (!open || scrolledFor.current === key) return;
    scrolledFor.current = key;
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [open, chat.messages.length, sending, reduceMotion]);

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  }

  function setBusyId(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  // ── Actions on the brief ──────────────────────────────────────────────────
  async function onCall(id: string, action: CallAction) {
    setBusyId(id, true);
    const { error } = await supabase.from("reservations")
      .update(action === "answered" ? { call_status: "answered" } : { call_status: "no_answer", call_attempted_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(id, false);
    if (error) { flash("Nije sačuvano. Proveri internet."); return; }
    setBrief((b) => b && {
      ...b,
      facts: {
        ...b.facts,
        calls: action === "answered"
          ? b.facts.calls.filter((c) => c.id !== id)
          : b.facts.calls.map((c) => (c.id === id ? { ...c, call_status: "no_answer" as const } : c)),
      },
    });
    announceDataChanged();
  }

  async function onUpit(id: string, action: UpitAction) {
    setBusyId(id, true);
    try {
      if (action === "done") await markFollowedUp(id);
      else if (action === "later") await setUpitRemind(id, addDays(belgradeToday(), 2));
      else await setUpitStatus(id, "booked");
    } catch {
      setBusyId(id, false);
      flash("Nije sačuvano. Proveri internet.");
      return;
    }
    setBusyId(id, false);
    setBrief((b) => b && { ...b, facts: { ...b.facts, upiti_due: b.facts.upiti_due.filter((u) => u.id !== id) } });
    announceDataChanged();
  }

  // ── The conversation ──────────────────────────────────────────────────────
  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setInput("");
    setTab("dan");
    const loc = currentLocation();
    setLocation(loc);
    const userMsg: UiMessage = { id: uid(), role: "user", text };
    // The panel left open overnight: the first message of the day starts a new conversation.
    const today = belgradeToday();
    const carried = chat.day === today ? chat.history : [];
    setChat((c) => {
      const base = c.day === today ? c : newChat();
      return { ...base, messages: [...base.messages, userMsg] };
    });
    setSending(true);
    const res = await infyPost<ChatResponse>(
      "/api/infy/chat",
      { message: text, history: carried, location: loc, page: pathname },
      70_000,
    );
    setSending(false);

    const body = res?.data;
    if (!body || !body.ok) {
      const reason = !body ? "Nema veze sa serverom. Proveri internet i pokušaj ponovo."
        : body.error === "forbidden" ? "Prijava je istekla - osveži stranicu i prijavi se."
        : body.error === "config" ? "Infy još nije uključena: na serveru fali OPENAI_API_KEY."
        : "Infy trenutno ne može da odgovori. Pokušaj ponovo za koji trenutak.";
      setChat((c) => ({ ...c, messages: [...c.messages, { id: uid(), role: "infy", text: reason, error: true }] }));
      return;
    }
    const cards: UiCard[] = body.cards.map((card) => ({ ...card, status: "pending" as const }));
    setChat((c) => ({
      ...c,
      history: body.history,
      messages: [...markReplaced(c.messages, body.cards), { id: uid(), role: "infy" as const, text: body.reply, cards }].slice(-MAX_SHOWN),
    }));
    if (body.cards.some((card) => card.type === "upit")) {
      announceDataChanged();
      void loadBrief(false);
    }
  }

  function patchCard(msgId: string, index: number, patch: Partial<UiCard>) {
    setChat((c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id !== msgId || !m.cards ? m : {
        ...m,
        cards: m.cards.map((card, i) => (i === index ? ({ ...card, ...patch } as UiCard) : card)),
      })),
    }));
  }

  /** Tells the model what the staff did with a card, for the next question. */
  function note(text: string) {
    setChat((c) => ({ ...c, history: [...c.history, { role: "assistant", content: text }] }));
  }

  async function confirmCard(msgId: string, index: number, card: Extract<UiCard, { type: "proposal" }>, notify: boolean) {
    patchCard(msgId, index, { status: "sending", error: undefined });
    const res = await infyPost<ConfirmResponse>("/api/infy/confirm", { token: card.token, notify }, 40_000);
    const body = res?.data;
    if (!body) {
      patchCard(msgId, index, { status: "error", error: "Nema veze sa serverom. Proveri internet i pokušaj ponovo." });
      return;
    }
    if (!body.ok) {
      const error = body.error === "slot_taken"
        ? `Termin je u međuvremenu zauzet${body.clash?.name ? ` (${body.clash.name} ${body.clash.start}–${body.clash.end})` : ""}. Traži od Infy drugo vreme.`
        : CONFIRM_ERRORS[body.error] ?? "Nije uspelo. Pokušaj ponovo.";
      patchCard(msgId, index, { status: "error", error });
      return;
    }
    patchCard(msgId, index, { status: "done", email: body.email, laserMissed: body.laserMissed });
    const d = card.display;
    const what = d.kind === "book" ? "zakazan termin"
      : d.kind === "move" ? "termin pomeren na"
      : d.kind === "laser" ? "termin prebačen na drugi laser,"
      : "otkazan termin";
    const missed = body.laserMissed ? " Traženi laser je bio zauzet - termin je ostao na drugom laseru." : "";
    note(`(Osoblje je potvrdilo papir: ${d.title} - ${what} ${d.date} ${d.timeRange}, ${d.studio}. Mejl: ${body.email === "sent" ? "poslat" : "nije poslat"}.${missed})`);
    announceDataChanged();
    void loadBrief(false);
  }

  function dismissCard(msgId: string, index: number, card: Extract<UiCard, { type: "proposal" }>) {
    patchCard(msgId, index, { status: "dismissed" });
    note(`(Osoblje je odustalo od predloga za ${card.display.title}.)`);
  }

  async function undoUpit(msgId: string, index: number, card: Extract<UiCard, { type: "upit" }>) {
    patchCard(msgId, index, { status: "sending" });
    try {
      await deleteUpit(card.id);
    } catch {
      patchCard(msgId, index, { status: "pending" });
      flash("Nije poništeno. Proveri internet.");
      return;
    }
    patchCard(msgId, index, { status: "undone" });
    note(`(Osoblje je poništilo upis: ${card.name} je obrisan/a sa spiska upita.)`);
    announceDataChanged();
    void loadBrief(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  if (!admin) return null;

  const badge = brief ? brief.facts.calls.length + brief.facts.upiti_due.length : 0;
  // /admin on a phone has its own bar at the bottom - sit above it.
  const onCalendar = /^\/admin(\/|$)/.test(pathname);
  const launcherBottom = onCalendar
    ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-6"
    : "bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-6";
  const showHeadline = brief && typed !== brief.headline;

  return (
    <div className="admin-theme infy-root" style={locationTheme(location)}>
      {/* The round button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            type="button"
            onClick={openPanel}
            aria-label={badge ? `Infy - ${badge} za javljanje` : "Infy"}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
            className={`fixed right-4 md:right-6 ${launcherBottom} z-40 w-14 h-14 rounded-full cursor-pointer infy-launcher ${badge ? "has-news" : ""}`}
            style={{ color: "var(--foreground)" }}
          >
            <InfyAvatar size={56} />
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-400 text-[#1a1112] text-[11px] font-bold font-poppins tabular-nums inline-flex items-center justify-center ring-2 ring-background">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* The panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="Infy"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.94 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed z-[45] inset-x-0 bottom-0 top-[calc(0.75rem+env(safe-area-inset-top))] md:inset-auto md:right-6 md:bottom-6 md:w-[430px] md:h-[min(760px,calc(100dvh-3rem))] flex flex-col overflow-hidden rounded-t-3xl md:rounded-3xl bg-surface text-foreground border border-foreground/10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] infy-panel"
          >
            {/* Header */}
            <header className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-foreground/8">
              <InfyAvatar size={38} thinking={sending || briefState === "loading"} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold font-playfair leading-tight">Infy</p>
                <p className="text-[11px] font-poppins text-foreground/55 truncate">
                  {sending ? "piše…" : brief ? longDay(brief.today) : "tvoja asistentkinja"}
                </p>
              </div>
              <div role="tablist" aria-label="Pregled" className="flex items-center rounded-xl bg-foreground/5 p-0.5 text-[11px] font-bold font-poppins">
                {(["dan", "nedelja"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`h-7 px-2.5 rounded-lg uppercase tracking-wider cursor-pointer transition-colors ${tab === t ? "bg-accent/20 text-accent" : "text-foreground/55 hover:text-foreground/80"}`}
                  >
                    {t === "dan" ? "Danas" : "Nedelja"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void loadBrief(false)}
                aria-label="Osveži pregled"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5 cursor-pointer"
              >
                <RefreshCw size={15} className={briefState === "loading" ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zatvori"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </header>

            {/* Brief + conversation */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
              {/* Infy's own words on the day */}
              <div className="flex items-start gap-2.5">
                <InfyAvatar size={28} className="shrink-0 mt-0.5" />
                <div className="min-w-0 rounded-2xl rounded-tl-md bg-accent/12 border border-accent/20 px-3.5 py-2.5 text-sm font-poppins leading-relaxed">
                  {briefState === "failed" && !brief ? (
                    <span>Pregled trenutno ne može da se učita. <button type="button" onClick={() => void loadBrief(true)} className="font-semibold text-accent underline cursor-pointer">Pokušaj ponovo</button></span>
                  ) : !brief ? (
                    <span className="infy-dots" aria-label="Infy piše"><i /><i /><i /></span>
                  ) : showHeadline ? (
                    <Typewriter text={brief.headline} onDone={() => setTyped(brief.headline)} />
                  ) : (
                    brief.headline
                  )}
                </div>
              </div>

              {brief ? (
                <BriefView brief={brief} tab={tab} busy={busy} onCall={(id, a) => void onCall(id, a)} onUpit={(id, a) => void onUpit(id, a)} onAsk={(q) => void send(q)} />
              ) : briefState === "loading" ? (
                <div className="space-y-3" aria-hidden>
                  {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-foreground/5 animate-pulse" />)}
                </div>
              ) : null}

              {/* The conversation */}
              {chat.messages.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="h-px flex-1 bg-foreground/10" />
                  <button
                    type="button"
                    onClick={() => setChat(newChat())}
                    className="text-[11px] font-poppins text-foreground/50 hover:text-foreground/80 cursor-pointer"
                  >
                    Novi razgovor
                  </button>
                  <span className="h-px flex-1 bg-foreground/10" />
                </div>
              )}

              {chat.messages.map((m) => (
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end infy-rise">
                    <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-accent text-on-accent px-3.5 py-2 text-sm font-poppins leading-relaxed whitespace-pre-wrap break-words">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2.5 infy-rise">
                    <InfyAvatar size={28} className="shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className={`inline-block max-w-full rounded-2xl rounded-tl-md px-3.5 py-2 text-sm font-poppins leading-relaxed whitespace-pre-wrap break-words ${m.error ? "bg-red-400/10 text-red-200 border border-red-400/25" : "bg-foreground/6"}`}>
                        {m.text}
                      </p>
                      {m.cards?.map((card, i) =>
                        card.type === "proposal" ? (
                          <ProposalCard
                            key={card.token}
                            card={card}
                            now={now}
                            onConfirm={(notify) => void confirmCard(m.id, i, card, notify)}
                            onDismiss={() => dismissCard(m.id, i, card)}
                          />
                        ) : (
                          <UpitCard key={`${card.id}${i}`} card={card} onUndo={() => void undoUpit(m.id, i, card)} />
                        ))}
                    </div>
                  </div>
                )
              ))}

              {sending && (
                <div className="flex items-start gap-2.5">
                  <InfyAvatar size={28} thinking className="shrink-0 mt-0.5" />
                  <p className="rounded-2xl rounded-tl-md bg-foreground/6 px-3.5 py-2.5">
                    <span className="infy-dots" aria-label="Infy piše"><i /><i /><i /></span>
                  </p>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {notice && (
              <p role="alert" className="shrink-0 mx-4 mb-2 rounded-xl bg-red-400/15 text-red-200 text-xs font-poppins px-3 py-2">{notice}</p>
            )}

            {/* Write to Infy */}
            <footer className="shrink-0 border-t border-foreground/8 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {chat.messages.length === 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        if (!q.startsWith("Upiši")) { void send(q); return; }
                        setInput("Upiši upit: ");
                        inputRef.current?.focus();
                      }}
                      className="shrink-0 h-8 px-3 rounded-full border border-foreground/12 text-xs font-poppins text-foreground/75 hover:bg-foreground/5 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={2000}
                  placeholder="Npr. Ana Martić je rekla na IG da će se javiti"
                  aria-label="Poruka za Infy"
                  className="flex-1 min-h-11 max-h-32 resize-none rounded-2xl bg-foreground/6 border border-foreground/10 focus:border-accent/60 focus:outline-none px-3.5 py-2.5 text-sm font-poppins leading-snug [field-sizing:content]"
                />
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={!input.trim() || sending}
                  aria-label="Pošalji"
                  className="shrink-0 w-11 h-11 rounded-full bg-accent text-on-accent flex items-center justify-center cursor-pointer disabled:opacity-40 transition-opacity"
                >
                  <ArrowUp size={19} strokeWidth={2.5} />
                </button>
              </div>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
