# MandiMitra Demo Clone — Build Prompt

Give this to your teammate. They copy everything inside the fenced block below and paste it as one message into whatever AI coding assistant they have on their own computer (Claude Code, Cursor, ChatGPT, etc.). It scaffolds a small, fully offline-safe demo version of MandiMitra — no backend, no database, no API keys, nothing that can fail mid-demo in front of teachers.

This demo clone is separate from the real MandiMitra app. It won't touch the real database or the real Gemini API key, so nothing your teammate does with it can affect the live app or its data.

---

## Prompt to paste into an AI coding assistant

```
Build a small, fully self-contained React web app called "MandiMitra Demo" — a
simplified, offline-safe demo clone of a real mandi (agricultural market)
slot-booking app for Indian farmers. Its only purpose is to show project
progress to teachers/evaluators, so it must run entirely in the browser with
zero backend, zero database, zero external API calls, and zero environment
variables or API keys. It should work with just `npm install && npm run dev`
and nothing else — no signup for any third-party service, ever.

STACK
- React + Vite
- Tailwind CSS
- react-router-dom for pages
- All state in React Context + localStorage (so a demo session survives a
  page refresh, but there is no real server anywhere)
- No backend framework, no ORM, no database, no external APIs of any kind

BE HONEST THAT IT'S A DEMO
Show a small, permanent banner in the layout, visible on every page, that
says: "Demo build — sample data only, not connected to a live server." Never
let any screen imply the data is live or real.

SAMPLE DATA TO SEED (hardcoded in a data/ folder, never fetched from
anywhere)
- 8-10 sample crops (e.g. Wheat, Mustard, Paddy, Maize, Gram, Soybean,
  Groundnut, Cotton) with English + Hindi names
- 6-8 sample mandis across 2-3 states/districts, each with a slotCapacity
  (e.g. 20)
- 6 fixed 2-hour time slots per day, 06:00 to 18:00 (06:00-08:00, 08:00-10:00,
  10:00-12:00, 12:00-14:00, 14:00-16:00, 16:00-18:00)

FEATURES TO BUILD (all working, all local)

1. Register / Login
   - Registration form: name, phone number, password, state, district,
     preferred language (a dropdown for show — it doesn't need to actually
     translate the UI).
   - Store farmer accounts in localStorage. This is a demo, so real password
     hashing isn't needed, but don't display the password anywhere in the UI.
   - Login checks phone + password against what's stored locally.
   - Keep the logged-in farmer in a React Context, persisted to localStorage
     so a refresh doesn't log them out.

2. Browse mandis + book a slot (the core feature — get this right)
   - A dashboard listing the sample mandis.
   - A booking flow where the farmer:
     a. Selects ONE OR MORE crops for the same trip (multi-select, not one
        at a time) and enters a quantity in quintals for each crop picked.
     b. Picks a mandi.
     c. Picks a date (today or later).
     d. Picks a time slot, showing live-looking remaining capacity for that
        mandi + date + slot (computed from how many sample bookings already
        exist in localStorage for that exact combination, out of the
        mandi's slotCapacity).
     e. Confirms — this creates ONE booking record covering all the selected
        crops together (never one booking per crop), with a generated token
        like "MM-DEMO-XXXX", stored in localStorage.
   - A farmer can only have one active (non-cancelled) booking at a time.
   - The farmer's dashboard shows their current active booking with all its
     crops and quantities listed together.

3. Queue tracking + booking pass
   - A "Track Queue" page showing the farmer's position in the queue for
     their active booking: how many other sample bookings for that same
     mandi + date + slot were created before theirs (position = based on
     booking creation order), and the total number waiting.
   - A "My Bookings" page listing booking history (including cancelled
     ones), each with a "Cancel booking" button (sets status to CANCELLED,
     which correctly frees up a slot capacity number) and a "View pass"
     button.
   - The booking pass modal shows: farmer name, all crops + quantities for
     that booking, mandi name, date, time slot, token, and status — and
     generates a QR code (use the "qrcode" npm package, or the
     api.qrserver.com image API) that encodes ALL of those details as
     readable text, not just the token number, so scanning it with any
     phone shows the full pass info offline.

VISUAL STYLE
Clean, modern, mobile-friendly. Agriculture-appropriate palette (greens /
earth tones), rounded cards, Tailwind. A light/dark mode toggle is welcome
if it's not much extra effort, but don't block on it. Bilingual labels are
welcome for flavor (Hindi + English side by side on headings, like "मेरी
बुकिंग · My Bookings"), but a full multi-language switcher is NOT required.

EXPLICITLY DO NOT BUILD
- No AI chatbot or assistant of any kind.
- No real backend, database, or ORM.
- No calls to any external API (no weather, no live prices, no maps, no SMS,
  no payment).
- No admin or staff panel.
- No account-deletion flow (not needed for a demo).

DELIVERABLE
A single Vite React project folder that runs with:
  npm install
  npm run dev
No .env file needed. No signup for any third-party service required to run
it. Everything — accounts, mandis, crops, bookings, queue — lives in the
browser's localStorage for the duration of the demo.
```

---

## Why this approach

The real MandiMitra app is genuinely working — multi-crop time-slot booking, live queue, printable QR passes — but its AI chatbot depends on a Gemini API key on the free tier, capped at 20 messages a day shared across everyone using it. If that quota happens to be used up right when you're presenting, the chatbot fails with an error in front of the teachers, which looks worse than not having a chatbot at all.

This demo clone sidesteps that entirely: no chatbot, no live API of any kind, so there's nothing that can break mid-presentation. It's honestly labeled as a demo build everywhere in the UI, and it keeps the three features that best show real progress — booking, multi-crop handling, and the queue/pass system — without carrying any of the risk.
