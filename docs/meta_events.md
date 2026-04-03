# META Events in this web application

## Pixel ID: 924353527086297

## Standard Meta Events
### Event: PageView
 Where: layout.tsx
 Trigger: Fires on every page load
 ────────────────────────────────────────
### Event: InitiateCheckout
 Where: BookingModal.tsx
 Trigger: User clicks NASTAVI after service selection (Step 2 → Step 3)
 ────────────────────────────────────────
### Event: Schedule
 Where: BookingModal.tsx
 Trigger: User completes a booking
 ────────────────────────────────────────
### Event: Contact
 Where: Footer.tsx
 Trigger: User clicks the contact button
 ────────────────────────────────────────
### Event: Lead
 Where: PromoPopup.tsx
 Trigger: User submits the promo popup form
 ────────────────────────────────────────
### Event: InitiateCheckout
 Where: PromoPopup.tsx
 Trigger: User clicks "book now" inside the promo popup (after email submit)

## Custom Events

### Event: PromoPopupView
 Where: PromoPopup.tsx
 Trigger: Promo popup becomes visible
 ────────────────────────────────────────
### Event: ScrollDepth50
 Where: page.tsx
 Trigger: User scrolls past 50% of the homepage
