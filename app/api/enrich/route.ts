import { NextRequest, NextResponse } from "next/server";
import { geocodeLead } from "@/lib/geocode";
import { fetchCensusData } from "@/lib/census";
import { fetchWalkScore } from "@/lib/walkscore";
import { callClaude } from "@/lib/claude";
import type { EnrichedLead, LeadInput, ScoreTier } from "@/lib/types";

function scoreTier(score: number): ScoreTier {
  if (score >= 80) return "Hot";
  if (score >= 55) return "Warm";
  return "Cold";
}

const US_STATE_ABBREVS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP",
]);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: LeadInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, email, company, address, city, state } = body;

  if (!name || !email || !company || !address || !city || !state) {
    return NextResponse.json(
      { error: "Missing required fields: name, email, company, address, city, state" },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
  }

  if (!US_STATE_ABBREVS.has(state.trim().toUpperCase())) {
    return NextResponse.json(
      { error: `Invalid state "${state}". Use a 2-letter US state abbreviation (e.g. CA).` },
      { status: 400 }
    );
  }

  const lead: LeadInput = { name, email, company, address, city, state }; // what we receive as the input
  const result: EnrichedLead = {
    ...lead, // copy the input fully
    geo: null,
    census: null,
    walkScoreData: null,
    claude: null,
    scoreTier: null,
    error: null,
  };

  try {
    // Step 1: Geocode to get lat/lng and FIPS codes
    const geo = await geocodeLead(address, city, state);
    result.geo = geo;

    // Step 2: Fetch Census + WalkScore in parallel
    const [census, walkScoreData] = await Promise.all([
      geo?.stateFips && geo?.placeFips
        ? fetchCensusData(geo.stateFips, geo.placeFips)
        : Promise.resolve(null),
      geo
        ? fetchWalkScore(address, city, state, geo.lat, geo.lng)
        : Promise.resolve(null),
    ]);

    result.census = census;
    result.walkScoreData = walkScoreData;

    // Step 3: Claude synthesis (score + email + insights)
    const claude = await callClaude(lead, census, walkScoreData);
    result.claude = claude;
    result.scoreTier = claude ? scoreTier(claude.score) : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment failed";
    result.error = message;
  }

  return NextResponse.json(result);
}
