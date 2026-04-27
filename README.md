# EliseAI — Inbound Lead Enrichment Tool

A Next.js application that enriches real estate inbound leads with demographic, walkability, and AI-generated sales intelligence, then produces a scored outreach email for each contact.

Built by **Basil Khwaja** as a practical exercise for EliseAI.

---

## What it does

For each lead (name, email, company, address, city, state) the pipeline:

1. **Geocodes** the address via the Census Geocoder API to obtain lat/lng and FIPS codes.
2. **Fetches Census data** (renter rate, population, median household income) for the lead's city using the Census Bureau API.
3. **Fetches WalkScore data** (Walk Score, Transit Score, Bike Score) for the property address.
4. **Calls Claude AI** (Anthropic) to synthesize all the above into:
   - A score from 0–100
   - A tier: **Hot** (≥ 80) · **Warm** (≥ 55) · **Cold** (< 55)
   - Bullet-point rationale and data highlights
   - A personalised draft outreach email

Results are sorted by score descending and can be exported as a CSV.

---

## Features

- **Manual entry** — enrich a single lead via a form
- **CSV upload** — bulk-enrich multiple leads (processed sequentially to respect WalkScore rate limits)
- **Session history** — past searches persist in `localStorage` and are accessible in the sidebar
- **CSV export** — download all enriched results with scores, census data, and draft emails
- **Dark mode** — persisted via `localStorage`, respects system preference on first load

---

## Tech stack

| Layer | Library |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| CSV parsing | PapaParse |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Data | US Census Bureau API, WalkScore API |

---

## Getting started

### Prerequisites

- Node.js ≥ 18
- API keys for **Anthropic Claude** and **WalkScore**

### Install & run

```bash
cd practical
npm install
```

Create a `.env.local` file in the `practical/` directory:

```env
ANTHROPIC_API_KEY=your_anthropic_key
WALKSCORE_API_KEY=your_walkscore_key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## CSV format

Upload a `.csv` file with the following headers (case-insensitive):

```csv
name,email,company,address,city,state
Sarah Chen,sarah@bayareaproperties.com,Bay Area Properties,580 Market St,San Francisco,CA
John Smith,john@nycrealty.com,NYC Realty Group,350 5th Ave,New York,NY
```

Rows missing `name`, `email`, `city`, or `state` are skipped automatically.

---

## Project structure

```
practical/
├── app/
│   ├── page.tsx          # Main UI
│   └── api/enrich/
│       └── route.ts      # Enrichment API route
└── lib/
    ├── types.ts          # Shared TypeScript types
    ├── geocode.ts        # Census Geocoder
    ├── census.ts         # Census Bureau API
    ├── walkscore.ts      # WalkScore API
    ├── claude.ts         # Anthropic Claude integration
    └── session.ts        # localStorage session helpers
```

