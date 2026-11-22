"use client";

/**
 * The order, one question per screen - the booking modal's shell (back /
 * title / close, progress bar, question, scrolling body, sticky button) in
 * the gift page's gold. Every step is sized to fit a phone screen; the body
 * only scrolls on very short ones (and while the keyboard is up).
 *
 *   za → nacin → (iznos | regije → broj | regije → paket) → dostava → podaci → posveta → pregled → hvala
 *
 * Tap-only steps (za, nacin, dostava) move on by themselves; the rest confirm
 * with the button at the bottom, which always shows the running total.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, ChevronRight, Coins, CreditCard, Gift, Layers, Loader2, Minus,
  Package, Plus, Sparkles, Store, Truck, Wallet, X,
} from "lucide-react";
import GiftBox from "./GiftBox";
import GiftSheet from "./GiftSheet";
import { announceStock } from "./stock";
import { lockBodyScroll, unlockBodyScroll } from "@/components/booking/shared";
import {
  AMOUNTS, AMOUNT_EXAMPLES, AMOUNT_TIERS, BONUS_LADDER, CARD_PAYMENTS_ON, DEFAULT_AMOUNT, DEFAULT_PACKAGE,
  DEFAULT_SESSIONS, GIFT_LIMIT, MAX_SESSIONS, MIN_SESSIONS, MIN_TOTAL, OCCASION_LABEL, PACKAGE_SIZES, POPULAR_PICKS,
  bonusFor, formatNumber, formatRsd, idsByNames, nextAmountTier, nextSessionTier, pickableRegions, quoteGift,
  regionsPrice, tierForAmount, tierForSessions, toggleRegion, treatmentsWord,
  type Delivery, type GiftCatalog, type GiftMode, type GiftQuote, type GiftService, type GiftVersion,
  type Occasion, type Payment, type Tier,
} from "@/lib/paketici";

type StepId = "za" | "nacin" | "iznos" | "regije" | "broj" | "paket" | "dostava" | "podaci" | "posveta" | "pregled" | "hvala";
type Size = (typeof PACKAGE_SIZES)[number];

const FLOWS: Record<GiftMode, StepId[]> = {
  iznos: ["za", "nacin", "iznos", "dostava", "podaci", "posveta", "pregled"],
  regije: ["za", "nacin", "regije", "broj", "dostava", "podaci", "posveta", "pregled"],
  paket: ["za", "nacin", "regije", "paket", "dostava", "podaci", "posveta", "pregled"],
};

const QUESTION: Record<StepId, string> = {
  za: "Za koga je paketić?",
  nacin: "Šta stavljamo u voucher?",
  iznos: "Koliki iznos poklanjaš?",
  regije: "Koje regije?",
  broj: "Koliko tretmana?",
  paket: "Izaberi paket",
  dostava: "Kako da stigne?",
  podaci: "Gde i kome?",
  posveta: "Napiši posvetu",
  pregled: "Proveri i poruči",
  hvala: "",
};

/** Rough euro hint next to the dinar amount (12.000 RSD ≈ 100 €). */
const EUR_RATE = 117;
const DEDICATION_MAX = 200;
const STUDIO_ADDRESS = "Miloja Čiplića 51, Novi Sad";
const CARD_IN = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 5) * 60}ms` });

const FIELD_MESSAGES = {
  name: "Upiši ime i prezime.",
  phone: "Upiši broj telefona - na njega potvrđujemo porudžbinu.",
  email: "Email adresa nije ispravna.",
  address: "Upiši ulicu i broj.",
  city: "Upiši mesto.",
  postal_code: "Upiši poštanski broj.",
} as const;
type Field = keyof typeof FIELD_MESSAGES;
type Errors = Partial<Record<Field, string>>;

const EMPTY_FORM = { name: "", phone: "", email: "", address: "", city: "", postal_code: "", delivery_note: "", website: "" };

interface Done {
  orderNo: number;
  remaining: number | null;
  total: number;
  name: string;
  phone: string;
  pickup: boolean;
}

export default function GiftFlow({ open, onClose, catalog }: { open: boolean; onClose: () => void; catalog: GiftCatalog }) {
  // ── Choices ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState<StepId>("za");
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [version, setVersion] = useState<GiftVersion>("zenska");
  const [mode, setMode] = useState<GiftMode>("iznos");
  const [amountIdx, setAmountIdx] = useState(Math.max(0, AMOUNTS.indexOf(DEFAULT_AMOUNT)));
  const [picked, setPicked] = useState<Record<GiftVersion, string[]>>({ zenska: [], muska: [] });
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [pkg, setPkg] = useState<Size>(DEFAULT_PACKAGE);
  const [delivery, setDelivery] = useState<Delivery>("novi_sad");
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [dedication, setDedication] = useState("");
  const [occasion, setOccasion] = useState<Occasion>("nova_godina");
  const [payment, setPayment] = useState<Payment>("pouzece");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const services = catalog[version];
  const regionIds = picked[version];
  const amount = AMOUNTS[amountIdx];
  const her = version === "zenska" ? "ona" : "on";
  const pickup = delivery === "studio";
  const quote = quoteGift(
    { version, mode, amount, regionIds, sessions: mode === "paket" ? pkg : sessions },
    services,
  );

  // ── Open / close (same motion as the booking modal) ───────────────────────
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      unlockBodyScroll();
      return;
    }
    lockBodyScroll();
    const raf = requestAnimationFrame(() => {
      setShown(true);
      sheetRef.current?.focus({ preventScroll: true });
    });
    return () => { cancelAnimationFrame(raf); unlockBodyScroll(); };
  }, [open]);

  // Every step starts at the top.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  function resetAll() {
    setStep("za"); setDir("fwd"); setVersion("zenska"); setMode("iznos");
    setAmountIdx(Math.max(0, AMOUNTS.indexOf(DEFAULT_AMOUNT)));
    setPicked({ zenska: [], muska: [] }); setSessions(DEFAULT_SESSIONS); setPkg(DEFAULT_PACKAGE);
    setDelivery("novi_sad"); setForm(EMPTY_FORM); setErrors({}); setDedication("");
    setOccasion("nova_godina"); setPayment("pouzece"); setProblem(null); setDone(null);
  }

  function close() {
    if (sending) return;
    onClose();
    // After a finished order the next opening starts fresh; otherwise an
    // accidental close keeps everything picked so far.
    if (step === "hvala") setTimeout(resetAll, 350);
  }

  // ── Moving between steps ──────────────────────────────────────────────────
  const flow = FLOWS[mode];
  const idx = flow.indexOf(step);
  const progress = step === "hvala" ? 1 : (idx + 1) / (flow.length + 1);

  function go(to: StepId, d: "fwd" | "back" = "fwd") {
    setDir(d);
    setProblem(null);
    setStep(to);
  }
  /** `m` - the flow just picked (setMode has not landed yet). */
  function next(m: GiftMode = mode) {
    const f = FLOWS[m];
    const i = f.indexOf(step);
    if (i >= 0 && i < f.length - 1) go(f[i + 1]);
  }
  function back() {
    if (step === "hvala" || idx <= 0) { close(); return; }
    go(flow[idx - 1], "back");
  }

  function pickVersion(v: GiftVersion) {
    setVersion(v);
    next();
  }
  function pickMode(m: GiftMode) {
    setMode(m);
    next(m);
  }
  function pickDelivery(d: Delivery) {
    setDelivery(d);
    next();
  }

  function setField(k: keyof typeof EMPTY_FORM, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = FIELD_MESSAGES.name;
    if (form.phone.replace(/\D/g, "").length < 6) e.phone = FIELD_MESSAGES.phone;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = FIELD_MESSAGES.email;
    if (!pickup && form.address.trim().length < 3) e.address = FIELD_MESSAGES.address;
    if (delivery === "posta" && form.city.trim().length < 2) e.city = FIELD_MESSAGES.city;
    if (delivery === "posta" && form.postal_code.trim().length < 4) e.postal_code = FIELD_MESSAGES.postal_code;
    return e;
  }

  function confirmDetails() {
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) { document.getElementById(`pk-${first}`)?.focus(); return; }
    next();
  }

  async function submit() {
    if (!quote.ok || sending) return;
    setProblem(null);
    setSending(true);
    try {
      const res = await fetch("/api/paketici", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version, mode, amount,
          region_ids: regionIds,
          sessions: mode === "paket" ? pkg : sessions,
          expected_total: quote.total,
          occasion, dedication: dedication.trim(), delivery, payment,
          ...form,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const remaining = typeof data.remaining === "number" && Number.isFinite(data.remaining) ? data.remaining : null;
        if (remaining != null) announceStock(remaining);
        (window as Window & { fbq?: (...args: unknown[]) => void }).fbq?.(
          "track", "Purchase",
          { value: data.total, currency: "RSD", content_name: "Infinity paketić" },
          { eventID: `paketic-${data.order_no}` },
        );
        setDone({ orderNo: data.order_no, remaining, total: data.total, name: form.name.trim(), phone: form.phone.trim(), pickup });
        go("hvala");
        return;
      }
      if (data.error === "locked") {
        setProblem("Pristup je istekao. Osveži stranicu i ponovo unesi šifru.");
      } else if (data.error === "sold_out") {
        announceStock(0);
        setProblem("Nažalost, upravo je otišao poslednji paketić.");
      } else if (data.error === "price") {
        setProblem(`Cena se u međuvremenu promenila (sada ${formatRsd(data.total)}). Osveži stranicu i pošalji ponovo.`);
      } else if (data.error === "invalid" && data.field in FIELD_MESSAGES) {
        setErrors({ [data.field as Field]: FIELD_MESSAGES[data.field as Field] });
        go("podaci", "back");
      } else {
        setProblem("Porudžbina nije poslata. Pokušaj ponovo ili nas pozovi: 065 373 8991.");
      }
    } catch {
      setProblem("Nema veze sa internetom. Pokušaj ponovo ili nas pozovi: 065 373 8991.");
    } finally {
      setSending(false);
    }
  }

  // ── Footer: the running total + the step's button ─────────────────────────
  const totalLine = quote.ok ? (
    <div className="mb-2.5 flex items-baseline justify-between gap-3 font-poppins">
      <span className="text-[13px] text-foreground/55">
        Ukupno{quote.bonus && <span className="text-accent"> · + {quote.bonus.label.toLowerCase()} gratis</span>}
      </span>
      <span className="text-lg font-bold text-accent tabular-nums">{formatRsd(quote.total)}</span>
    </div>
  ) : null;

  let footer: ReactNode = null;
  if (step === "iznos" || step === "broj" || step === "paket") {
    footer = (
      <>
        {totalLine ?? (
          <p className="mb-2.5 text-center font-poppins text-[13px] text-foreground/55">
            Paketić počinje od {formatRsd(MIN_TOTAL)} - dodaj {step === "broj" ? "tretman" : "regiju"}.
          </p>
        )}
        <PrimaryButton disabled={!quote.ok} onClick={() => next()}>NASTAVI</PrimaryButton>
      </>
    );
  } else if (step === "regije") {
    const { perSession, names } = regionsPrice(regionIds, services);
    footer = (
      <>
        <p className="mb-2.5 text-center font-poppins text-[13px] text-foreground/55 truncate">
          {regionIds.length
            ? <>{names.join(" + ")} · <span className="text-accent font-semibold">{formatNumber(perSession)} RSD</span> po tretmanu</>
            : "Izaberi bar jednu regiju."}
        </p>
        <PrimaryButton disabled={regionIds.length === 0} onClick={() => next()}>NASTAVI</PrimaryButton>
      </>
    );
  } else if (step === "podaci") {
    footer = <>{totalLine}<PrimaryButton onClick={confirmDetails}>NASTAVI</PrimaryButton></>;
  } else if (step === "posveta") {
    footer = <>{totalLine}<PrimaryButton onClick={() => next()}>{dedication.trim() ? "NASTAVI" : "PRESKOČI"}</PrimaryButton></>;
  } else if (step === "pregled") {
    footer = (
      <>
        <PrimaryButton disabled={sending || !quote.ok} onClick={submit}>
          {sending ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> ŠALJEM…</span>
          ) : (
            `${pickup ? "REZERVIŠI" : "PORUČI"} · ${quote.ok ? formatRsd(quote.total) : ""}`
          )}
        </PrimaryButton>
        <p className="mt-2 text-center font-poppins text-[11px] text-foreground/45">
          Javljamo se telefonom da potvrdimo. Slanjem prihvataš{" "}
          <Link href="/uslovi-koriscenja" className="underline underline-offset-2">uslove korišćenja</Link>.
        </p>
      </>
    );
  } else if (step === "hvala") {
    footer = <PrimaryButton onClick={close}>ZATVORI</PrimaryButton>;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-80 flex"
      style={{ visibility: open ? "visible" : "hidden", transition: open ? "visibility 0s" : "visibility 0s linear 0.3s" }}
      aria-hidden={!open}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-flow-title"
        tabIndex={-1}
        className={`pk-sheet relative flex h-full w-full flex-col overflow-hidden outline-none ${
          shown ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="mx-auto flex w-full max-w-xl shrink-0 items-center justify-between px-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={back}
            className={`flex h-11 w-11 items-center justify-center rounded-full hover:bg-foreground/5 cursor-pointer ${step === "hvala" ? "invisible" : ""}`}
            aria-label="Nazad"
          >
            <ArrowLeft size={20} />
          </button>
          <p id="pk-flow-title" className="font-playfair text-[1.4rem] metal-text">Infinity paketić</p>
          <button type="button" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-foreground/5 cursor-pointer" aria-label="Zatvori">
            <X size={20} />
          </button>
        </div>

        <div className="mx-auto w-full max-w-xl shrink-0 px-4 pb-3 pt-1">
          <div
            className="h-1 overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-label="Napredak porudžbine"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full rounded-full metal transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
          </div>
          {QUESTION[step] && (
            <p key={step} className={`mt-3 font-poppins text-lg font-medium leading-snug text-foreground/90 pk-step-${dir}`}>
              {QUESTION[step]}
            </p>
          )}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div key={step} className={`mx-auto w-full max-w-xl px-4 pb-4 pk-step-${dir}`}>
            {step === "za" && <StepFor version={version} onPick={pickVersion} />}
            {step === "nacin" && <StepMode version={version} mode={mode} her={her} onPick={pickMode} />}
            {step === "iznos" && (
              <>
                <AmountPicker version={version} services={services} amountIdx={amountIdx} setAmountIdx={setAmountIdx} her={her} />
                <BonusTrack version={version} mode="iznos" tier={tierForAmount(amount)} services={services} />
                <Nudge version={version} mode="iznos" services={services} amount={amount} sessions={sessions} pkg={pkg} regionIds={regionIds}
                  onAmount={(a) => setAmountIdx(AMOUNTS.indexOf(a))} onSessions={setSessions} onPkg={setPkg} />
              </>
            )}
            {step === "regije" && (
              <RegionPicker version={version} services={services} ids={regionIds} setIds={(ids) => setPicked((p) => ({ ...p, [version]: ids }))} />
            )}
            {step === "broj" && (
              <>
                <SessionsPicker sessions={sessions} setSessions={setSessions} regionIds={regionIds} services={services} />
                <BonusTrack version={version} mode="regije" tier={tierForSessions(sessions)} services={services} />
                <Nudge version={version} mode="regije" services={services} amount={amount} sessions={sessions} pkg={pkg} regionIds={regionIds}
                  onAmount={(a) => setAmountIdx(AMOUNTS.indexOf(a))} onSessions={setSessions} onPkg={setPkg} />
              </>
            )}
            {step === "paket" && (
              <>
                <PackagePicker version={version} services={services} ids={regionIds} pkg={pkg} setPkg={setPkg} />
                <Nudge version={version} mode="paket" services={services} amount={amount} sessions={sessions} pkg={pkg} regionIds={regionIds}
                  onAmount={(a) => setAmountIdx(AMOUNTS.indexOf(a))} onSessions={setSessions} onPkg={setPkg} />
              </>
            )}
            {step === "dostava" && <StepDelivery delivery={delivery} onPick={pickDelivery} />}
            {step === "podaci" && <StepDetails delivery={delivery} form={form} errors={errors} setField={setField} />}
            {step === "posveta" && (
              <StepDedication
                dedication={dedication}
                setDedication={setDedication}
                occasion={occasion}
                setOccasion={setOccasion}
                pickup={pickup}
              />
            )}
            {step === "pregled" && (
              <StepReview
                version={version}
                mode={mode}
                quote={quote}
                delivery={delivery}
                form={form}
                dedication={dedication}
                occasion={occasion}
                payment={payment}
                setPayment={setPayment}
                problem={problem}
              />
            )}
            {step === "hvala" && done && <StepDone done={done} />}
          </div>
        </div>

        {/* Sticky footer */}
        {footer && (
          <div className="shrink-0 bg-[#120A0E] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-12px_rgba(0,0,0,0.6)]">
            <div className="mx-auto w-full max-w-xl">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

function PrimaryButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${disabled ? "" : "glow-halo"} metal relative w-full h-14 rounded-full font-poppins text-[15px] font-semibold tracking-widest cursor-pointer transition-transform active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed`}
      style={{ "--glow": "var(--accent)" } as CSSProperties}
    >
      {children}
    </button>
  );
}

function RoundButton({ label, disabled, onClick, children, big }: {
  label: string; disabled?: boolean; onClick: () => void; children: ReactNode; big?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${big ? "h-14 w-14" : "h-11 w-11"} flex shrink-0 items-center justify-center rounded-full border border-foreground/15 text-foreground transition-colors hover:border-accent hover:text-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30 cursor-pointer`}
    >
      {children}
    </button>
  );
}

