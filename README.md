# Aeonis

Messaging + calling app. Landing page + auth/redirect scaffold built first;
chat/groups/calling to follow in subsequent rounds.

## Structure
- `client/` — React + Vite frontend (landing page live, chat/login/signup are stubs)
- `server/` — Express + Socket.IO + MongoDB backend, adapted from the Whisper prototype
  (auth, 1:1 messaging, 1:1 call signaling, TURN credential endpoint already wired)

## Running locally

### Server
```bash
cd server
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, GOOGLE_CLIENT_ID, CLIENT_URL
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```
Visit http://localhost:5173

## What's live right now
- Landing page: hero, CursorGrid backdrop, BorderGlow-wrapped "Join Aeonis" /
  "Re-enter Aeonis" buttons, install-app button (PWA), auto-redirect to /chat
  if a session token already exists.
- Login/Signup/Chat pages are functional stubs — not yet styled or wired to
  the backend auth routes.

## What's not built yet (next rounds)
- Real login/signup forms wired to `/api/auth`
- Friend requests, groups, profile page
- Group calling (adapting Air's mesh WebRTC room logic)
- Full chat UI
