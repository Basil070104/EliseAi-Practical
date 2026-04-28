import type { GeoData } from "./types";

interface CensusGeocodeMatch {
  coordinates: { x: number; y: number };
  geographies?: {
    "Incorporated Places"?: Array<{ GEOID: string; STATE: string; PLACE: string }>;
    "Census Designated Places"?: Array<{ GEOID: string; STATE: string; PLACE: string }>;
  };
}

interface CensusGeocodeResponse {
  result: {
    addressMatches: CensusGeocodeMatch[];
  };
}

export async function geocodeLead(
  address: string,
  city: string,
  state: string
): Promise<GeoData | null> {
  const params = new URLSearchParams({
    street: address,
    city,
    state,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "Incorporated Places,Census Designated Places",
    format: "json",
  });

  const url = `https://geocoding.geo.census.gov/geocoder/geographies/address?${params.toString()}`;

  console.log("Calling Geo Code API...");

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const data: CensusGeocodeResponse = await res.json();
  const matches = data?.result?.addressMatches;
  if (!matches || matches.length === 0) return null;

  const match = matches[0];
  const lat = match.coordinates.y;
  const lng = match.coordinates.x;

  const geos = match.geographies;
  const places = geos?.["Incorporated Places"] ?? geos?.["Census Designated Places"] ?? [];

  if (places.length === 0) {
    return { lat, lng, stateFips: "", placeFips: "" };
  }

  const place = places[0];
  // GEOID is stateFips (2) + placeFips (5)
  const stateFips = place.STATE ?? place.GEOID.slice(0, 2);
  const placeFips = place.PLACE ?? place.GEOID.slice(2);

  return { lat, lng, stateFips, placeFips };
}