/** A big tappable row - tap-only steps move on by themselves. */
function ChoiceCard({ on, onClick, i, children }: { on: boolean; onClick: () => void; i: number; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={CARD_IN(i)}
      className={`bm-card-in flex w-full items-center gap-4 rounded-3xl border px-4 py-3.5 text-left transition-colors cursor-pointer active:scale-[0.99] ${
        on ? "border-accent bg-accent/10" : "border-foreground/10 bg-foreground/[0.03] hover:border-foreground/25"
      }`}
    >
      {children}
      <ChevronRight size={20} className={`ml-auto shrink-0 ${on ? "text-accent" : "text-foreground/30"}`} />
    </button>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepFor({ version, onPick }: { version: GiftVersion; onPick: (v: GiftVersion) => void }) {
  const cards: { v: GiftVersion; title: string; text: string }[] = [
    { v: "zenska", title: "Za nju", text: "Zlatna mašna, plišani meda, Ferrero, Raffaello, kolačić sreće i brijač „poslednji koji će ti trebati“" },
    { v: "muska", title: "Za njega", text: "Ista premium kutija sa plavom mašnom i voucherom za njega" },
  ];
  return (
    <div className="flex flex-col gap-3 pt-1">
      {cards.map((c, i) => (
        <ChoiceCard key={c.v} on={version === c.v} onClick={() => onPick(c.v)} i={i}>
          <GiftBox uid={`za-${c.v}`} ribbon={c.v === "zenska" ? "gold" : "blue"} still className="h-[88px] w-[88px] shrink-0" />
          <span className="min-w-0">
            <span className="block font-playfair text-[1.6rem] leading-tight text-foreground">{c.title}</span>
            <span className="mt-1 block font-poppins text-[13px] leading-snug text-foreground/60">{c.text}</span>
          </span>
        </ChoiceCard>
      ))}
      <p className="bm-card-in mt-1 text-center font-poppins text-meta text-foreground/50" style={CARD_IN(2)}>
        Bež-zlatna kutija sa Infinity logom, mašnom, stikerom i tvojom posvetom - spremna za ispod jelke.
      </p>
    </div>
  );
}

function StepMode({ version, mode, her, onPick }: { version: GiftVersion; mode: GiftMode; her: string; onPick: (m: GiftMode) => void }) {
  const cards: { m: GiftMode; Icon: typeof Coins; title: string; text: string; tag?: string }[] = [
    { m: "iznos", Icon: Coins, title: "Iznos", text: `Ti biraš koliko, ${her} bira tretmane`, tag: "Najlakše" },
    { m: "regije", Icon: Layers, title: "Regije i broj tretmana", text: "Ti biraš šta i koliko puta" },
    { m: "paket", Icon: Gift, title: "Paket 3 · 6 · 8 tretmana", text: "Gotov paket, gratis tretman uključen" },
  ];
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {cards.map((c, i) => (
        <ChoiceCard key={c.m} on={mode === c.m} onClick={() => onPick(c.m)} i={i}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <c.Icon size={22} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-poppins text-[16px] font-semibold text-foreground">{c.title}</span>
              {c.tag && <span className="rounded-full metal px-2 py-0.5 font-poppins text-[10px] font-bold uppercase tracking-wider">{c.tag}</span>}
            </span>
            <span className="mt-0.5 block font-poppins text-[13px] text-foreground/60">{c.text}</span>
          </span>
        </ChoiceCard>
      ))}
      <div className="bm-card-in mt-2 rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-3" style={CARD_IN(3)}>
        <p className="flex items-center gap-2 font-poppins text-[13px] font-semibold text-foreground">
          <Gift size={15} className="text-accent" /> Veći poklon - gratis tretman
        </p>
        <p className="mt-1 font-poppins text-[13px] text-foreground/65">
          {PACKAGE_SIZES.map((t) => `${t} tretmana → ${BONUS_LADDER[version][t].label.toLowerCase()}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function AmountPicker({ version, services, amountIdx, setAmountIdx, her }: {
  version: GiftVersion; services: GiftService[]; amountIdx: number; setAmountIdx: (i: number) => void; her: string;
}) {
  const amount = AMOUNTS[amountIdx];
  const last = AMOUNTS.length - 1;
  const pct = (i: number) => (i / last) * 100;
  const examples = AMOUNT_EXAMPLES[version].flatMap((names) => {
    const ids = idsByNames(names, services);
    if (ids.length === 0) return [];
    const { perSession, names: shown } = regionsPrice(ids, services);
    const n = perSession > 0 ? Math.floor(amount / perSession) : 0;
    return n > 0 ? [`${n >= 8 ? "ceo ciklus" : `${n}×`} ${shown.join(" + ").toLowerCase()}`] : [];
  });

  return (
    <div className="pt-1">
      <p className="text-center">
        <span className="font-playfair text-[3rem] leading-none text-foreground tabular-nums">{formatNumber(amount)}</span>
        <span className="ml-1.5 font-poppins text-base text-foreground/55">RSD</span>
      </p>
      <p className="mt-1 text-center font-poppins text-[12px] text-foreground/45">≈ {Math.round(amount / EUR_RATE / 5) * 5} €</p>

      <div className="mt-3 flex items-center gap-2.5">
        <RoundButton label="Smanji iznos" disabled={amountIdx === 0} onClick={() => setAmountIdx(Math.max(0, amountIdx - 1))}>
          <Minus size={18} />
        </RoundButton>
        <div className="relative flex-1 pt-6">
          {AMOUNT_TIERS.map((t) => {
            const i = AMOUNTS.indexOf(t.min);
            const reached = amount >= t.min;
            return (
              <button
                key={t.min}
                type="button"
                onClick={() => setAmountIdx(i)}
                aria-label={`${formatRsd(t.min)} - ${BONUS_LADDER[version][t.tier].label} gratis`}
                className={`absolute top-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full transition-colors cursor-pointer ${
                  reached ? "bg-accent text-on-accent" : "bg-foreground/10 text-foreground/50"
                }`}
                style={{ left: `calc(15px + (100% - 30px) * ${pct(i) / 100})` }}
              >
                <Gift size={13} strokeWidth={2.2} />
              </button>
            );
          })}
          <input
            type="range"
            className="pk-range"
            min={0}
            max={last}
            step={1}
            value={amountIdx}
            onChange={(e) => setAmountIdx(Number(e.target.value))}
            aria-label="Iznos vouchera"
            aria-valuetext={formatRsd(amount)}
            style={{ "--fill": `${pct(amountIdx)}%` } as CSSProperties}
          />
        </div>
        <RoundButton label="Povećaj iznos" disabled={amountIdx === last} onClick={() => setAmountIdx(Math.min(last, amountIdx + 1))}>
          <Plus size={18} />
        </RoundButton>
      </div>

      {examples.length > 0 && (
        <p className="mt-2 text-center font-poppins text-[12px] leading-relaxed text-foreground/55">
          Dovoljno za npr. {examples.join(" · ")} - {her} bira u studiju.
        </p>
      )}
    </div>
  );
}

function RegionPicker({ version, services, ids, setIds }: {
  version: GiftVersion; services: GiftService[]; ids: string[]; setIds: (ids: string[]) => void;
}) {
  const regions = pickableRegions(services);
  const picks = POPULAR_PICKS[version]
    .map((p) => ({ label: p.label, ids: idsByNames(p.names, services) }))
    .filter((p) => p.ids.length > 0);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  return (
    <div className="pt-1">
      {picks.length > 0 && (
        <>
          <p className="font-poppins text-eyebrow uppercase tracking-[0.16em] text-foreground/45">
            {version === "zenska" ? "Žene najčešće biraju" : "Muškarci najčešće biraju"}
          </p>
          <div className="pk-noscroll -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {picks.map((p, i) => {
              const on = same(ids, p.ids);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setIds(p.ids)}
                  aria-pressed={on}
                  style={CARD_IN(i)}
                  className={`bm-card-in inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-poppins text-[14px] transition-colors cursor-pointer ${
                    on ? "metal font-semibold" : "border border-accent/40 text-accent"
                  }`}
                >
                  <Sparkles size={14} /> {p.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-4 font-poppins text-eyebrow uppercase tracking-[0.16em] text-foreground/45">Ili izaberi sam</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {regions.map((r, i) => {
          const on = ids.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setIds(toggleRegion(ids, r.id, services))}
              aria-pressed={on}
              style={CARD_IN(i)}
              className={`bm-card-in relative rounded-2xl border px-2 py-2.5 text-center transition-colors cursor-pointer ${
                on ? "border-accent bg-accent/12" : "border-foreground/10 bg-foreground/[0.03]"
              }`}
            >
              {on && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <span className="block truncate font-poppins text-[14px] font-medium text-foreground">{r.name}</span>
              <span className="block font-poppins text-[11px] text-foreground/50 tabular-nums">{formatNumber(r.price)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center font-poppins text-[12px] text-foreground/45">Cene su po jednom tretmanu.</p>
    </div>
  );
}

function SessionsPicker({ sessions, setSessions, regionIds, services }: {
  sessions: number; setSessions: (n: number) => void; regionIds: string[]; services: GiftService[];
}) {
  const { perSession, names } = regionsPrice(regionIds, services);
  return (
    <div className="pt-1 text-center">
      <div className="flex items-center justify-center gap-6">
        <RoundButton big label="Manje tretmana" disabled={sessions <= MIN_SESSIONS} onClick={() => setSessions(sessions - 1)}>
          <Minus size={22} />
        </RoundButton>
        <span className="w-16 font-playfair text-[3.5rem] leading-none text-foreground tabular-nums" aria-live="polite">{sessions}</span>
        <RoundButton big label="Više tretmana" disabled={sessions >= MAX_SESSIONS} onClick={() => setSessions(sessions + 1)}>
          <Plus size={22} />
        </RoundButton>
      </div>
      <p className="mt-2 font-poppins text-[13px] text-foreground/55">
        {sessions >= 6 ? "6–8 tretmana je ceo ciklus za telo ✓" : "Za trajan rezultat telu treba 6–8 tretmana"}
      </p>
      <p className="mt-1 font-poppins text-[13px] text-foreground/45 tabular-nums">
        {names.join(" + ")}: {formatNumber(perSession)} × {sessions} = <span className="text-foreground/80">{formatRsd(perSession * sessions)}</span>
      </p>
    </div>
  );
}

const PACKAGE_TAG: Record<number, string> = { 3: "Za početak", 6: "Ciklus za telo", 8: "Ceo ciklus · najveći bonus" };

function PackagePicker({ version, services, ids, pkg, setPkg }: {
  version: GiftVersion; services: GiftService[]; ids: string[]; pkg: Size; setPkg: (n: Size) => void;
}) {
  const { names } = regionsPrice(ids, services);
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <p className="font-poppins text-[13px] text-foreground/55">{names.join(" + ")}</p>
      {PACKAGE_SIZES.map((n, i) => {
        const q = quoteGift({ version, mode: "paket", regionIds: ids, sessions: n }, services);
        const b = bonusFor(version, n, services);
        const on = pkg === n;
        const top = n === 8;
        return (
          <button
            key={n}
            type="button"
            onClick={() => setPkg(n)}
            aria-pressed={on}
            style={{ ...CARD_IN(i), ...(top ? { "--glow": "var(--accent)" } : {}) } as CSSProperties}
            className={`bm-card-in relative flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer ${
              on ? "border-accent bg-accent/10" : "border-foreground/10 bg-foreground/[0.03]"
            } ${top ? "glow-card" : ""}`}
          >
            <span className="flex w-12 shrink-0 flex-col items-center">
              <span className="font-playfair text-[2rem] leading-none text-foreground">{n}</span>
              <span className="font-poppins text-[11px] text-foreground/55">tretmana</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-poppins text-eyebrow uppercase tracking-[0.12em] ${top ? "text-accent" : "text-foreground/50"}`}>{PACKAGE_TAG[n]}</span>
              {b && (
                <span className="mt-0.5 flex items-center gap-1.5 font-poppins text-[14px] text-foreground">
                  <Gift size={14} className="shrink-0 text-accent" />
                  <span className="truncate">+ {b.label.toLowerCase()} gratis</span>
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-poppins text-[16px] font-semibold text-foreground tabular-nums">{q.ok ? formatNumber(q.total) : "-"}</span>
              <span className="block font-poppins text-[11px] text-foreground/45">{!q.ok && q.reason === "min" ? "ispod minimuma" : "RSD"}</span>
            </span>
            {on && (
              <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-on-accent">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The three bonus steps, filled up to where the choice stands. */
function BonusTrack({ version, mode, tier, services }: { version: GiftVersion; mode: GiftMode; tier: Tier; services: GiftService[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/[0.06] px-3 pt-3 pb-2.5">
      <p className="flex items-center justify-center gap-1.5 font-poppins text-[12px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
        <Gift size={13} className="text-accent" /> Gratis tretman
      </p>
      <ol className="mt-2 grid grid-cols-3 gap-1.5">
        {PACKAGE_SIZES.map((t) => {
          const reached = tier >= t;
          const current = tier === t;
          const b = bonusFor(version, t, services);
          const at = mode === "iznos" ? `od ${formatNumber(AMOUNT_TIERS.find((x) => x.tier === t)!.min)}` : `${t} tretmana`;
          return (
            <li key={`${t}-${reached}`} className="flex flex-col items-center text-center">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                reached ? "border-accent bg-accent text-on-accent pk-won" : "border-foreground/20 text-foreground/40"
              }`}>
                {reached ? <Check size={14} strokeWidth={3} /> : <Gift size={13} />}
              </span>
              <span className="mt-1 font-poppins text-[10px] text-foreground/45 tabular-nums">{at}</span>
              <span className={`font-poppins text-[12px] leading-tight ${
                current ? "font-semibold text-accent" : reached ? "text-foreground/45 line-through decoration-foreground/30" : "text-foreground/75"
              }`}>
                {b?.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Dodaj još jedan tretman i dobijaš nausnice gratis" - with a button that does it. */
function Nudge({ version, mode, services, amount, sessions, pkg, regionIds, onAmount, onSessions, onPkg }: {
  version: GiftVersion; mode: GiftMode; services: GiftService[]; amount: number; sessions: number; pkg: Size;
  regionIds: string[]; onAmount: (a: number) => void; onSessions: (n: number) => void; onPkg: (n: Size) => void;
}) {
  const label = (t: 3 | 6 | 8) => BONUS_LADDER[version][t].label.toLowerCase();
  let text: string;
  let action: { label: string; run: () => void } | null = null;

  if (mode === "iznos") {
    const cur = tierForAmount(amount);
    const nxt = nextAmountTier(amount);
    if (!nxt) text = `Osvojen je najveći bonus: ${label(8)} gratis.`;
    else {
      text = `Uplati ${formatNumber(nxt.min)} i ${cur ? `bonus raste na ${label(nxt.tier)}` : `dobijaš i ${label(nxt.tier)}`} gratis.`;
      action = { label: `Na ${formatNumber(nxt.min)}`, run: () => onAmount(nxt.min) };
    }
  } else if (mode === "regije") {
    const cur = tierForSessions(sessions);
    const nxt = nextSessionTier(sessions);
    if (!nxt) text = `Osvojen je najveći bonus: ${label(8)} gratis.`;
    else {
      const more = nxt.missing === 1 ? "još jedan tretman" : `još ${nxt.missing} tretmana`;
      text = `Dodaj ${more} i ${cur ? `bonus raste na ${label(nxt.tier)}` : `dobijaš ${label(nxt.tier)}`} gratis.`;
      action = { label: `Dodaj (${nxt.tier})`, run: () => onSessions(nxt.tier) };
    }
  } else if (pkg === 8) {
    text = `Najveći paket: ceo ciklus i ${label(8)} gratis.`;
  } else {
    const nextSize: Size = pkg === 3 ? 6 : 8;
    const a = quoteGift({ version, mode: "paket", regionIds, sessions: pkg }, services);
    const b = quoteGift({ version, mode: "paket", regionIds, sessions: nextSize }, services);
    text = a.ok && b.ok
      ? `Za još ${formatRsd(b.total - a.total)}: ${nextSize - pkg} ${treatmentsWord(nextSize - pkg)} više i ${label(nextSize)} gratis.`
      : `Paket od ${nextSize}: ${label(nextSize)} gratis.`;
    action = { label: `Uzmi ${nextSize}`, run: () => onPkg(nextSize) };
  }

  return (
    <div key={text} className="pk-pop mt-3 flex items-center gap-3 rounded-2xl bg-[#2A1821] px-3.5 py-2.5 shadow-lg shadow-black/30" aria-live="polite">
      <Sparkles size={18} className="shrink-0 text-accent" />
      <p className="flex-1 font-poppins text-[13px] leading-snug text-foreground/85">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="metal shrink-0 rounded-full px-3.5 h-9 font-poppins text-[13px] font-semibold cursor-pointer active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const DELIVERIES: { id: Delivery; title: string; text: string; Icon: typeof Truck }[] = [
  { id: "novi_sad", title: "Dostava u Novom Sadu", text: "Donosimo ga lično na adresu", Icon: Truck },
  { id: "posta", title: "Van Novog Sada", text: "Šaljemo ga poštom", Icon: Package },
  { id: "studio", title: "Preuzimam u studiju", text: `Rezervišemo ga za tebe - ${STUDIO_ADDRESS}`, Icon: Store },
];

function StepDelivery({ delivery, onPick }: { delivery: Delivery; onPick: (d: Delivery) => void }) {
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {DELIVERIES.map((d, i) => (
        <ChoiceCard key={d.id} on={delivery === d.id} onClick={() => onPick(d.id)} i={i}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <d.Icon size={22} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block font-poppins text-[16px] font-semibold text-foreground">{d.title}</span>
            <span className="mt-0.5 block font-poppins text-[13px] text-foreground/60">{d.text}</span>
          </span>
        </ChoiceCard>
      ))}
      <p className="bm-card-in mt-2 flex items-center justify-center gap-1.5 font-poppins text-meta text-foreground/50" style={CARD_IN(3)}>
        <Wallet size={14} className="text-accent" /> Plaćaš pouzećem - kad paketić stigne
      </p>
    </div>
  );
}

function inputClass(error?: string, multiline = false) {
  return `w-full ${multiline ? "min-h-[96px] py-3 resize-none" : "h-12"} rounded-xl border bg-foreground/[0.04] px-4 font-poppins text-[16px] text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-accent ${
    error ? "border-red-400/70" : "border-foreground/12"
  }`;
}

function Input({ id, label, error, hint, className = "", ...rest }: {
  id: string; label: string; error?: string; hint?: string; className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={`pk-${id}`} className="mb-1 block font-poppins text-[13px] font-medium text-foreground/70">{label}</label>
      <input id={`pk-${id}`} className={inputClass(error)} aria-invalid={!!error} {...rest} />
      {error
        ? <p className="mt-1 font-poppins text-[12px] text-red-300">{error}</p>
        : hint && <p className="mt-1 font-poppins text-[12px] text-foreground/40">{hint}</p>}
    </div>
  );
}

function StepDetails({ delivery, form, errors, setField }: {
  delivery: Delivery;
  form: typeof EMPTY_FORM;
  errors: Errors;
  setField: (k: keyof typeof EMPTY_FORM, v: string) => void;
}) {
  const bind = (k: keyof typeof EMPTY_FORM) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(k, e.target.value),
  });
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 pt-1">
      <Input id="name" label="Ime i prezime" error={errors.name} autoComplete="name" maxLength={120} className="col-span-2" {...bind("name")} />
      <Input id="phone" label="Telefon" error={errors.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="06x xxx xxxx" maxLength={30} className="col-span-2" {...bind("phone")} />
      {delivery !== "studio" && (
        <>
          <Input id="address" label="Ulica i broj" error={errors.address} autoComplete="street-address" maxLength={200} className="col-span-2" {...bind("address")} />
          {delivery === "posta" && (
            <>
              <Input id="city" label="Mesto" error={errors.city} autoComplete="address-level2" maxLength={100} {...bind("city")} />
              <Input id="postal_code" label="Poštanski broj" error={errors.postal_code} inputMode="numeric" autoComplete="postal-code" maxLength={12} {...bind("postal_code")} />
            </>
          )}
          <Input id="delivery_note" label="Napomena (nije obavezno)" placeholder="Sprat, stan, interfon…" maxLength={300} className="col-span-2" {...bind("delivery_note")} />
        </>
      )}
      <Input id="email" label="Email (nije obavezno)" hint="Za potvrdu porudžbine." error={errors.email} type="email" inputMode="email" autoComplete="email" maxLength={200} className="col-span-2" {...bind("email")} />
      {/* Bots fill every field - people never see this one. */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" {...bind("website")} />
    </div>
  );
}

function StepDedication({ dedication, setDedication, occasion, setOccasion, pickup }: {
  dedication: string; setDedication: (s: string) => void; occasion: Occasion; setOccasion: (o: Occasion) => void; pickup: boolean;
}) {
  return (
    <div className="pt-1">
      {/* The card it will be written on, live */}
      <div className="pk-card-paper mx-auto w-[min(100%,260px)] -rotate-2 rounded-md px-5 pt-3.5 pb-4" aria-hidden="true">
        <p className="font-poppins text-[9px] uppercase tracking-[0.3em] text-[#9C7535]">∞ Infinity</p>
        <p className={`pk-hand mt-1.5 min-h-[58px] text-[22px] leading-[1.15] whitespace-pre-line break-words ${dedication ? "" : "opacity-40"}`}>
          {dedication || "Ovde će stajati tvoja posveta…"}
        </p>
      </div>

      <label htmlFor="pk-dedication" className="sr-only">Posveta</label>
      <textarea
        id="pk-dedication"
        className={`${inputClass(undefined, true)} mt-4`}
        value={dedication}
        onChange={(e) => setDedication(e.target.value.slice(0, DEDICATION_MAX))}
        rows={3}
        maxLength={DEDICATION_MAX}
        placeholder="Za moju omiljenu osobu - srećna Nova godina!"
      />
      <p className="mt-1 flex justify-between gap-3 font-poppins text-[12px] text-foreground/40">
        <span>{pickup ? "Napisaćemo je rukom - ili je napiši sam pri preuzimanju." : "Napisaćemo je rukom na kartončić."}</span>
        <span className="tabular-nums">{dedication.length}/{DEDICATION_MAX}</span>
      </p>

      <p className="mt-4 font-poppins text-[13px] font-medium text-foreground/70">Stiker na kutiji</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Stiker na kutiji">
        {(Object.keys(OCCASION_LABEL) as Occasion[]).map((o) => {
          const on = occasion === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setOccasion(o)}
              className={`rounded-full px-4 h-10 font-poppins text-[14px] transition-colors cursor-pointer ${
                on ? "metal font-semibold" : "border border-foreground/15 text-foreground/75"
              }`}
            >
              {OCCASION_LABEL[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepReview({ version, mode, quote, delivery, form, dedication, occasion, payment, setPayment, problem }: {
  version: GiftVersion; mode: GiftMode; quote: GiftQuote; delivery: Delivery; form: typeof EMPTY_FORM;
  dedication: string; occasion: Occasion; payment: Payment; setPayment: (p: Payment) => void; problem: string | null;
}) {
  if (!quote.ok) return null;
  return (
    // Personal data: masked in Clarity recordings, like the booking modal's last step.
    <div className="pt-4" data-clarity-mask="true">
      {/* The order, written out on paper - laid down first, then written */}
      <div className="bm-paper-in mx-auto w-full max-w-md px-1">
        <GiftSheet
          version={version}
          mode={mode}
          quote={quote}
          delivery={delivery}
          address={form.address}
          city={form.city}
          name={form.name}
          phone={form.phone}
          dedication={dedication}
          occasion={occasion}
          payment={payment}
        />
      </div>

      {/* The sheet already says "pouzećem"; a choice shows only once cards are on. */}
      {CARD_PAYMENTS_ON && (
        <div className="mt-6 grid gap-2" role="radiogroup" aria-label="Plaćanje">
          <PayOption
            on={payment === "pouzece"}
            onPick={() => setPayment("pouzece")}
            Icon={Wallet}
            title={delivery === "studio" ? "Plaćam pri preuzimanju" : "Pouzećem"}
            text={delivery === "studio" ? "Plaćaš kad dođeš po paketić" : "Plaćaš kad ti paketić stigne"}
          />
          <PayOption on={payment === "kartica"} onPick={() => setPayment("kartica")} Icon={CreditCard} title="Karticom na sajtu" text="Sigurno plaćanje karticom" />
        </div>
      )}

      {problem && (
        <p role="alert" className="mt-5 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 font-poppins text-[14px] text-foreground">
          {problem}
        </p>
      )}
    </div>
  );
}

function PayOption({ on, onPick, Icon, title, text }: { on: boolean; onPick: () => void; Icon: typeof Wallet; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer ${
        on ? "border-accent bg-accent/10" : "border-foreground/10 bg-foreground/[0.03]"
      }`}
    >
      <Icon size={20} className={on ? "text-accent" : "text-foreground/50"} strokeWidth={1.8} />
      <span className="min-w-0 flex-1">
        <span className="block font-poppins text-[15px] font-semibold text-foreground">{title}</span>
        <span className="block font-poppins text-[12px] text-foreground/55">{text}</span>
      </span>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? "border-accent bg-accent text-on-accent" : "border-foreground/25"}`}>
        {on && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Gold confetti, spread evenly around a circle - the same every time. */
const CONFETTI = Array.from({ length: 26 }, (_, i) => {
  const angle = (i / 26) * Math.PI * 2;
  const dist = 90 + (i % 5) * 28;
  return {
    "--bx": `${Math.round(Math.cos(angle) * dist)}px`,
    "--by": `${Math.round(Math.sin(angle) * dist - 40)}px`,
    "--br": `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
    background: ["#F1DCAE", "#D9B46F", "#FFFFFF", "#9C7535"][i % 4],
    animationDelay: `${(i % 4) * 40}ms`,
  } as CSSProperties;
});

function StepDone({ done }: { done: Done }) {
  const first = done.name.split(/\s+/)[0];
  return (
    <div className="relative flex min-h-full flex-col items-center pt-6 text-center" role="status">
      {CONFETTI.map((style, i) => <span key={i} className="pk-confetti" style={style} aria-hidden="true" />)}
      <GiftBox uid="done" className="h-36 w-36" />
      <p className="mt-2 font-poppins text-eyebrow uppercase tracking-[0.2em] text-accent">Paketić br. {done.orderNo}</p>
      <h3 className="mt-2 font-playfair text-[2rem] leading-tight text-foreground">
        {first ? `Hvala, ${first}!` : "Hvala!"}<br />Paketić je {done.pickup ? "rezervisan" : "poručen"}.
      </h3>
      <p className="mt-3 max-w-sm font-poppins text-copy text-foreground/70">
        Javićemo ti se na <strong className="text-foreground">{done.phone}</strong> da potvrdimo{" "}
        {done.pickup ? "kada možeš da ga preuzmeš" : "dostavu"}. Ukupno: {formatRsd(done.total)}.
      </p>
      {done.remaining != null && (
        <p className="mt-3 font-poppins text-meta text-foreground/50">Ostalo je još {done.remaining} od {GIFT_LIMIT} paketića.</p>
      )}
    </div>
  );
}
