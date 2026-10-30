/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, NotebookPen, RefreshCw } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminLogin from "@/components/AdminLogin";
import KartonDeskActions from "@/components/karton/KartonDeskActions";
import KartonPaper from "@/components/karton/KartonPaper";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAdminLocation } from "@/lib/adminLocation";
import { locationTheme } from "@/lib/locations";
import {
  EMPTY_CATALOG, fetchKarton, fetchRegionCatalog, kartonActions, type Karton, type RegionCatalog,
} from "@/lib/kartoni";

export default function KartonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { authenticated: authState, signIn, signOut } = useAdminAuth();
  const authenticated = authState === true;
  const { location, setLocation } = useAdminLocation();

  const [karton, setKarton] = useState<Karton | null>(null);
  const [catalog, setCatalog] = useState<RegionCatalog>(EMPTY_CATALOG);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "failed">("loading");
  /** Bumped when the card is replaced from outside, so its fields start over. */
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const found = await fetchKarton(id);
      setKarton(found);
      setVersion((v) => v + 1);
      setStatus(found ? "ready" : "missing");
    } catch {
      setStatus("failed");
    }
  }, [id]);

  useEffect(() => {
    if (!authenticated) return;
    void load();
    fetchRegionCatalog().then(setCatalog).catch(() => { /* the card still works, only the region list is shorter */ });
  }, [authenticated, load]);

  if (!authenticated) {
    return <AdminLogin icon={NotebookPen} location={location} onSignIn={signIn} checking={authState === null} />;
  }

  return (
    <main className="min-h-dvh flex flex-col bg-background text-foreground admin-theme" style={locationTheme(location)}>
      <AdminHeader current="kartoni" location={location} onLocationChange={setLocation} onLogout={() => void signOut()} />

      <div className="flex-1 w-full max-w-4xl mx-auto px-2.5 sm:px-5 pt-3 sm:pt-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Link
          href="/kartoni"
          className="inline-flex items-center gap-2 min-h-11 px-2 mb-1.5 rounded-xl text-[13px] font-semibold font-poppins text-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Svi kartoni
        </Link>

        {status === "loading" && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "missing" && (
          <div className="text-center py-20">
            <p className="text-sm font-bold font-poppins text-foreground/70">Ovaj karton više ne postoji.</p>
            <Link href="/kartoni" className="inline-block mt-3 text-sm font-semibold font-poppins text-accent underline underline-offset-4">
              Nazad na sve kartone
            </Link>
          </div>
        )}

        {status === "failed" && (
          <div className="text-center py-20">
            <p className="text-sm font-bold font-poppins text-foreground/70">Karton nije učitan. Proverite internet.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 mt-3 min-h-11 px-4 rounded-xl bg-foreground/5 text-sm font-semibold font-poppins cursor-pointer"
            >
              <RefreshCw size={15} /> Pokušaj ponovo
            </button>
          </div>
        )}

        {status === "ready" && karton && (
          <>
            <KartonPaper
              key={version}
              karton={karton}
              catalog={catalog}
              location={location}
              actions={kartonActions}
              update={(change) => setKarton((k) => (k ? change(k) : k))}
            />
            <KartonDeskActions
              karton={karton}
              actions={kartonActions}
              onGone={() => router.replace("/kartoni")}
              onMerged={() => void load()}
            />
          </>
        )}
      </div>
    </main>
  );
}
