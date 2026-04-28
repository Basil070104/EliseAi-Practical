import type { CensusData } from "./types";

// ACS 5-Year fields used:
//   B25003_001E — Total occupied housing units
//   B25003_002E — Owner-occupied housing units
//   B25003_003E — Renter-occupied housing units
//   B01003_001E — Total population
//   B19013_001E — Median household income (12-month)
const FIELDS = "B25003_001E,B25003_003E,B01003_001E,B19013_001E";
const ACS_BASE = "https://api.census.gov/data/2022/acs/acs5";

interface AcsRow {
  B25003_001E: string;
  B25003_003E: string;
  B01003_001E: string;
  B19013_001E: string;
}

export async function fetchCensusData(
  stateFips: string,
  placeFips: string
): Promise<CensusData | null> {
  if (!stateFips || !placeFips) return null;

  const params = new URLSearchParams({
    get: FIELDS,
    for: `place:${placeFips}`,
    in: `state:${stateFips}`,
  });

  const url = `${ACS_BASE}?${params.toString()}`; // base string + params for fetch

  console.log("Fetching url ", url);

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  // Response is a 2-row array: [headers, values]
  const rows: string[][] = await res.json();
  if (!rows || rows.length < 2) return null;

  const headers = rows[0];
  const values = rows[1];

  const row = Object.fromEntries(
    headers.map((h, i) => [h, values[i]])
  ) as unknown as AcsRow;

  const totalOccupied = parseInt(row.B25003_001E, 10);
  const renterOccupied = parseInt(row.B25003_003E, 10);
  const population = parseInt(row.B01003_001E, 10);
  const medianIncome = parseInt(row.B19013_001E, 10);

  if (isNaN(totalOccupied) || isNaN(renterOccupied)) return null;

  return {
    totalOccupied,
    renterOccupied,
    renterRate: totalOccupied > 0 ? renterOccupied / totalOccupied : 0,
    population: isNaN(population) ? 0 : population,
    medianIncome: isNaN(medianIncome) ? 0 : medianIncome,
  };
}
