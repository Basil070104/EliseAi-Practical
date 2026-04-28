"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, animate } from "framer-motion";
import Papa from "papaparse";
import type { EnrichedLead, HistoryEntry, LeadInput, ScoreTier } from "@/lib/types";
import {
  clearHistory,
  formatTimestamp,
  getOrCreateSessionId,
  loadHistory,
  saveHistoryEntry,
} from "@/lib/session";

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

const EXAMPLE_LEAD: LeadInput = {
  name: "Sarah Chen",
  email: "sarah@bayareaproperties.com",
  company: "Bay Area Properties",
  address: "580 Market St",
  city: "San Francisco",
  state: "CA",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBadge({ tier, score }: { tier: ScoreTier | null; score: number | null }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (score === null) return;
    const controls = animate(0, score, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(latest: number) {
        setDisplayed(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [score]);

  if (tier === null || score === null) return <span className="text-zinc-400 text-sm">—</span>;
  const styles = TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles.badge}`}>
      {tier} &middot; {displayed}/100
    </span>
  );
}

function SendEmailPanel({ defaultTo, emailBody }: { defaultTo: string; emailBody: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend() {
    if (!from || !to) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject: "Reaching out about your property",
          text: emailBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-100 dark:border-zinc-700 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
      >
        {open ? "Hide send form ▲" : "Send this email ▼"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-0.5">Your email (From)</label>
            <input
              type="email"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="you@yourcompany.com"
              className="w-full text-xs rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-0.5">Recipient (To)</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="lead@example.com"
              className="w-full text-xs rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!from || !to || status === "sending"}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
          >
            {status === "sending" ? "Sending…" : "Send Email"}
          </button>
          {status === "success" && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Email sent successfully!</p>
          )}
          {status === "error" && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
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

  // Compute per-signal score breakdown using the documented rubric
  const scoreSignals: { label: string; earned: number; max: number; detail: string }[] = [];
  if (lead.census) {
    const rr = lead.census.renterRate * 100;
    const rrPts = rr >= 50 ? 30 : rr >= 40 ? 20 : 10;
    scoreSignals.push({
      label: "Renter Rate",
      earned: rrPts,
      max: 30,
      detail: `${rr.toFixed(1)}% renters`,
    });
    const pop = lead.census.population;
    const popPts = pop >= 500_000 ? 20 : pop >= 100_000 ? 12 : 5;
    scoreSignals.push({
      label: "City Population",
      earned: popPts,
      max: 20,
      detail: pop.toLocaleString(),
    });
    const inc = lead.census.medianIncome;
    const incPts = inc >= 60_000 && inc <= 120_000 ? 15 : inc > 120_000 ? 10 : 5;
    scoreSignals.push({
      label: "Median Income",
      earned: incPts,
      max: 15,
      detail: `$${inc.toLocaleString()}`,
    });
  }
  if (lead.walkScoreData) {
    const ws = lead.walkScoreData.walkScore ?? 0;
    const wsPts = ws >= 70 ? 25 : ws >= 50 ? 15 : 5;
    scoreSignals.push({
      label: "Walk Score",
      earned: wsPts,
      max: 25,
      detail: `${ws} — ${lead.walkScoreData.walkDescription ?? ""}`,
    });
    const ts = lead.walkScoreData.transitScore ?? 0;
    const tsPts = ts >= 60 ? 10 : ts >= 40 ? 6 : 2;
    scoreSignals.push({
      label: "Transit Score",
      earned: tsPts,
      max: 10,
      detail: String(ts),
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* Left: data card */}
      <div>
        {/* Score breakdown */}
        {scoreSignals.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wide">
              Score Breakdown
            </h4>
            <div className="space-y-2">
              {scoreSignals.map((sig) => (
                <div key={sig.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-zinc-500">{sig.label}</span>
                    <span className="text-xs font-semibold tabular-nums">
                      <span className={sig.earned === sig.max ? "text-emerald-600 dark:text-emerald-400" : sig.earned >= sig.max * 0.6 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400"}>
                        {sig.earned}
                      </span>
                      <span className="text-zinc-400">/{sig.max}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        sig.earned === sig.max
                          ? "bg-emerald-500"
                          : sig.earned >= sig.max * 0.6
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      style={{ width: `${(sig.earned / sig.max) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{sig.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Rationale</h5>
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
              className="text-xs px-2.5 py-1 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        {lead.claude?.email ? (
          <>
            <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-3">
              {lead.claude.email}
            </pre>
            <SendEmailPanel defaultTo={lead.email} emailBody={lead.claude.email} />
          </>
        ) : (
          <p className="text-zinc-400 italic text-sm">No email generated.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scoring rules modal
// ---------------------------------------------------------------------------

function ScoringRulesModal({ onClose }: { onClose: () => void }) {
  const signals = [
    { signal: "City Renter Rate", max: 30, logic: "≥50% = 30 pts · 40–50% = 20 pts · <40% = 10 pts" },
    { signal: "Walk Score",       max: 25, logic: "≥70 = 25 pts · 50–69 = 15 pts · <50 = 5 pts" },
    { signal: "City Population",  max: 20, logic: "≥500k = 20 pts · 100k–499k = 12 pts · <100k = 5 pts" },
    { signal: "Median HH Income", max: 15, logic: "$60k–$120k = 15 pts (market-rate renter sweet spot)" },
    { signal: "Transit Score",    max: 10, logic: "≥60 = 10 pts · 40–59 = 6 pts · <40 = 2 pts" },
  ];
  const tiers = [
    { tier: "Hot",  range: "80–100", action: "Route to AE immediately · High-priority outreach", color: "text-red-600 dark:text-red-400" },
    { tier: "Warm", range: "55–79",  action: "Standard SDR sequence · Monitor",                  color: "text-yellow-600 dark:text-yellow-400" },
    { tier: "Cold", range: "<55",    action: "Nurture sequence · Deprioritize",                  color: "text-blue-600 dark:text-blue-400" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold">Scoring Rubric</h2>
            <p className="text-xs text-zinc-400 mt-0.5">ICP: Multifamily residential property managers, 50+ units, mid-to-large U.S. metro</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">✕</button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Signal Weights</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left pb-2 font-medium">Signal</th>
                  <th className="text-center pb-2 font-medium w-16">Max pts</th>
                  <th className="text-left pb-2 font-medium pl-3">Logic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {signals.map((s) => (
                  <tr key={s.signal}>
                    <td className="py-2 font-medium text-zinc-700 dark:text-zinc-300">{s.signal}</td>
                    <td className="py-2 text-center font-semibold text-indigo-600 dark:text-indigo-400">{s.max}</td>
                    <td className="py-2 pl-3 text-xs text-zinc-500">{s.logic}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-200 dark:border-zinc-700">
                  <td className="pt-2 font-semibold">Total</td>
                  <td className="pt-2 text-center font-bold text-indigo-600 dark:text-indigo-400">100</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Score Tiers &amp; Actions</h3>
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.tier} className="flex items-start gap-3">
                  <span className={`text-xs font-bold w-12 shrink-0 mt-0.5 ${t.color}`}>{t.tier}</span>
                  <span className="text-xs text-zinc-400 w-16 shrink-0">{t.range}</span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.action}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-3">
            Data sources: U.S. Census Bureau ACS 5-Year · WalkScore API · Claude (Anthropic) for synthesis
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy-email button (row-level, for the draft outreach email)
// ---------------------------------------------------------------------------

function CopyEmailButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      title="Copy draft outreach email"
      className="text-xs cursor-pointer px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-500 dark:text-zinc-300 transition-colors shrink-0"
    >
      {copied ? "Copied!" : "Copy email"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading components
// ---------------------------------------------------------------------------

function EnrichingSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="text-xs text-zinc-400 mt-1">Fetching Census + WalkScore data, then running AI analysis</p>
    </div>
  );
}

function LoadingRow({ lead, position }: { lead: LeadInput; position: number }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border  dark:border-zinc-800 shadow-sm overflow-hidden border-l-4 border-indigo-300 animate-pulse">
      <div className="px-4 py-3 flex items-center gap-4">
        <span className="text-xs font-bold text-zinc-400 w-5 shrink-0">#{position}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 bg-zinc-200 dark:bg-zinc-700 rounded w-36" />
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-52" />
        </div>
        <span className="text-xs text-indigo-400 font-medium">Enriching…</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [manualOpen, setManualOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [form, setForm] = useState<LeadInput>(EMPTY_FORM);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleParsing, setConsoleParsing] = useState(false);
  const [consoleError, setConsoleError] = useState("");
  const [consoleRows, setConsoleRows] = useState<(LeadInput & { id: string; source: "manual" | "csv" | "console"; enriched?: EnrichedLead })[]>([]);
  const [expandedConsoleId, setExpandedConsoleId] = useState<string | null>(null);
  const consoleRef = useRef<HTMLTextAreaElement>(null);
  const [csvLeads, setCsvLeads] = useState<LeadInput[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [results, setResults] = useState<EnrichedLead[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [pendingLead, setPendingLead] = useState<{ lead: LeadInput; position: number } | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isDark, setIsDark] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Session init ----

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    setHistory(loadHistory());

    // Initialise dark mode: stored preference > system preference
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored === "dark" || (!stored && prefersDark);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

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
    const label = enriched.name || form.name || "Manual entry";
    const entry = saveHistoryEntry(sessionId, [enriched], label);
    setHistory((prev) => [entry, ...prev]);
    // Mirror into console
    const rowId = `manual-${Date.now()}`;
    setConsoleRows((prev) => [...prev, { ...form, id: rowId, source: "manual", enriched }]);
  }

  async function handleEnrichAll() {
    setResults([]);
    setExpandedIndex(null);
    const allResults: EnrichedLead[] = [];
    // Enrich sequentially to respect WalkScore rate limits (500ms gap per spec)
    for (let i = 0; i < csvLeads.length; i++) {
      setPendingLead({ lead: csvLeads[i], position: i + 1 });
      const result = await enrichLead(csvLeads[i], i);
      allResults.push(result);
      // Stream each result in as it arrives, sorted by score descending
      setResults([...allResults].sort((a, b) => (b.claude?.score ?? -1) - (a.claude?.score ?? -1)));
      if (i < csvLeads.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
    setPendingLead(null);
    // Save to history
    const label =
      allResults.length === 1
        ? allResults[0].name || "1 lead"
        : `${allResults.length} leads via CSV`;
    const entry = saveHistoryEntry(sessionId, allResults, label);
    setHistory((prev) => [entry, ...prev]);
    // Mirror into console (once, outside any state updater)
    const newRows = allResults.map((enriched) => ({
      ...enriched,
      id: `csv-${Date.now()}-${Math.random()}`,
      source: "csv" as const,
      enriched,
    }));
    setConsoleRows((prev) => [...prev, ...newRows]);
  }

  // ---- Console (spreadsheet) helpers ----

  function consoleAddBlankRow() {
    setConsoleRows((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, name: "", email: "", company: "", address: "", city: "", state: "", source: "console" },
    ]);
  }

  function consoleUpdateRow(id: string, field: keyof LeadInput, value: string) {
    setConsoleRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function consoleDeleteRow(id: string) {
    setConsoleRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleConsoleParse() {
    if (!consoleInput.trim()) return;
    setConsoleParsing(true);
    setConsoleError("");
    try {
      const res = await fetch("/api/parse-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: consoleInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      const newRow = { ...(data as LeadInput), id: `${Date.now()}-${Math.random()}`, source: "console" as const };
      setConsoleRows((prev) => [...prev, newRow]);
      setConsoleInput("");
    } catch (err) {
      setConsoleError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setConsoleParsing(false);
    }
  }

  async function handleConsoleEnrichRow(rowId: string) {
    const row = consoleRows.find((r) => r.id === rowId);
    if (!row) return;
    const idx = consoleRows.findIndex((r) => r.id === rowId);
    const result = await enrichLead(row, idx);
    setConsoleRows((prev) => prev.map((r) => r.id === rowId ? { ...r, enriched: result } : r));
    setResults((prev) => {
      const next = [...prev.filter((r) => r.email !== row.email), result];
      return next.sort((a, b) => (b.claude?.score ?? -1) - (a.claude?.score ?? -1));
    });
    const entry = saveHistoryEntry(sessionId, [result], result.name || row.name || "1 lead");
    setHistory((prev) => [entry, ...prev]);
  }

  async function handleConsoleEnrichAll() {
    if (consoleRows.length === 0) return;
    setResults([]);
    setExpandedIndex(null);
    const enriched: EnrichedLead[] = [];
    for (let i = 0; i < consoleRows.length; i++) {
      const row = consoleRows[i];
      setPendingLead({ lead: row, position: i + 1 });
      const result = await enrichLead(row, i);
      enriched.push(result);
      setResults([...enriched].sort((a, b) => (b.claude?.score ?? -1) - (a.claude?.score ?? -1)));
      // Store enriched result back on the row
      setConsoleRows((prev) => prev.map((r) => r.id === row.id ? { ...r, enriched: result } : r));
      if (i < consoleRows.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
    setPendingLead(null);
    const label = enriched.length === 1 ? enriched[0].name || "1 lead" : `${enriched.length} leads via Console`;
    const entry = saveHistoryEntry(sessionId, enriched, label);
    setHistory((prev) => [entry, ...prev]);
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

  function handleDownloadConsoleCsv() {
    if (consoleRows.length === 0) return;
    const rows = consoleRows.map((r) => ({
      Name: r.name,
      Email: r.email,
      Company: r.company,
      Address: r.address,
      City: r.city,
      State: r.state,
      Source: r.source,
      Score: r.enriched?.claude?.score ?? "",
      Tier: r.enriched?.scoreTier ?? "",
      RenterRate: r.enriched?.census ? (r.enriched.census.renterRate * 100).toFixed(1) + "%" : "",
      Population: r.enriched?.census?.population ?? "",
      MedianIncome: r.enriched?.census?.medianIncome ?? "",
      WalkScore: r.enriched?.walkScoreData?.walkScore ?? "",
      TransitScore: r.enriched?.walkScoreData?.transitScore ?? "",
      BikeScore: r.enriched?.walkScoreData?.bikeScore ?? "",
      Email_Draft: r.enriched?.claude?.email ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "console_leads.csv";
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
      {rulesOpen && <ScoringRulesModal onClose={() => setRulesOpen(false)} />}
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              EliseAI
            </span>
            <h1 className="text-lg font-bold leading-tight">Lead Enrichment Tool</h1>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-zinc-400">Census Bureau · WalkScore · Claude AI</p>
              <p className="text-xs text-zinc-400">by Basil Khwaja</p>
            </div>
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              {isDark ? (
                // Sun icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 cursor-pointer text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                // Moon icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 cursor-pointer text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6 items-start">

          {/* Left sidebar — session history */}
          <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-4 self-start h-[calc(100vh-2rem)] bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Session History
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {sessionId ? `${sessionId.slice(0, 8)}…` : "—"}
              </p>
            </div>

            {history.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-400 italic">No searches yet this session.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto flex-1 min-h-0">
                  {history.map((entry) => {
                    const hot = entry.leads.filter((l) => l.scoreTier === "Hot").length;
                    const warm = entry.leads.filter((l) => l.scoreTier === "Warm").length;
                    const cold = entry.leads.filter((l) => l.scoreTier === "Cold").length;
                    const topScore = Math.max(...entry.leads.map((l) => l.claude?.score ?? 0));
                    return (
                      <button
                        key={entry.id}
                        onClick={() => {
                          setResults(entry.leads);
                          setExpandedIndex(null);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <p className="text-sm font-medium truncate">{entry.label}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{formatTimestamp(entry.timestamp)}</p>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {hot > 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{hot} Hot</span>
                          )}
                          {warm > 0 && (
                            <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full">{warm} Warm</span>
                          )}
                          {cold > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{cold} Cold</span>
                          )}
                          {entry.leads.length === 1 && topScore > 0 && (
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full">
                              {topScore}/100
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    Clear history
                  </button>
                </div>
              </>
            )}
          </aside>

          {/* Right main content */}
          <div className="flex-1 min-w-0 space-y-8">
        {/* Input Panel */}
        <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">✦ Console</span>
              <button
                onClick={() => setRulesOpen(true)}
                title="How scoring works"
                className="text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors text-xs leading-none"
              >
                ⓘ
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setManualOpen((o) => !o); setCsvOpen(false); }}
                className={`px-3 py-1 cursor-pointer rounded-md text-xs font-medium transition-colors ${
                  manualOpen
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                + Manual Entry
              </button>
              <button
                onClick={() => { setCsvOpen((o) => !o); setManualOpen(false); }}
                className={`px-3 py-1 cursor-pointer rounded-md text-xs font-medium transition-colors ${
                  csvOpen
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                + CSV Upload
              </button>
            </div>
          </div>

          {/* Manual entry sub-panel */}
          {manualOpen && (
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-3">Manual Entry</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {([
                  ["name",    "Contact Name",    "Jane Smith"],
                  ["email",   "Email",           "jane@acmerealty.com"],
                  ["company", "Company",         "Acme Realty"],
                  ["address", "Property Address", "123 Main St"],
                  ["city",    "City",            "San Francisco"],
                  ["state",   "State",           "CA"],
                ] as [keyof LeadInput, string, string][]).map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
                    <input
                      type={field === "email" ? "email" : "text"}
                      value={form[field]}
                      placeholder={placeholder}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={async () => { await handleManualEnrich(); setManualOpen(false); }}
                  disabled={!canManualEnrich}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {isLoading ? "Enriching…" : "Enrich & Add to Console"}
                </button>
                <button
                  onClick={() => { setForm(EXAMPLE_LEAD); }}
                  className="text-sm text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
                >
                  Try an example →
                </button>
              </div>
            </div>
          )}

          {/* CSV upload sub-panel */}
          {csvOpen && (
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">CSV Upload</p>
              <p className="text-xs text-zinc-500 mb-3">
                Headers:{" "}
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">name, email, company, address, city, state</code>
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Choose CSV
                </button>
                <span className="text-sm text-zinc-400">
                  {csvFileName ? `${csvFileName} — ${csvLeads.length} lead(s) parsed` : "No file chosen"}
                </span>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
              </div>
              {csvLeads.length > 0 && (
                <>
                  <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-100 dark:bg-zinc-800">
                        <tr>
                          {["Name", "Email", "Company", "City", "State"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-zinc-500">{h}</th>
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
                            <td colSpan={5} className="px-3 py-1.5 text-zinc-400 italic">+{csvLeads.length - 5} more</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={async () => { await handleEnrichAll(); setCsvOpen(false); }}
                    disabled={!canEnrichAll}
                    className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                  >
                    {isLoading
                      ? `Enriching… (${csvLeads.length - loadingIds.size + 1} / ${csvLeads.length})`
                      : `Enrich All & Add to Console (${csvLeads.length})`}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="p-5">
            <div className="space-y-4">
                {/* Score summary bar */}
                {consoleRows.length > 0 && (() => {
                  const enriched = consoleRows.filter((r) => r.enriched && !r.enriched.error);
                  const hot  = enriched.filter((r) => r.enriched!.scoreTier === "Hot").length;
                  const warm = enriched.filter((r) => r.enriched!.scoreTier === "Warm").length;
                  const cold = enriched.filter((r) => r.enriched!.scoreTier === "Cold").length;
                  const pending = consoleRows.length - enriched.length;
                  const avgScore = enriched.length
                    ? Math.round(enriched.reduce((s, r) => s + (r.enriched!.claude?.score ?? 0), 0) / enriched.length)
                    : null;
                  return (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex-wrap">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide shrink-0">Summary</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {hot > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                            🔥 {hot} Hot
                          </span>
                        )}
                        {warm > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                            ☀︎ {warm} Warm
                          </span>
                        )}
                        {cold > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                            ❄︎ {cold} Cold
                          </span>
                        )}
                        {pending > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:border-zinc-600">
                            ○ {pending} Pending
                          </span>
                        )}
                      </div>
                      {avgScore !== null && (
                        <span className="ml-auto text-xs text-zinc-400 shrink-0">
                          Avg score <span className="font-semibold text-zinc-600 dark:text-zinc-300">{avgScore}/100</span>
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* NLP input bar */}
                <div className="flex gap-2 items-start">
                  <div className="relative flex-1">
                    <textarea
                      ref={consoleRef}
                      value={consoleInput}
                      onChange={(e) => { setConsoleInput(e.target.value); setConsoleError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleConsoleParse(); }}
                      rows={2}
                      placeholder={`Describe a lead in plain English — "Jane Smith at Acme Realty, jane@acmerealty.com, 123 Main St, Austin TX" — ⌘↵ to add row`}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    {consoleError && <p className="mt-1 text-xs text-red-500">{consoleError}</p>}
                  </div>
                  <button
                    onClick={handleConsoleParse}
                    disabled={!consoleInput.trim() || consoleParsing}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors shrink-0"
                  >
                    {consoleParsing ? "Parsing…" : "+ Add Row"}
                  </button>
                </div>

                {/* Spreadsheet table */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-800">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700 w-6">#</th>
                        {(["Name", "Email", "Company", "Address", "City", "State"] as const).map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700">{h}</th>
                        ))}
                        <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700">Source</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700">Status</th>
                        <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {consoleRows.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-400 italic">
                            No rows yet — type above and click <strong>+ Add Row</strong>, enrich from Manual / CSV tabs, or click <strong>+ New Empty Row</strong>.
                          </td>
                        </tr>
                      )}
                      {consoleRows.map((row, idx) => {
                        const isExpanded = expandedConsoleId === row.id;
                        const sourceBadge: Record<string, string> = {
                          manual: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
                          csv:    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
                          console:"bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300",
                        };
                        return (
                          <React.Fragment key={row.id}>
                            <tr
                              className={`group border-b border-zinc-100 dark:border-zinc-800 ${
                                isExpanded ? "" : "last:border-0"
                              } ${
                                idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-950"
                              }`}
                            >
                              <td className="px-3 py-1.5 text-xs text-zinc-400 text-center">{idx + 1}</td>
                              {(["name", "email", "company", "address", "city", "state"] as (keyof LeadInput)[]).map((field) => (
                                <td key={field} className="px-1 py-1">
                                  <input
                                    type={field === "email" ? "email" : "text"}
                                    value={row[field]}
                                    onChange={(e) => consoleUpdateRow(row.id, field, e.target.value)}
                                    className="w-full rounded border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-indigo-400 dark:focus:border-indigo-500 bg-transparent focus:bg-white dark:focus:bg-zinc-800 px-2 py-1 text-sm focus:outline-none transition-colors"
                                  />
                                </td>
                              ))}
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${sourceBadge[row.source]}`}>
                                  {row.source}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                {row.enriched ? (
                                  <button
                                    onClick={() => setExpandedConsoleId(isExpanded ? null : row.id)}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                  >
                                    <ScoreBadge tier={row.enriched.scoreTier} score={row.enriched.claude?.score ?? null} />
                                    <span className="ml-1">{isExpanded ? "▲" : "▼"}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleConsoleEnrichRow(row.id)}
                                    disabled={isLoading}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40 transition-colors"
                                    title="Enrich this row"
                                  >
                                    <span>⚡</span> Enrich
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-1 text-center">
                                <button
                                  onClick={() => consoleDeleteRow(row.id)}
                                  title="Remove row"
                                  className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors text-base leading-none"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                            {isExpanded && row.enriched && (
                              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                <td colSpan={10} className="px-4 py-4 bg-zinc-50 dark:bg-zinc-900">
                                  {row.enriched.error ? (
                                    <p className="text-sm text-red-500">Error: {row.enriched.error}</p>
                                  ) : (
                                    <InsightsCard lead={row.enriched} />
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={consoleAddBlankRow}
                  className="text-sm text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
                >
                  + New Empty Row
                </button>
                <div className="flex items-center gap-3">
                  
                  {consoleRows.length > 0 && (
                    <button
                      onClick={() => setConsoleRows([])}
                      className="text-sm text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                  {consoleRows.length > 0 && (
                    <button
                      onClick={handleDownloadConsoleCsv}
                      className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Download
                    </button>
                  )}
                  <button
                    onClick={handleConsoleEnrichAll}
                    disabled={isLoading || consoleRows.length === 0}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                  >
                    {isLoading ? `Enriching…` : `Enrich All (${consoleRows.length})`}
                  </button>
                </div>
              </div>
            </div>
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

            {/* Full-page spinner: shown while waiting for the very first result */}
            {isLoading && results.length === 0 && !pendingLead && (
              <EnrichingSpinner label="Enriching lead…" />
            )}

            <div className="space-y-2">
              {results.map((lead, i) => {
                const tier = lead.scoreTier;
                const rowStyle = tier ? TIER_STYLES[tier].row : "border-l-4 border-zinc-300";
                const isExpanded = expandedIndex === i;
                const loading = loadingIds.has(i);

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden ${rowStyle}`}
                  >
                    {/* Row header */}
                    <div className="flex items-center">
                      <div
                        onClick={() => setExpandedIndex(isExpanded ? null : i)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setExpandedIndex(isExpanded ? null : i)}
                        className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
                      </div>
                      {!loading && lead.claude?.email && (
                        <div className="pr-3 shrink-0">
                          <CopyEmailButton text={lead.claude.email} />
                        </div>
                      )}
                    </div>
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
                  </motion.div>
                );
              })}

              {/* Skeleton row for the lead currently being enriched in CSV mode */}
              {pendingLead && (
                <LoadingRow lead={pendingLead.lead} position={results.length + 1} />
              )}
            </div>
          </section>
        )}
          </div>{/* end right column */}
        </div>{/* end flex row */}
      </main>
    </div>
  );
}

