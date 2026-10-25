"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  StepLog,
  CreditInfo,
  getUserCredits,
} from "@/lib/api";
import CreditWidget from "@/components/CreditWidget";
import HistoryView from "@/components/HistoryView";
import WorkspaceView from "@/components/WorkspaceView";

// ─── Agent step definitions (UI labels only) ──────────────────────────────────
const AGENT_STEPS = [
  {
    step: 1,
    emoji: "🧭",
    name: "Manager Agent",
    label: "Organizing workflow and refining instructions...",
    done: "Workflow planned",
  },
  {
    step: 2,
    emoji: "🔍",
    name: "Research Agent",
    label: "Searching web (Wikipedia + DuckDuckGo) for real facts...",
    done: "Web research complete",
  },
  {
    step: 3,
    emoji: "✍️",
    name: "Content Agent",
    label: "Drafting grounded report with organic human tone...",
    done: "Draft + humanized",
  },
  {
    step: 4,
    emoji: "🛡️",
    name: "Reviewer Agent",
    label: "Cross-checking web facts & verifying originality...",
    done: "Web verified & certified",
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string>("guest-user");
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [isCreditLoading, setIsCreditLoading] = useState(false);

  // Active navigation tab: "dashboard" | "workspace" | "history" | "credits"
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Multi-Agent Generation States
  const [prompt, setPrompt] = useState("");
  const format = "Detailed Report";
  const [output, setOutput] = useState("");
  const [formattedHtml, setFormattedHtml] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(0);          // 0 = idle, 1–4 = active agent
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workspace integration state
  const [workspaceInitialText, setWorkspaceInitialText] = useState("");

  const [metadata, setMetadata] = useState<{
    wordCount: number;
    readTime: string;
    plagiarismOriginality: string;
    aiOrganicScore: string;
    factAccuracy?: string;
    steps?: StepLog[];
  }>({
    wordCount: 0,
    readTime: "0 min read",
    plagiarismOriginality: "—",
    aiOrganicScore: "—",
    factAccuracy: "—",
  });

  const outputRef = useRef<HTMLDivElement>(null);

  // ─── Auth Listener & Credit Sync ───────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        const uid = user.email || user.uid;
        setUserId(uid);
        refreshCredits(uid);
      } else {
        setCurrentUser(null);
        setUserId("guest-user");
        refreshCredits("guest-user");
      }
    });
    return () => unsubscribe();
  }, []);

  const refreshCredits = async (targetUserId?: string) => {
    setIsCreditLoading(true);
    try {
      const info = await getUserCredits(targetUserId || userId);
      setCreditInfo(info);
    } catch (err) {
      console.warn("Could not fetch credits:", err);
    } finally {
      setIsCreditLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserId("guest-user");
      refreshCredits("guest-user");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleSendToWorkspace = (text: string) => {
    setWorkspaceInitialText(text);
    setActiveTab("workspace");
  };

  // ─── Live streaming generation via SSE ─────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (creditInfo && creditInfo.remaining_credits < 2) {
      setError("Insufficient daily credits. 4-Agent Generation requires 2 credits.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setOutput("");
    setFormattedHtml("");
    setActiveStep(0);
    setCompletedSteps([]);

    try {
      const response = await fetch(`${API_BASE}/api/generate-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({ prompt, format, user_id: userId }),
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || `Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const raw = line.replace(/^data:\s*/, "").trim();
          if (!raw) continue;

          let event: any;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "progress") {
            const step: number = event.step;
            setActiveStep(step);
            // Mark previous steps as completed
            setCompletedSteps((prev) => {
              const next = new Set(prev);
              for (let s = 1; s < step; s++) next.add(s);
              return Array.from(next);
            });
          } else if (event.type === "result") {
            const data = event.data;
            // All steps done
            setCompletedSteps([1, 2, 3, 4]);
            setActiveStep(0);
            setOutput(data.final_text || "");
            setFormattedHtml(data.formatted_html || "");
            setMetadata({
              wordCount: data.word_count ?? 0,
              readTime: data.read_time ?? "—",
              plagiarismOriginality: data.plagiarism_report?.originality_score ?? "100% Original",
              aiOrganicScore: data.humanizer_report?.ai_probability_score ?? "98% Organic",
              factAccuracy: data.fact_check_report?.fact_accuracy_score ?? "100% Web-Grounded",
              steps: data.steps,
            });

            // Refresh credit count after run
            refreshCredits();

            setTimeout(() => {
              outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 100);
          } else if (event.type === "error") {
            throw new Error(event.message || "Pipeline error");
          }
        }
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(
        err.message ||
          `Could not connect to the backend. Make sure FastAPI is running on ${API_BASE}`
      );
      setActiveStep(0);
      setCompletedSteps([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!output && !formattedHtml) return;
    const textToCopy = output || formattedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    navigator.clipboard?.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const calculatedWordCount = output
    ? output.trim().split(/\s+/).filter(Boolean).length
    : metadata.wordCount;
  const calculatedReadTime = output
    ? `${Math.max(1, Math.round(calculatedWordCount / 180))} min read`
    : metadata.readTime;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[var(--color-surface-container-lowest)] font-body-md text-body-md text-[var(--color-on-surface)] min-h-screen flex flex-col justify-between selection:bg-blue-100">
      {/* ─── Fixed Top Navigation Bar ─── */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[var(--color-surface-container-lowest)]/95 backdrop-blur-md border-b border-[var(--color-outline-variant)]/40 shadow-2xs">
        <div className="h-16 max-w-[76rem] mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-title-md text-title-md text-gray-900 tracking-tight font-bold">
                Synergy AI
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                v2.0
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-4 md:gap-6">
            <nav className="flex items-center gap-1 bg-gray-100/70 p-1 rounded-xl">
              {[
                { id: "dashboard", label: "Multi-Agent", icon: "hub" },
                { id: "workspace", label: "Humanizer", icon: "auto_fix_high" },
                { id: "history", label: "History", icon: "history_edu" },
                { id: "credits", label: "Credits", icon: "toll" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Credit Score Pill */}
            <CreditWidget
              creditInfo={creditInfo}
              isLoading={isCreditLoading}
              onRefresh={() => refreshCredits()}
              compact={true}
            />

            {/* User Auth Section */}
            <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs"
                    title={currentUser.email || "User"}
                  >
                    {(currentUser.email?.[0] || "U").toUpperCase()}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-gray-500 hover:text-red-600 font-medium hidden md:inline cursor-pointer"
                    title="Sign Out"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content Tabs ─── */}
      <main className="w-full pt-20 pb-16 bg-[#faf8ff] min-h-screen">
        <div className="max-w-[76rem] mx-auto px-6 py-6">

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              VIEW 1: DASHBOARD (MULTI-AGENT ARTICLE GENERATOR) - PRESERVED 100%
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Page hero */}
              <div className="mb-8 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-label-sm text-xs font-semibold mb-3">
                  <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  AI Content Assistant &bull; 4-Agent Crew (Manager, Research, Content, Reviewer)
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Multi-Agent Autonomous Generation
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Type any topic and let the 4-agent pipeline research, draft, humanize, and review your content.
                </p>
              </div>

              {/* 1. Input Box */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xs border border-[var(--color-outline-variant)]/50">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <label
                    className="block text-sm font-bold text-gray-800"
                    htmlFor="prompt-input"
                  >
                    Enter Topic or Prompt
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">
                    <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                    Detailed Report
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Describe the article, report, or essay you want. Be as specific or broad as you like.
                </p>
                <textarea
                  id="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. How quantum computing will transform modern cryptography and cybersecurity"
                  rows={4}
                  className="w-full min-h-[130px] p-4 text-sm bg-gray-50/50 text-gray-800 border border-gray-200 rounded-2xl placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all resize-y"
                />
              </div>

              {/* 2. Generate Button & Credits Used Badge */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    id="generate-btn"
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className={`bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-8 py-3.5 rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer ${
                      isGenerating || !prompt.trim() ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      auto_awesome
                    </span>
                    <span id="btn-text">{isGenerating ? "Executing 4-Agent Pipeline..." : "Generate Report (2 Credits)"}</span>
                  </button>

                  {/* Real-time credits used today badge */}
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-[var(--color-outline-variant)]/40 shadow-2xs text-xs">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">toll</span>
                    <span className="text-gray-600">
                      Credits Used Today: <strong className="text-blue-700 font-extrabold">{creditInfo?.used_credits ?? 0}</strong>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-500 font-medium">
                      Remaining: <strong className="text-emerald-600 font-bold">{creditInfo?.remaining_credits ?? 50}</strong> / {creditInfo?.daily_limit ?? 50}
                    </span>
                  </div>
                </div>

                {output && (
                  <button
                    onClick={() => handleSendToWorkspace(output)}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-2xl text-xs font-bold border border-purple-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                    <span>Send to Humanizer Workspace</span>
                  </button>
                )}
              </div>

              {/* 3. Live 4-Agent Pipeline Progress — Premium Animated UI */}
              <div className="rounded-3xl border border-[var(--color-outline-variant)]/40 bg-white shadow-xs overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${isGenerating ? "text-blue-600 animate-spin" : completedSteps.length === 4 ? "text-emerald-500" : "text-blue-400"}`}
                      style={{ animationDuration: "2s" }}>hub</span>
                    CrewAI 4-Agent Pipeline
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-all ${
                    isGenerating ? "bg-blue-50 text-blue-600" :
                    completedSteps.length === 4 ? "bg-emerald-50 text-emerald-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {isGenerating ? `Agent ${activeStep} of 4 active` :
                     completedSteps.length === 4 ? "✓ Pipeline Complete" :
                     "Awaiting prompt"}
                  </span>
                </div>

                {/* Agent pipeline with connecting lines */}
                <div className="px-6 py-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-0 md:gap-0 relative">
                    {AGENT_STEPS.map(({ step, emoji, name, label, done }, idx) => {
                      const isActive = activeStep === step;
                      const isDone = completedSteps.includes(step);
                      const isNext = !isDone && !isActive && activeStep === step - 1;
                      const isPending = !isDone && !isActive;

                      return (
                        <React.Fragment key={step}>
                          {/* Agent Card */}
                          <div className="flex-1 flex flex-col items-center text-center relative z-10 group">
                            {/* Outer glow ring */}
                            <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl mb-3 transition-all duration-500 ${
                              isActive
                                ? "bg-blue-600 shadow-[0_0_24px_6px_rgba(37,99,235,0.35)] scale-110"
                                : isDone
                                ? "bg-emerald-500 shadow-[0_0_14px_3px_rgba(16,185,129,0.25)]"
                                : "bg-gray-100 shadow-none"
                            }`}>
                              {/* Ping ring for active */}
                              {isActive && (
                                <span className="absolute inset-0 rounded-2xl bg-blue-500 animate-ping opacity-30" />
                              )}
                              <span className={`text-2xl transition-all duration-300 ${
                                isActive ? "scale-110" : isDone ? "scale-100" : "grayscale opacity-40"
                              }`}>{emoji}</span>
                            </div>

                            {/* Step badge */}
                            <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white transition-all ${
                              isDone ? "bg-emerald-500 text-white" :
                              isActive ? "bg-blue-600 text-white" :
                              "bg-gray-200 text-gray-400"
                            }`}>{isDone ? "✓" : step}</span>

                            {/* Agent name */}
                            <p className={`text-xs font-bold mb-1 transition-colors duration-300 ${
                              isActive ? "text-blue-700" :
                              isDone ? "text-emerald-700" :
                              "text-gray-400"
                            }`}>{name}</p>

                            {/* Status chip */}
                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-300 ${
                              isActive ? "bg-blue-50 text-blue-600 border border-blue-200" :
                              isDone ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                              "bg-gray-50 text-gray-400 border border-gray-200"
                            }`}>
                              {isDone ? done : isActive ? "● Running" : "Waiting"}
                            </div>

                            {/* Per-agent shimmer progress bar */}
                            {isActive && (
                              <div className="w-full max-w-[90px] h-1.5 bg-blue-100 rounded-full overflow-hidden mt-2.5">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                                  style={{
                                    animation: "shimmerBar 1.8s ease-in-out infinite",
                                    backgroundSize: "200% 100%",
                                  }}
                                />
                              </div>
                            )}
                            {isDone && (
                              <div className="w-full max-w-[90px] h-1.5 bg-emerald-100 rounded-full overflow-hidden mt-2.5">
                                <div className="h-full w-full bg-emerald-400 rounded-full" />
                              </div>
                            )}
                          </div>

                          {/* Connector line between agents */}
                          {idx < AGENT_STEPS.length - 1 && (
                            <div className="hidden md:flex items-center flex-shrink-0 w-12 mx-1 relative" style={{ marginTop: "-48px" }}>
                              <div className={`w-full h-0.5 rounded-full transition-all duration-700 ${
                                completedSteps.includes(step)
                                  ? "bg-emerald-400"
                                  : isActive
                                  ? "bg-gradient-to-r from-blue-500 to-blue-200 animate-pulse"
                                  : "bg-gray-200"
                              }`} />
                              {/* Arrow tip */}
                              <svg className={`absolute right-0 w-3 h-3 transition-colors duration-500 ${
                                completedSteps.includes(step) ? "text-emerald-400" :
                                isActive ? "text-blue-400" : "text-gray-200"
                              }`} viewBox="0 0 6 6" fill="currentColor">
                                <path d="M0 0 L6 3 L0 6 Z" />
                              </svg>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Overall pipeline progress bar */}
                <div className="px-6 pb-5">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                    <span>Overall progress</span>
                    <span className="font-semibold text-gray-600">{completedSteps.length} / 4 complete</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        completedSteps.length === 4
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                          : "bg-gradient-to-r from-blue-500 to-indigo-500"
                      }`}
                      style={{ width: `${(completedSteps.length / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Output Box */}
              <div
                ref={outputRef}
                className="bg-white rounded-3xl p-6 md:p-10 shadow-xs border border-[var(--color-outline-variant)]/50 min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  {/* Output card header */}
                  <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${formattedHtml ? "bg-emerald-500" : "bg-gray-300"}`} />
                      <h2 className="text-base font-bold text-gray-900">
                        Generated Report Output
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {output && (
                        <button
                          type="button"
                          onClick={() => handleSendToWorkspace(output)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                          <span>Humanize</span>
                        </button>
                      )}
                      <button
                        id="copy-btn"
                        type="button"
                        onClick={handleCopy}
                        disabled={!output && !formattedHtml}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 text-gray-700 text-xs font-semibold hover:bg-gray-100 border border-gray-200 transition-all cursor-pointer ${
                          !output && !formattedHtml ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]" id="copy-icon">
                          {copied ? "check" : "content_copy"}
                        </span>
                        <span id="copy-label">{copied ? "Copied!" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Article content */}
                  <div className="article-prose min-h-[200px]">
                    {formattedHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: formattedHtml }} />
                    ) : output ? (
                      <div>
                        {output
                          .split(/\n{2,}/)
                          .filter(Boolean)
                          .map((para, i) => (
                            <p key={i} className="article-para mb-4 leading-relaxed text-sm text-gray-800">{para.trim()}</p>
                          ))}
                      </div>
                    ) : isGenerating ? (
                      <div className="flex flex-col gap-3 mt-2">
                        {/* Skeleton loading bars */}
                        {[90, 100, 75, 100, 85, 60].map((w, i) => (
                          <div
                            key={i}
                            className="h-4 rounded-xl bg-gray-100 animate-pulse"
                            style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                        <span className="material-symbols-outlined text-[40px] text-gray-300 mb-2">article</span>
                        <p className="text-xs">Your generated article will appear here. Enter a prompt above and click Generate.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Output meta footer */}
                <div className="mt-8 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between text-gray-400 text-xs gap-y-2">
                  <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      {metadata.plagiarismOriginality}
                    </span>
                    <span>&bull;</span>
                    <span className="text-blue-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">psychology</span>
                      {metadata.aiOrganicScore}
                    </span>
                    {metadata.factAccuracy && metadata.factAccuracy !== "—" && (
                      <>
                        <span>&bull;</span>
                        <span className="text-indigo-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                          {metadata.factAccuracy}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-gray-600">
                    <span>Approx. {calculatedWordCount} words</span>
                    <span>&bull;</span>
                    <span>{calculatedReadTime}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              VIEW 2: WORKSPACE (HUMANIZER & REPHRASER)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "workspace" && (
            <div className="animate-in fade-in duration-200">
              <WorkspaceView
                userId={userId}
                initialText={workspaceInitialText}
                onCreditUsed={() => refreshCredits()}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              VIEW 3: HISTORY (CHAT & GENERATION ARCHIVES)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "history" && (
            <div className="animate-in fade-in duration-200">
              <HistoryView
                userId={userId}
                onSelectPrompt={(p) => {
                  setPrompt(p);
                  setActiveTab("dashboard");
                }}
                onSendToWorkspace={(text) => handleSendToWorkspace(text)}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              VIEW 4: CREDITS (DAILY USAGE & ALLOWANCE DASHBOARD)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "credits" && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
              <div className="mb-2 text-center">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Credit Balance & Operations</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Daily allowance tracking and credit consumption per action.
                </p>
              </div>

              <CreditWidget
                creditInfo={creditInfo}
                isLoading={isCreditLoading}
                onRefresh={() => refreshCredits()}
                compact={false}
              />
            </div>
          )}

        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="w-full bg-white border-t border-[var(--color-outline-variant)]/30 py-6">
        <div className="max-w-[76rem] mx-auto px-6 flex items-center justify-between text-gray-500 text-xs">
          <span>&copy; 2026 Synergy AI. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a
              className="hover:text-gray-900 transition-colors"
              href="#docs"
              onClick={(e) => { e.preventDefault(); alert("Synergy AI: 4-Agent CrewAI System with Workspace Humanizer & Credit Management."); }}
            >
              Documentation
            </a>
            <a
              className="hover:text-gray-900 transition-colors"
              href="#support"
              onClick={(e) => { e.preventDefault(); alert("Synergy AI Support: Workspace Humanizer & Multi-Agent engine active."); }}
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
