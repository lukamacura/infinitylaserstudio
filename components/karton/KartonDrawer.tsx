"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Check, Plus, Search, X } from "lucide-react";
import { getLocation, type LocationId } from "@/lib/locations";
import {
  fmtCardNumber, fmtDate, plural, type KartonListItem, type KartonTodayItem,
} from "@/lib/kartoni";

function TodayStatus({ item }: { item: KartonTodayItem }) {
  if (item.regions.length > 0 && item.filled >= item.regions.length) {
    return <span className="karton-status is-done inline-flex items-center gap-1"><Check size={13} strokeWidth={3} /> uneto</span>;
  }
  if (item.filled > 0) return <span className="karton-status is-waiting">{item.filled}/{item.regions.length}</span>;
  return <span className="karton-status is-waiting">čeka unos</span>;
}

/** Who comes today: the card a worker needs next is one tap away. */
function TodayFolder({ location, items }: { location: LocationId; items: KartonTodayItem[] }) {
  return (
    <section aria-label="Današnji termini" className="mb-6">
      <div className="karton-folder-tab">
        Danas · {getLocation(location).name}
        <span aria-hidden="true">({items.length})</span>
      </div>
      <div className="karton-folder space-y-1.5">
        {items.length === 0 && (
          <p className="karton-printed px-1 py-2 !text-[#2B2621]">Danas nema zakazanih termina u ovom studiju.</p>
        )}
        {items.map((item) => (
          <Link key={`${item.karton_id}:${item.start_time}`} href={`/kartoni/${item.karton_id}`} className="karton-index !pl-3 !pr-3 flex items-center gap-2">
            <span className="karton-today-time">{item.start_time?.slice(0, 5) ?? "—"}</span>
            <span className="min-w-0 flex-1">
              <span className="karton-index-name truncate">{item.name}</span>
              <span className="karton-index-meta truncate">{item.regions.join(", ") || "bez regija"}</span>
            </span>
            <TodayStatus item={item} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function CardMeta({ item }: { item: KartonListItem }) {
  const parts = [item.phone ?? "bez telefona"];
  if (item.next_date) parts.push(`sledeći ${fmtDate(item.next_date)}`);
  else if (item.last_date) parts.push(`poslednji ${fmtDate(item.last_date)}`);
  else if (item.rows_count === 0) parts.push("prazan");
  return <span className="karton-index-meta">{parts.join(" · ")}</span>;
}

/** The list page's body: search, today's folder, then every card from A to Ž. */
export default function KartonDrawer({
  query,
  onQueryChange,
  location,
  today,
  items,
  total,
  loading,
  failed,
  canLoadMore,
  onLoadMore,
  onRetry,
  onAdd,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  location: LocationId;
  today: KartonTodayItem[];
  items: KartonListItem[];
  total: number;
  loading: boolean;
  failed: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onAdd: () => void;
}) {
  const searching = query.trim().length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-5 pt-4 sm:pt-7 pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-playfair tracking-tight leading-tight">Kartoni</h1>
          <p className="text-[12px] font-poppins text-foreground/60 mt-0.5" aria-live="polite">
            {total > 0 ? `${total.toLocaleString("sr-RS")} ${plural(total, "karton", "kartona", "kartona")}` : " "}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-xl bg-accent text-on-accent text-sm font-bold font-poppins cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Plus size={18} strokeWidth={2.5} /> Novi karton
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/45 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ime, telefon ili email…"
          aria-label="Pretraga kartona"
          autoComplete="off"
          className="w-full h-13 pl-12 pr-11 rounded-2xl border-2 border-foreground/10 bg-surface font-poppins text-sm focus:outline-none focus:border-accent/40 transition-colors shadow-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Očisti pretragu"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl text-foreground/55 hover:bg-foreground/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!searching && <TodayFolder location={location} items={today} />}

      {failed && (
        <div className="text-center py-12">
          <p className="text-sm font-bold font-poppins text-foreground/70">Kartoni nisu učitani. Proverite internet.</p>
          <button type="button" onClick={onRetry} className="mt-3 min-h-11 px-4 rounded-xl bg-foreground/5 text-sm font-semibold font-poppins cursor-pointer">
            Pokušaj ponovo
          </button>
        </div>
      )}

      {!failed && !loading && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm font-bold font-poppins text-foreground/70">
            {searching ? "Nema takvog kartona." : "Još nema kartona."}
          </p>
          <button type="button" onClick={onAdd} className="mt-3 text-sm font-semibold font-poppins text-accent underline underline-offset-4 cursor-pointer">
            Napravi nov karton
          </button>
        </div>
      )}

      <div>
        {items.map((item, i) => {
          const letter = (item.name_norm.charAt(0) || "#").toUpperCase();
          const newLetter = i === 0 || letter !== (items[i - 1].name_norm.charAt(0) || "#").toUpperCase();
          return (
            <Fragment key={item.karton_id}>
              {newLetter && <div className={i === 0 ? "" : "pt-5"}><span className="karton-letter">{letter}</span></div>}
              <Link href={`/kartoni/${item.karton_id}`} className={`karton-index block ${newLetter ? "" : "mt-1"}`}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="karton-index-name min-w-0">{item.name}</span>
                  <span className="karton-index-no">Nº {fmtCardNumber(item.number)}</span>
                </span>
                <CardMeta item={item} />
              </Link>
            </Fragment>
          );
        })}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-9 h-9 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && canLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="w-full mt-5 min-h-12 rounded-xl bg-foreground/5 hover:bg-foreground/8 text-sm font-bold font-poppins text-foreground/80 transition-colors cursor-pointer"
        >
          Još kartona
        </button>
      )}
    </div>
  );
}
