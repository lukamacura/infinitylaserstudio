"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneCall, Plus, RefreshCw } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminLogin from "@/components/AdminLogin";
import Spisak from "@/components/upiti/Spisak";
import UpitFormSheet from "@/components/upiti/UpitFormSheet";
import UpitSheet from "@/components/upiti/UpitSheet";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAdminLocation } from "@/lib/adminLocation";
import { locationTheme } from "@/lib/locations";
import { plural } from "@/lib/kartoni";
import { addUpit, fetchUpiti, saveUpit, type Upit, type UpitDraft } from "@/lib/upiti";
import { DATA_CHANGED_EVENT } from "@/lib/infy/events";

export default function UpitiPage() {
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  // Only colours the page: the list is both studios'.
  const { location } = useAdminLocation();

  const [open, setOpen] = useState<Upit[]>([]);
  const [done, setDone] = useState<Upit[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Upit | null>(null);

  /** Only the newest load may fill the list - an older answer can arrive last. */
  const requestId = useRef(0);

  /** Both halves again, keeping as many crossed-out ones as were shown. */
  const reload = useCallback(async (doneCount = 0) => {
    const id = ++requestId.current;
    try {
      const [o, d] = await Promise.all([fetchUpiti(true), fetchUpiti(false)]);
      let doneRows = d;
      while (doneRows.length < doneCount && doneRows.length < (doneRows[0]?.total ?? 0)) {
        const more = await fetchUpiti(false, doneRows.length);
        if (more.length === 0) break;
        doneRows = [...doneRows, ...more];
      }
      if (id !== requestId.current) return;
      setOpen(o);
      setDone(doneRows);
      setStatus("ready");
    } catch {
      // A list already on screen stays; only a first load that failed says so.
      if (id === requestId.current) setStatus((s) => (s === "ready" ? s : "failed"));
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void reload();
  }, [authenticated, reload]);

  // Back from a call or from another app: someone may have booked meanwhile.
  // Infy wrote someone in or changed a follow-up: the same.
  useEffect(() => {
    if (!authenticated) return;
    const onShow = () => {
      if (document.visibilityState === "visible") void reload(done.length);
    };
    const onChanged = () => void reload(done.length);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener(DATA_CHANGED_EVENT, onChanged);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener(DATA_CHANGED_EVENT, onChanged);
    };
  }, [authenticated, reload, done.length]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const more = await fetchUpiti(false, done.length);
      setDone((d) => [...d, ...more.filter((m) => !d.some((x) => x.id === m.id))]);
    } catch {
      /* the button stays, they can tap again */
    } finally {
      setLoadingMore(false);
    }
  }

  const refresh = () => reload(done.length);

  const opened = openedId ? [...open, ...done].find((u) => u.id === openedId) ?? null : null;
  const doneTotal = done[0]?.total ?? 0;

  if (!authenticated) {
    return <AdminLogin icon={PhoneCall} location={location} onSignIn={signIn} checking={authState === null} />;
  }

  return (
    <main className="min-h-dvh flex flex-col bg-background text-foreground admin-theme" style={locationTheme(location)}>
      <AdminHeader
        current="upiti"
        location={location}
        onLogout={() => void signOut()}
        upitiCount={status === "ready" ? open.length : undefined}
      />

      <div className="w-full max-w-2xl mx-auto px-3 sm:px-5 pt-4 sm:pt-7 pb-[calc(3rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 mb-7">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-playfair tracking-tight leading-tight">Upiti</h1>
            <p className="text-[12px] font-poppins text-foreground/60 mt-0.5" aria-live="polite">
              {status === "ready"
                ? open.length > 0
                  ? `${open.length} ${plural(open.length, "osoba čeka", "osobe čekaju", "osoba čeka")} poziv`
                  : "Niko ne čeka poziv"
                : " "}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-xl bg-accent text-on-accent text-sm font-bold font-poppins cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Plus size={18} strokeWidth={2.5} /> Upiši
          </button>
        </div>

        {status === "loading" && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "failed" && (
          <div className="text-center py-20">
            <p className="text-sm font-bold font-poppins text-foreground/70">Spisak nije učitan. Proverite internet.</p>
            <button
              type="button"
              onClick={() => { setStatus("loading"); void reload(); }}
              className="inline-flex items-center gap-2 mt-3 min-h-11 px-4 rounded-xl bg-foreground/5 text-sm font-semibold font-poppins cursor-pointer"
            >
              <RefreshCw size={15} /> Pokušaj ponovo
            </button>
          </div>
        )}

        {status === "ready" && (
          <Spisak
            open={open}
            done={done}
            doneTotal={doneTotal}
            loadingMore={loadingMore}
            onOpen={(u) => setOpenedId(u.id)}
            onAdd={() => setAdding(true)}
            onMore={() => void loadMore()}
          />
        )}
      </div>

      {adding && (
        <UpitFormSheet
          title="Novi upit"
          submitLabel="Upiši na spisak"
          initial={{ name: "", phone: "", source: "instagram", note: "" }}
          openList={open}
          onClose={() => setAdding(false)}
          onSubmit={async (draft: UpitDraft) => {
            try {
              await addUpit(draft);
            } catch {
              return "Nije upisano. Proverite internet i pokušajte ponovo.";
            }
            setAdding(false);
            await refresh();
            return null;
          }}
        />
      )}

      {opened && !editing && (
        <UpitSheet
          upit={opened}
          onClose={() => setOpenedId(null)}
          onChanged={refresh}
          onEdit={() => setEditing(opened)}
        />
      )}

      {editing && (
        <UpitFormSheet
          title="Izmeni upit"
          submitLabel="Sačuvaj"
          initial={{
            name: editing.name,
            phone: editing.phone ?? "",
            source: editing.source,
            note: editing.note,
          }}
          editingId={editing.id}
          openList={open}
          onClose={() => setEditing(null)}
          onSubmit={async (draft: UpitDraft) => {
            try {
              await saveUpit(editing.id, draft);
            } catch {
              return "Nije sačuvano. Proverite internet i pokušajte ponovo.";
            }
            setEditing(null);
            await refresh();
            return null;
          }}
        />
      )}
    </main>
  );
}
