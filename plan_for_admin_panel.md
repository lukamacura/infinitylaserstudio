# Reservation System Implementation

## Tools & Environment
- **Database**: Supabase project `infinity laser studio` (connected via MCP)
- **Frontend**: Next.js (TypeScript), Tailwind CSS, Lucide React, Framer Motion
- **Existing file**: `BookingModal.tsx` (update in place — do not recreate)

---

## Project Overview
Build a complete reservation/booking system for a laser studio web app. The system must handle service-based appointments with variable durations, enforce business hours, prevent double-bookings, and provide an admin calendar view.

---

## Business Logic Rules (Read Carefully)

### Time Slot System
- All time is divided into **10-minute slots**
- Business hours: **07:00 – 17:00** (60 slots/day)
- A booking occupies one or more consecutive 10-minute slots

### Service Duration
Each service has two timing properties:
- `service_duration` — time the actual treatment takes (in minutes)
- `pause_duration` — required cooldown/prep time after the service (in minutes)
- **Total slot occupation** = `ceil((service_duration + pause_duration) / 10)` × 10 minutes

### Multi-Service Bookings
- When a user selects **multiple services**, durations are summed:
  - `total_time = Σ(service_duration + pause_duration)` for all selected services
  - Round up to nearest 10-minute boundary
  - Book that many consecutive slots in a single reservation
- No gaps or splits — the entire booking must be one continuous block

### Conflict Prevention
- A time slot is **unavailable** if any part of it overlaps with an existing confirmed reservation
- The UI must only show slots where the full required block fits before 17:00

---

## Database Schema (Create in Supabase)

Design and create a minimal, normalized schema. It must include at minimum:

- **`services`** table — id, name, description, price, service_duration (int, minutes), pause_duration (int, minutes)
- **`reservations`** table — id, customer_name, customer_email, customer_phone, date (date), start_time (time), end_time (time), total_duration (int), status (enum: pending/confirmed/cancelled), created_at
- **`reservation_services`** join table — reservation_id, service_id (for multi-service support)

Add appropriate indexes for date + time range queries. Enable RLS. Seed a few example services with realistic laser studio durations.

---

## What to Deliver

### 1. Database
- Write and apply all migrations via Supabase MCP
- Seed example services
- Output the exact `.env.local` variables needed (keys, URLs)

### 2. Update `BookingModal.tsx`
- Fetch available services from Supabase
- Let user select one or more services; show running total duration
- Calculate required slots based on total duration
- Fetch booked slots for the selected date
- Display a time picker showing **only available start times** (slots where the full block fits without conflict)
- On submit: create `reservation` + `reservation_services` records
- Show confirmation with booking summary

### 3. Create `/admin` Page (new file: `app/admin/page.tsx`)
- Protected route (simple hardcoded password check or env-based secret is fine for now)
- Calendar view (weekly or monthly) showing all reservations as blocks
- Each block shows: customer name, services booked, time range
- Color-code by status (pending = yellow, confirmed = green, cancelled = grey)
- Ability to click a reservation and change its status
- No external calendar library — build with Tailwind CSS grid

---

## Constraints & Code Standards
- TypeScript strict mode — no `any` types
- All Supabase calls go through a typed client (`lib/supabase.ts`)
- Generate and use Supabase TypeScript types (`database.types.ts`)
- Use Server Components for data fetching where possible; Client Components only where interactivity is needed
- Handle loading and error states in the UI
- Do not modify any files other than `BookingModal.tsx` and the new admin page, unless a shared utility is genuinely needed