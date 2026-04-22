# Plan: "Pozivi" Call Tracking Feature

## Decisions (aligned with user)
- UI: Separate "Pozivi" tab inside `app/admin/page.tsx` with a badge count
- Timer: DB timestamp + UI indicator only — no cron, no server job
- DB: 2 new columns on `reservations`
- Queue: all `status = 'pending'` reservations appear automatically
- Expiry: prompt to confirm cancel (not silent auto-cancel)
- Answer: `call_status = 'answered'` → removed from queue, reservation status unchanged

---

## Step 1 — DB Migration (manual SQL in Supabase dashboard)

```sql
ALTER TABLE reservations
  ADD COLUMN call_status text NOT NULL DEFAULT 'none'
    CHECK (call_status IN ('none', 'no_answer', 'answered')),
  ADD COLUMN call_attempted_at timestamptz;
```

No other tables touched.

---

## Step 2 — Type update in `app/admin/page.tsx`

Add to `ReservationFull`:
```ts
call_status: 'none' | 'no_answer' | 'answered';
call_attempted_at: string | null;
```

---

## Step 3 — Supabase query update

The existing `fetchRange` select already uses `*` so the new columns come back automatically. No query change needed.

---

## Step 4 — Tab state

Add to component state:
```ts
const [activeTab, setActiveTab] = useState<'calendar' | 'calls'>('calendar');
```

Badge count = `reservations.filter(r => r.status === 'pending' && r.call_status !== 'answered').length`

---

## Step 5 — Tab switcher UI (in the Navigation bar)

Replace or extend the navigation bar to show two tabs:
```
[ Kalendar ]  [ Pozivi  (3) ]
```
Sits between the week navigation and the "Nova rezervacija" button area.

---

## Step 6 — "Pozivi" tab content

Renders a list replacing the calendar grid when `activeTab === 'calls'`.

Each row shows:
- Customer name + phone
- Date + time of reservation
- Call status indicator

### Row states:

| call_status | call_attempted_at vs now | Row appearance | Actions |
|-------------|--------------------------|----------------|---------|
| `none` | — | Normal | [Javio se] [Nije se javio] |
| `no_answer` | < 24h ago | Yellow warning | "Pozovi ponovo za Xh" — [Javio se] [Nije se javio] |
| `no_answer` | >= 24h ago | Red ⚠ Rok istekao | Click ⚠ → confirm dialog |
| `answered` | — | Not shown (filtered out) | — |

### Confirm dialog (inline, not a modal):
```
Rok od 24h je istekao.
Da li želite da otkažete rezervaciju?
[ Otkaži rezervaciju ]  [ Ostavi na čekanju ]
```
"Otkaži" → sets `status = 'cancelled'` in DB, removes from list.
"Ostavi" → dismisses dialog, row stays.

---

## Step 7 — Call action handlers

Two new async functions:

### `handleCallAnswered(reservationId: string)`
```ts
await supabase
  .from('reservations')
  .update({ call_status: 'answered' })
  .eq('id', reservationId);
// Update local state
```

### `handleCallNoAnswer(reservationId: string)`
```ts
await supabase
  .from('reservations')
  .update({ call_status: 'no_answer', call_attempted_at: new Date().toISOString() })
  .eq('id', reservationId);
// Update local state
```

### `handleExpiredCancel(reservationId: string)`
```ts
await supabase
  .from('reservations')
  .update({ status: 'cancelled' })
  .eq('id', reservationId);
// Update local state
```

---

## Step 8 — Resolve existing merge conflict

File currently has a conflict at lines 24–34 (`STATUS_STYLES` for `no_show`).
Resolution: keep HEAD version (slate colors, label "Nije se pojavila").

---

## Files touched

| File | Change |
|------|--------|
| `app/admin/page.tsx` | Resolve conflict, add tab state, tab UI, Pozivi list, 3 handlers, type update |
| Supabase dashboard | Run the ALTER TABLE SQL manually |

## Files NOT touched
- `components/AdminReservationModal.tsx`
- `lib/database.types.ts` (unless types are auto-generated; if so, regenerate after migration)
- Any other file

---

## What this does NOT include (intentional)
- No cron / Edge Function
- No push/email notifications
- No call history (only latest attempt stored)
- No new page or route
- No changes to the calendar view behavior
