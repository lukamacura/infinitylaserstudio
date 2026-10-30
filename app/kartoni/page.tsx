"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminLogin from "@/components/AdminLogin";
import KartonClientSheet from "@/components/karton/KartonClientSheet";
import KartonDrawer from "@/components/karton/KartonDrawer";
import KartonSheet from "@/components/karton/KartonSheet";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAdminLocation } from "@/lib/adminLocation";
import { locationTheme } from "@/lib/locations";
import {
  createKarton, fetchKartoniToday, searchKartoni, KARTONI_PAGE_SIZE,
  type ClientDraft, type KartonListItem, type KartonTodayItem,
} from "@/lib/kartoni";

const EMPTY_DRAFT: ClientDraft = { name: "", phone: "", email: "", gender: null };

export default function KartoniPage() {
  const router = useRouter();
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  const { location, setLocation } = useAdminLocation();

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KartonListItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [today, setToday] = useState<KartonTodayItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; draft: ClientDraft } | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [creatingAnyway, setCreatingAnyway] = useState(false);

  /** Only the newest search may fill the list - an older answer can arrive last. */
  const requestId = useRef(0);

  const load = useCallback(async (text: string, offset: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    try {
      const rows = await searchKartoni(text, offset);
      if (id !== requestId.current) return;
      setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === KARTONI_PAGE_SIZE);
    } catch {
      if (id === requestId.current) setFailed(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const t = setTimeout(() => void load(query.trim(), 0), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [authenticated, query, load]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    fetchKartoniToday(location)
      .then((rows) => { if (active) setToday(rows); })
      .catch(() => { if (active) setToday([]); });
    return () => { active = false; };
  }, [authenticated, location]);

  async function submitNew(draft: ClientDraft, force = false): Promise<string | null> {
    try {
      const result = await createKarton(draft, force);
      if (result.status === "created") {
        router.push(`/kartoni/${result.id}`);
        return null;
      }
      if (result.status === "exists") {
        setAdding(false);
        setDuplicate({ id: result.id, name: result.name, draft });
        return null;
      }
      return "Upišite ime i prezime.";
    } catch {
      return "Karton nije napravljen. Proverite internet i pokušajte ponovo.";
    }
  }

  /** Stays busy on success until the page changes: a second tap would make a second card. */
  async function createAnyway(draft: ClientDraft) {
    setCreatingAnyway(true);
    setDuplicateError(null);
    const error = await submitNew(draft, true);
    if (error) {
      setDuplicateError(error);
      setCreatingAnyway(false);
    }
  }

  function closeDuplicate() {
    setDuplicate(null);
    setDuplicateError(null);
  }

  if (!authenticated) {
    return <AdminLogin icon={NotebookPen} location={location} onSignIn={signIn} checking={authState === null} />;
  }

  return (
    <main className="min-h-dvh flex flex-col bg-background text-foreground admin-theme" style={locationTheme(location)}>
      <AdminHeader current="kartoni" location={location} onLocationChange={setLocation} onLogout={() => void signOut()} />

      <KartonDrawer
        query={query}
        onQueryChange={setQuery}
        location={location}
        today={today}
        items={items}
        total={items[0]?.total ?? 0}
        loading={loading}
        failed={failed}
        canLoadMore={hasMore}
        onLoadMore={() => void load(query.trim(), items.length)}
        onRetry={() => void load(query.trim(), 0)}
        onAdd={() => setAdding(true)}
      />

      {adding && (
        <KartonClientSheet
          title="Novi karton"
          submitLabel="Napravi karton"
          initial={EMPTY_DRAFT}
          onClose={() => setAdding(false)}
          onSubmit={(draft) => submitNew(draft)}
        />
      )}

      {duplicate && (
        <KartonSheet title="Karton već postoji" onClose={closeDuplicate}>
          <div className="space-y-3.5">
            <p className="karton-warning">
              Sa ovim podacima već postoji karton: <b>{duplicate.name}</b>. Da li je to ista osoba?
            </p>
            {duplicateError && <p className="karton-warning" role="alert">{duplicateError}</p>}
            <button type="button" onClick={() => router.push(`/kartoni/${duplicate.id}`)} className="karton-btn karton-btn-primary w-full">
              Da, otvori taj karton
            </button>
            <button type="button" disabled={creatingAnyway} onClick={() => void createAnyway(duplicate.draft)} className="karton-btn karton-btn-ghost w-full">
              {creatingAnyway ? "Pravim karton…" : "Ne, napravi nov karton"}
            </button>
          </div>
        </KartonSheet>
      )}
    </main>
  );
}
