"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import type { EnrichedLead, LeadInput, ScoreTier } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<ScoreTier, { badge: string; row: string }> = {
  Hot: {
    badge: "bg-red-100 text-red-700 border border-red-300",
    row: "border-l-4 border-red-400",
  },
  Warm: {
    badge: "bg-yellow-100 text-yellow-700 border border-yellow-300",
    row: "border-l-4 border-yellow-400",
  },
  Cold: {
    badge: "bg-blue-100 text-blue-700 border border-blue-300",
    row: "border-l-4 border-blue-300",
  },
};

const EMPTY_FORM: LeadInput = {
  name: "",
  email: "",
  company: "",
  address: "",
  city: "",
  state: "",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBadge({ tier, score }: { tier: ScoreTier | null; score: number | null }) {
  if (tier === null || score === null) return <span className="text-zinc-400 text-sm">—</span>;
  const styles = TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles.badge}`}>
      {tier} &middot; {score}/100
    </span>
  );
}

function InsightsCard({ lead }: { lead: EnrichedLead }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!lead.claude?.email) return;
    navigator.clipboard.writeText(lead.claude.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* Left: data card */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wide">
          Sales Insights
        </h4>
        <dl className="space-y-1.5 text-sm">
          {lead.census && (
            <>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Renter Rate</dt>
                <dd className="font-medium">{(lead.census.renterRate * 100).toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">City Population</dt>
                <dd className="font-medium">{lead.census.population.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Median HH Income</dt>
                <dd className="font-medium">${lead.census.medianIncome.toLocaleString()}</dd>
              </div>
            </>
          )}
          {lead.walkScoreData && (
            <>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Walk Score</dt>
                <dd className="font-medium">{lead.walkScoreData.walkScore} — {lead.walkScoreData.walkDescription}</dd>
              </div>
              {lead.walkScoreData.transitScore != null && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Transit Score</dt>
                  <dd className="font-medium">
                    {lead.walkScoreData.transitScore}
                    {lead.walkScoreData.transitDescription && ` — ${lead.walkScoreData.transitDescription}`}
                  </dd>
                </div>
              )}
              {lead.walkScoreData.bikeScore != null && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Bike Score</dt>
                  <dd className="font-medium">{lead.walkScoreData.bikeScore}</dd>
                </div>
              )}
            </>
          )}
          {!lead.census && !lead.walkScoreData && (
            <p className="text-zinc-400 italic">No enrichment data available.</p>
          )}
        </dl>

        {lead.claude?.rationale && lead.claude.rationale.length > 0 && (
          <div className="mt-4">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">AI Rationale</h5>
            <ul className="space-y-1">
              {lead.claude.rationale.map((r, i) => (
                <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lead.claude?.insights && lead.claude.insights.length > 0 && (
          <div className="mt-4">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Data Highlights</h5>
            <ul className="space-y-1">
              {lead.claude.insights.map((ins, i) => (
                <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex gap-2">
                  <span className="mt-0.5 shrink-0">→</span>
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right: outreach email */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
            Draft Outreach Email
          </h4>
          {lead.claude?.email && (
            <button
              onClick={handleCopy}
              className="text-xs px-2.5 py-1 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        {lead.claude?.email ? (
          <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-3">
            {lead.claude.email}
          </pre>
        ) : (
          <p className="text-zinc-400 italic text-sm">No email generated.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [form, setForm] = useState<LeadInput>(EMPTY_FORM);
  const [csvLeads, setCsvLeads] = useState<LeadInput[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [results, setResults] = useState<EnrichedLead[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Enrichment logic ----

  async function enrichLead(lead: LeadInput, index: number): Promise<EnrichedLead> {
    setLoadingIds((prev) => new Set(prev).add(index));
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      const data: EnrichedLead = await res.json();
      return data;
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  }

  async function handleManualEnrich() {
    const idx = 0;
    setResults([]);
    setExpandedIndex(null);
    const enriched = await enrichLead(form, idx);
    setResults([enriched]);
    setExpandedIndex(0);
  }

  async function handleEnrichAll() {
    setResults([]);
    setExpandedIndex(null);
    // Enrich sequentially to respect WalkScore rate limits (500ms gap per spec)
    const enriched: EnrichedLead[] = [];
    for (let i = 0; i < csvLeads.length; i++) {
      const result = await enrichLead(csvLeads[i], i);
      enriched.push(result);
      // Slight delay between calls for rate limit safety
      if (i < csvLeads.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
    // Sort by score descending
    enriched.sort((a, b) => (b.claude?.score ?? -1) - (a.claude?.score ?? -1));
    setResults(enriched);
  }

  // ---- CSV parsing ----

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const leads: LeadInput[] = result.data.map((row) => ({
          name: row["name"] ?? "",
          email: row["email"] ?? "",
          company: row["company"] ?? "",
          address: row["address"] ?? "",
          city: row["city"] ?? "",
          state: row["state"] ?? "",
        }));
        setCsvLeads(leads.filter((l) => l.name && l.email && l.city && l.state));
      },
    });
  }

  // ---- CSV export ----

  function handleDownloadCsv() {
    if (results.length === 0) return;
    const rows = results.map((r) => ({
      Name: r.name,
      Email: r.email,
      Company: r.company,
      Address: r.address,
      City: r.city,
      State: r.state,
      Score: r.claude?.score ?? "",
      Tier: r.scoreTier ?? "",
      RenterRate: r.census ? (r.census.renterRate * 100).toFixed(1) + "%" : "",
      Population: r.census?.population ?? "",
      MedianIncome: r.census?.medianIncome ?? "",
      WalkScore: r.walkScoreData?.walkScore ?? "",
      TransitScore: r.walkScoreData?.transitScore ?? "",
      BikeScore: r.walkScoreData?.bikeScore ?? "",
      Email_Draft: r.claude?.email ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enriched_leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = loadingIds.size > 0;
  const canManualEnrich =
    !isLoading &&
    form.name &&
    form.email &&
    form.company &&
    form.address &&
    form.city &&
    form.state;
  const canEnrichAll = !isLoading && csvLeads.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              EliseAI
            </span>
            <h1 className="text-lg font-bold leading-tight">Inbound Lead Enrichment Tool</h1>
          </div>
          <p className="text-xs text-zinc-400 hidden sm:block">
            Census Bureau · WalkScore · Claude AI
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Input Panel */}
        <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            {(["manual", "csv"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {t === "manual" ? "Manual Entry" : "CSV Upload"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === "manual" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      ["name", "Contact Name", "Jane Smith"],
                      ["email", "Email", "jane@acmerealty.com"],
                      ["company", "Company", "Acme Realty"],
                      ["address", "Property Address", "123 Main St"],
                      ["city", "City", "San Francisco"],
                      ["state", "State", "CA"],
                    ] as [keyof LeadInput, string, string][]
                  ).map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
                      <input
                        type={field === "email" ? "email" : "text"}
                        value={form[field]}
                        placeholder={placeholder}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleManualEnrich}
                  disabled={!canManualEnrich}
                  className="mt-5 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {isLoading ? "Enriching…" : "Enrich Lead"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-500 mb-3">
                  Upload a CSV with headers:{" "}
                  <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                    name, email, company, address, city, state
                  </code>
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Choose CSV
                  </button>
                  <span className="text-sm text-zinc-400">
                    {csvFileName
                      ? `${csvFileName} — ${csvLeads.length} lead(s) parsed`
                      : "No file chosen"}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFile}
                    className="hidden"
                  />
                </div>
                {csvLeads.length > 0 && (
                  <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-100 dark:bg-zinc-800">
                        <tr>
                          {["Name", "Email", "Company", "City", "State"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-zinc-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvLeads.slice(0, 5).map((l, i) => (
                          <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                            <td className="px-3 py-1.5">{l.name}</td>
                            <td className="px-3 py-1.5 text-zinc-400">{l.email}</td>
                            <td className="px-3 py-1.5">{l.company}</td>
                            <td className="px-3 py-1.5">{l.city}</td>
                            <td className="px-3 py-1.5">{l.state}</td>
                          </tr>
                        ))}
                        {csvLeads.length > 5 && (
                          <tr className="border-t border-zinc-100 dark:border-zinc-800">
                            <td colSpan={5} className="px-3 py-1.5 text-zinc-400 italic">
                              +{csvLeads.length - 5} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  onClick={handleEnrichAll}
                  disabled={!canEnrichAll}
                  className="mt-5 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {isLoading
                    ? `Enriching… (${csvLeads.length - loadingIds.size + 1} / ${csvLeads.length})`
                    : `Enrich All (${csvLeads.length})`}
                </button>
              </>
            )}
          </div>
        </section>

        {/* Results */}
        {(results.length > 0 || isLoading) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">
                Results{results.length > 0 ? ` — ${results.length} lead(s)` : ""}
              </h2>
              {results.length > 0 && (
                <button
                  onClick={handleDownloadCsv}
                  className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Download CSV
                </button>
              )}
            </div>

            <div className="space-y-2">
              {results.map((lead, i) => {
                const tier = lead.scoreTier;
                const rowStyle = tier ? TIER_STYLES[tier].row : "border-l-4 border-zinc-300";
                const isExpanded = expandedIndex === i;
                const loading = loadingIds.has(i);

                return (
                  <div
                    key={i}
                    className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden ${rowStyle}`}
                  >
                    {/* Row header */}
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                      className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="text-xs font-bold text-zinc-400 w-5 shrink-0">
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{lead.name}</p>
                        <p className="text-xs text-zinc-400 truncate">{lead.company} · {lead.city}, {lead.state}</p>
                      </div>
                      <div className="shrink-0">
                        {loading ? (
                          <span className="text-xs text-zinc-400 animate-pulse">Enriching…</span>
                        ) : (
                          <ScoreBadge tier={lead.scoreTier} score={lead.claude?.score ?? null} />
                        )}
                      </div>
                      <span className="text-zinc-300 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && !loading && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-4 pt-3">
                        {lead.error ? (
                          <p className="text-sm text-red-500">Error: {lead.error}</p>
                        ) : (
                          <InsightsCard lead={lead} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

