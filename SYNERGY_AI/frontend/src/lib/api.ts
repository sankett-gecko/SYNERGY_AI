/**
 * Synergy AI Frontend API Client
 * Connects to the Python multi-agent backend server.
 */

export interface StepLog {
  agent: string;
  role: string;
  action: string;
  status: string;
  details: string;
}

export interface PlagiarismReport {
  originality_score: string;
  plagiarism_detected: number;
  flagged_matches: string[];
  status: string;
  certification: string;
}

export interface HumanizerReport {
  humanized_text: string;
  burstiness_index: number;
  cliches_removed: number;
  ai_probability_score: string;
  readability_grade: string;
}

export interface GrammarReport {
  original_length: number;
  refined_text: string;
  grammar_score: number;
  issues_fixed: number;
  status: string;
}

export interface GenerateResponse {
  id?: number;
  topic: string;
  final_text: string;
  formatted_html: string;
  word_count: number;
  read_time: string;
  plagiarism_report: PlagiarismReport;
  humanizer_report: HumanizerReport;
  grammar_report: GrammarReport;
  fact_check_report?: {
    fact_check_status?: string;
    fact_accuracy_score?: string;
    verified_facts_reflected?: string;
    entity_category?: string;
    sources_cross_referenced?: number;
  };
  steps: StepLog[];
  execution_time_seconds: number;
  status: string;
  credits_remaining?: number;
}

export interface CreditInfo {
  user_id: string;
  daily_limit: number;
  used_credits: number;
  remaining_credits: number;
  last_reset_date: string;
  reset_interval: string;
  success?: boolean;
}

export interface HistoryItem {
  id: number;
  user_id: string;
  prompt: string;
  format_type: string;
  final_text: string;
  formatted_html?: string;
  word_count: number;
  read_time: string;
  plagiarism_originality: string;
  ai_score: string;
  execution_time_seconds: number;
  steps_json?: string;
  steps?: StepLog[];
  created_at: string;
  status: string;
}

export interface HumanizeResult {
  original_text: string;
  humanized_text: string;
  mode: string;
  intensity: string;
  credits_used: number;
  original_word_count: number;
  humanized_word_count: number;
  burstiness_index: number;
  ai_probability_score: string;
  cliches_removed: number;
  readability_grade: string;
  provider_used?: string;
  draft_id?: number;
  credits_remaining?: number;
  status: string;
}

export interface AnalyzeResult {
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  burstiness_index: number;
  cliches_detected: number;
  ai_probability_score: string;
  readability_grade: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

/**
 * Wraps fetch with an AbortController-based timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 120_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "The request timed out. The backend is taking too long to respond — please try a shorter prompt or retry."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper to build auth headers
 */
function getHeaders(userId?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  return headers;
}

// ─── Credit Tracking APIs ────────────────────────────────────────────────────

export async function getUserCredits(userId: string = "guest-user"): Promise<CreditInfo> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/credits?user_id=${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: getHeaders(userId),
      },
      15_000
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch credits: ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.warn("Credits fetch fallback:", err);
    return {
      user_id: userId,
      daily_limit: 50,
      used_credits: 0,
      remaining_credits: 50,
      last_reset_date: new Date().toISOString().split("T")[0],
      reset_interval: "Daily (Midnight UTC)",
    };
  }
}

export async function consumeCredits(
  amount: number = 1,
  userId: string = "guest-user",
  action: string = "action"
): Promise<CreditInfo> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/credits/consume`,
    {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({ amount, action, user_id: userId }),
    },
    15_000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Failed to consume credits (${res.status})`);
  }
  return await res.json();
}

// ─── History APIs ────────────────────────────────────────────────────────────

export async function getGenerationHistory(
  userId: string = "guest-user",
  search: string = "",
  limit: number = 50
): Promise<{ history: HistoryItem[]; count: number }> {
  try {
    const query = new URLSearchParams({
      user_id: userId,
      limit: limit.toString(),
      ...(search ? { search } : {}),
    });
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/api/history?${query.toString()}`,
      {
        method: "GET",
        headers: getHeaders(userId),
      },
      20_000
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error("Fetch history error:", err);
    return { history: [], count: 0 };
  }
}

export async function getHistoryItem(
  historyId: number,
  userId: string = "guest-user"
): Promise<HistoryItem> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/history/${historyId}?user_id=${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: getHeaders(userId),
    },
    15_000
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch history item #${historyId}`);
  }
  return await res.json();
}

export async function deleteHistoryItem(
  historyId: number,
  userId: string = "guest-user"
): Promise<boolean> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/history/${historyId}?user_id=${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: getHeaders(userId),
    },
    15_000
  );
  return res.ok;
}

// ─── Workspace Humanizer APIs ────────────────────────────────────────────────

export async function humanizeText(
  text: string,
  mode: string = "Medium",
  userId: string = "guest-user",
  customGroqKey?: string
): Promise<HumanizeResult> {
  const headers: Record<string, string> = {
    ...getHeaders(userId) as Record<string, string>,
  };
  if (customGroqKey && customGroqKey.trim()) {
    headers["X-Groq-Api-Key"] = customGroqKey.trim();
  }

  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/humanize`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ text, mode, user_id: userId }),
    },
    60_000
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Humanizer failed with status ${res.status}`);
  }
  return await res.json();
}

export async function analyzeText(text: string): Promise<AnalyzeResult> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/analyze-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    15_000
  );
  if (!res.ok) {
    throw new Error(`Analyze text failed with status ${res.status}`);
  }
  return await res.json();
}

// ─── Multi-Agent Generation API ──────────────────────────────────────────────

export async function generateContent(
  prompt: string,
  format: string = "Detailed Report",
  userId: string = "guest-user"
): Promise<GenerateResponse> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/generate`,
    {
      method: "POST",
      headers: getHeaders(userId),
      body: JSON.stringify({ prompt, format, user_id: userId }),
    },
    120_000
  );

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.detail) detail = errorData.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return await res.json();
}
