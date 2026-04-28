import type { EnrichedLead, HistoryEntry } from "./types";

const SESSION_ID_KEY = "elise_session_id";
const SESSION_HISTORY_KEY = "elise_session_history";

export function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(SESSION_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(
  sessionId: string,
  leads: EnrichedLead[],
  label: string
): HistoryEntry {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    sessionId,
    timestamp: Date.now(),
    label,
    leads,
  };
  const existing = loadHistory();
  // Keep most recent 50 entries
  const updated = [entry, ...existing].slice(0, 50);
  sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
  return entry;
}

export function clearHistory(): void {
  sessionStorage.removeItem(SESSION_HISTORY_KEY);
}

export function formatTimestamp(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ts).toLocaleDateString();
}
