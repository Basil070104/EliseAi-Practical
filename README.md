# EliseAI — Inbound Lead Enrichment Tool

A Next.js application that enriches real estate inbound leads with demographic, walkability, and AI-generated sales intelligence. Each lead is scored, tiered, and paired with a personalised draft outreach email — all from a single form or CSV upload.

Built by **Basil Khwaja** as a practical exercise for EliseAI.

---

## How it works

Submit a lead (name, email, company, property address, city, state) and the pipeline runs automatically:

1. **Geocode** — resolves the address to lat/lng and FIPS codes via the Census Geocoder API
2. **Census data** — fetches renter rate, population, and median household income for the lead's city
3. **WalkScore** — retrieves Walk Score, Transit Score, and Bike Score for the property
4. **Claude AI** — synthesises all of the above into:
   - A composite score from 0–100
   - A tier: **Hot** (≥ 80) · **Warm** (≥ 55) · **Cold** (< 55)
   - Bullet-point rationale and data highlights
   - A personalised draft outreach email

Results are sorted by score descending and can be exported as CSV.

---

## Features

- **Manual entry** — enrich a single lead through a validated form
- **CSV bulk upload** — enrich multiple leads at once; invalid or duplicate rows are reported before processing
- **Persistent history** — sign in with Google to save and reload enrichment history across sessions via Firestore; anonymous users get `sessionStorage`-backed history
- **Console view** — all historical leads hydrated in a live console; re-enrich any row on demand
- **CSV export** — download results with scores, census data, tier, and draft emails
- **Dark mode** — toggled manually, persisted in `localStorage`
- **Input validation** — email format and US state abbreviation enforced client-side (form + CSV) and server-side (API route)

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Auth & storage | Firebase Authentication (Google), Firestore |
| CSV parsing | PapaParse |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Data APIs | US Census Bureau, WalkScore |

---

## Getting started

### Prerequisites

- Node.js ≥ 18
- A **Firebase** project with Authentication (Google provider) and Firestore enabled
- API keys for **Anthropic Claude** and **WalkScore**

### Install

```bash
npm install
```

### Environment variables

Create `.env.local`:

```env
# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

# WalkScore
WALKSCORE_API_KEY=your_walkscore_key

# Firebase (all values from your Firebase project settings)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Firestore security rules

Deploy the included rules so users can only access their own history:

```bash
npx firebase-tools deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` into the Firebase Console under **Firestore → Rules**.

---

## CSV format

Upload a `.csv` file with these headers (case-insensitive, any column order):

```csv
name,email,company,address,city,state
Sarah Chen,sarah@bayareaproperties.com,Bay Area Properties,580 Market St,San Francisco,CA
John Smith,john@nycrealty.com,NYC Realty Group,350 5th Ave,New York,NY
```

Rows with invalid emails, unrecognised state abbreviations, missing required fields, or duplicate email addresses are filtered out before enrichment. A warning banner reports exactly what was skipped.

---

## Project structure

```
├── app/
│   ├── layout.tsx            # Root layout — wraps app in AuthProvider
│   ├── page.tsx              # Main UI (console, form, history sidebar)
│   ├── signin/
│   │   └── page.tsx          # Google sign-in page
│   └── api/
│       └── enrich/
│           └── route.ts      # Enrichment pipeline API route
├── lib/
│   ├── types.ts              # Shared TypeScript types
│   ├── firebase.ts           # Lazy Firebase initialisation (SSR-safe)
│   ├── auth.tsx              # AuthProvider + useAuth hook
│   ├── firestore.ts          # Firestore history helpers
│   ├── session.ts            # sessionStorage fallback helpers
│   ├── geocode.ts            # Census Geocoder
│   ├── census.ts             # Census Bureau API
│   ├── walkscore.ts          # WalkScore API
│   └── claude.ts             # Anthropic Claude integration
├── firestore.rules           # Firestore security rules
└── firebase.json             # Firebase project config
```

