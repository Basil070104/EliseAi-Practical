import type { WalkScoreData } from "./types";

interface WalkScoreApiResponse {
  status: number;
  walkscore?: number;
  description?: string;
  transit?: {
    score?: number;
    description?: string;
  };
  bike?: {
    score?: number;
  };
}

export async function fetchWalkScore(
  address: string,
  city: string,
  state: string,
  lat: number,
  lng: number
): Promise<WalkScoreData | null> {
  const apiKey = process.env.WALKSCORE_API_KEY;
  if (!apiKey) return null;

  const fullAddress = `${address}, ${city}, ${state}`;

  const params = new URLSearchParams({
    wsapikey: apiKey,
    address: fullAddress,
    lat: lat.toString(),
    lon: lng.toString(),
    transit: "1",
    bike: "1",
    format: "json",
  });

  console.log("Fetching Walk Score...");

  const url = `https://api.walkscore.com/score?${params.toString()}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const data: WalkScoreApiResponse = await res.json();

  // Status 1 = success, 2 = score not available, 40 = no API key
  if (data.status !== 1) return null;

  return {
    walkScore: data.walkscore ?? 0,
    walkDescription: data.description ?? "",
    transitScore: data.transit?.score ?? null,
    transitDescription: data.transit?.description ?? null,
    bikeScore: data.bike?.score ?? null,
  };
}
