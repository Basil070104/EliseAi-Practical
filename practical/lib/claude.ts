import Anthropic from "@anthropic-ai/sdk";
import type { CensusData, ClaudeOutput, LeadInput, WalkScoreData } from "./types";

const SCORING_RUBRIC = {
  cityRenterRate: {
    maxPoints: 30,
    logic: ">=50% renters = 30pts; 40-50% = 20pts; <40% = 10pts",
  },
  walkScore: {
    maxPoints: 25,
    logic: ">=70 = 25pts; 50-69 = 15pts; <50 = 5pts",
  },
  cityPopulation: {
    maxPoints: 20,
    logic: ">=500k = 20pts; 100k-499k = 12pts; <100k = 5pts",
  },
  medianIncome: {
    maxPoints: 15,
    logic: "$60k-$120k sweet spot = 15pts (market-rate renter profile); outside range = 5pts",
  },
  transitScore: {
    maxPoints: 10,
    logic: ">=60 = 10pts; 40-59 = 6pts; <40 = 2pts",
  },
};

export async function callClaude(
  lead: LeadInput,
  census: CensusData | null,
  walkScoreData: WalkScoreData | null
): Promise<ClaudeOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  console.log("Calling Claude...");

  const renterRateFormatted = census
    ? `${(census.renterRate * 100).toFixed(1)}%`
    : "N/A";
  const populationFormatted = census
    ? census.population.toLocaleString()
    : "N/A";
  const incomeFormatted = census
    ? `$${census.medianIncome.toLocaleString()}`
    : "N/A";
  const walkScoreFormatted = walkScoreData
    ? `${walkScoreData.walkScore} (${walkScoreData.walkDescription})`
    : "N/A";
  const transitScoreFormatted = walkScoreData?.transitScore != null
    ? `${walkScoreData.transitScore}${walkScoreData.transitDescription ? ` (${walkScoreData.transitDescription})` : ""}`
    : "N/A";
  const bikeScoreFormatted = walkScoreData?.bikeScore != null
    ? String(walkScoreData.bikeScore)
    : "N/A";

  const systemPrompt = `You are a sales intelligence assistant for EliseAI, an AI leasing platform for residential property managers. Your job is to analyze lead enrichment data and produce structured JSON outputs for the sales team.`;

  const userPrompt = `Given the following enrichment data for a lead, produce a JSON object with exactly four keys:

- "score": integer 0-100 computed using the scoring rubric below
- "rationale": array of exactly 3 strings, each one sentence explaining a key scoring factor
- "email": string containing a 3-paragraph personalized outreach email from an SDR. The email should: open with a specific reference to the neighborhood or city, name the company and tailor the value prop to leasing volume using renter rate as context, keep a conversational tone (not templated), be under 150 words, and end with a soft CTA for a 15-minute call.
- "insights": array of 4-5 strings, each a bullet-point data highlight a sales rep would want to know

Lead data:
- Name: ${lead.name}
- Company: ${lead.company}
- Email: ${lead.email}
- City: ${lead.city}, State: ${lead.state}
- Renter Rate: ${renterRateFormatted}
- City Population: ${populationFormatted}
- Median Household Income: ${incomeFormatted}
- Walk Score: ${walkScoreFormatted}
- Transit Score: ${transitScoreFormatted}
- Bike Score: ${bikeScoreFormatted}

Scoring rubric:
${JSON.stringify(SCORING_RUBRIC, null, 2)}

Important scoring note: If Census data is N/A, score renter rate and population/income at 0. If WalkScore data is N/A, score walk score and transit at 0.

Respond ONLY with valid JSON. No markdown, no code fences, no preamble.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const parsed: ClaudeOutput = JSON.parse(textBlock.text);

  // Validate shape
  if (
    typeof parsed.score !== "number" ||
    !Array.isArray(parsed.rationale) ||
    typeof parsed.email !== "string" ||
    !Array.isArray(parsed.insights)
  ) {
    return null;
  }

  return parsed;
}
