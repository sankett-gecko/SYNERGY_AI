"use client";

import React, { useState, useEffect, useRef } from "react";
import { humanizeText, analyzeText, HumanizeResult, AnalyzeResult } from "@/lib/api";

interface WorkspaceViewProps {
  userId: string;
  initialText?: string;
  onCreditUsed?: () => void;
}

interface OutputModeConfig {
  id: "Easy" | "Medium" | "Hard";
  label: string;
  badge: string;
  credits: number;
  icon: string;
  shortDesc: string;
  fullDesc: string;
  color: string;
  activeBorder: string;
  activeBg: string;
  pillBg: string;
  pillText: string;
}

const OUTPUT_MODES: OutputModeConfig[] = [
  {
    id: "Easy",
    label: "Easy",
    badge: "1 Credit",
    credits: 1,
    icon: "draw",
    shortDesc: "Light natural polish",
    fullDesc: "Softens stiff robotic phrasing, eliminates common AI buzzwords, and gently polishes tone into relaxed, plain English while preserving clarity.",
    color: "emerald",
    activeBorder: "border-emerald-500 ring-2 ring-emerald-500/20",
    activeBg: "bg-emerald-50/50",
    pillBg: "bg-emerald-100",
    pillText: "text-emerald-800",
  },
  {
    id: "Medium",
    label: "Medium",
    badge: "2 Credits",
    credits: 2,
    icon: "auto_fix_normal",
    shortDesc: "Balanced conversational flow",
    fullDesc: "Recasts repetitive clauses, introduces rhythmic sentence length variations, active voice, conversational idioms, and natural contractions.",
    color: "blue",
    activeBorder: "border-blue-500 ring-2 ring-blue-500/20",
    activeBg: "bg-blue-50/50",
    pillBg: "bg-blue-100",
    pillText: "text-blue-800",
  },
  {
    id: "Hard",
    label: "Hard",
    badge: "3 Credits",
    credits: 3,
    icon: "shield_person",
    shortDesc: "Deep AI-bypass & burstiness",
    fullDesc: "Radical syntactic re-engineering with extreme organic burstiness (2-4 word punchy sentences mixed with layered thoughts) to achieve <1.5% AI detection.",
    color: "purple",
    activeBorder: "border-purple-500 ring-2 ring-purple-500/20",
    activeBg: "bg-purple-50/50",
    pillBg: "bg-purple-100",
    pillText: "text-purple-800",
  },
];

// Step definitions for each humanizing mode
const HUMANIZER_STEPS: Record<"Easy" | "Medium" | "Hard", { title: string; desc: string; icon: string }[]> = {
  Easy: [
    {
      title: "Scanning Syntax & Buzzwords",
      desc: "Scanning text to detect stiff robotic phrasing, cliches, and repetitive structures...",
      icon: "search",
    },
    {
      title: "Smoothing Tone & Transitions",
      desc: "Gently polishing sentence transitions and removing AI markers into plain English...",
      icon: "tune",
    },
    {
      title: "Finalizing Light Polish",
      desc: "Applying grammar verification and preparing natural humanized draft...",
      icon: "verified",
    },
  ],
  Medium: [
    {
      title: "Deconstructing Rigid AI Syntax",
      desc: "Analyzing sentence rhythms, formulaic transitions, and robotic sentence patterns...",
      icon: "reorder",
    },
    {
      title: "Injecting Conversational Cadence",
      desc: "Rewriting clauses with natural contractions, active voice, and engaging human idioms...",
      icon: "auto_fix_normal",
    },
    {
      title: "Optimizing Burstiness",
      desc: "Balancing sentence lengths with alternating short and medium flowing clauses...",
      icon: "equalizer",
    },
    {
      title: "Final Quality Verification",
      desc: "Executing final grammar polish and organic readability validation...",
      icon: "verified",
    },
  ],
  Hard: [
    {
      title: "Deep Semantic & AI Pattern Analysis",
      desc: "Analyzing n-gram predictability, syntax uniformity, and detection probability markers...",
      icon: "analytics",
    },
    {
      title: "Eradicating Synthetic Phrasing",
      desc: "Completely eliminating predictable AI transitions, canned phrases, and robotic markers...",
      icon: "security",
    },
    {
      title: "Dynamic Burstiness Engineering",
      desc: "Interleaving ultra-short 2-4 word punchy sentences with rich, complex compound clauses...",
      icon: "bolt",
    },
    {
      title: "Anti-Detection Verification",
      desc: "Testing against Turnitin / GPTZero patterns and fine-tuning organic tone...",
      icon: "shield_person",
    },
    {
      title: "Synthesizing Masterwork",
      desc: "Finalizing complete, beautifully coherent, 100% organic human prose...",
      icon: "verified",
    },
  ],
};

// ─── Word-level Diff Calculator ───────────────────────────────────────────────
interface DiffToken {
  type: "same" | "added" | "removed";
  text: string;
}

function computeWordDiff(orig: string, hum: string): DiffToken[] {
  const origWords = orig.split(/\s+/).filter(Boolean);
  const humWords = hum.split(/\s+/).filter(Boolean);

  if (origWords.join(" ") === humWords.join(" ")) {
    return humWords.map((w) => ({ type: "same", text: w }));
  }

  const maxWords = 600;
  const oW = origWords.slice(0, maxWords);
  const hW = humWords.slice(0, maxWords);

  const m = oW.length;
  const n = hW.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cleanO = oW[i - 1].toLowerCase().replace(/[^\w]/g, "");
      const cleanH = hW[j - 1].toLowerCase().replace(/[^\w]/g, "");
      if (cleanO === cleanH) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const diff: DiffToken[] = [];

  while (i > 0 || j > 0) {
    const cleanO = i > 0 ? oW[i - 1].toLowerCase().replace(/[^\w]/g, "") : "";
    const cleanH = j > 0 ? hW[j - 1].toLowerCase().replace(/[^\w]/g, "") : "";

    if (i > 0 && j > 0 && cleanO === cleanH) {
      diff.unshift({ type: "same", text: hW[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "added", text: hW[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: "removed", text: oW[i - 1] });
      i--;
    }
  }

  return diff;
}

export default function WorkspaceView({
  userId,
  initialText = "",
  onCreditUsed,
}: WorkspaceViewProps) {
  const [inputText, setInputText] = useState(initialText);
  const [selectedMode, setSelectedMode] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [result, setResult] = useState<HumanizeResult | null>(null);
  const [liveAnalysis, setLiveAnalysis] = useState<AnalyzeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Feature 1: Diff View mode ('standard' | 'diff')
  const [viewMode, setViewMode] = useState<"standard" | "diff">("standard");

  // New Feature 2: Multi-format export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close export menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update input text if sent from parent
  useEffect(() => {
    if (initialText) {
      setInputText(initialText);
    }
  }, [initialText]);

  // Live lightweight metrics analysis on debounce
  useEffect(() => {
    if (!inputText.trim()) {
      setLiveAnalysis(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const analysis = await analyzeText(inputText);
        setLiveAnalysis(analysis);
      } catch {
        // ignore live check error
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [inputText]);

  const activeModeConfig = OUTPUT_MODES.find((m) => m.id === selectedMode) || OUTPUT_MODES[1];
  const currentSteps = HUMANIZER_STEPS[selectedMode];

  // Animated progression through steps while processing
  useEffect(() => {
    if (isProcessing) {
      setActiveStepIndex(0);
      const totalSteps = currentSteps.length;
      // Step duration synced to mode duration floors: Easy = ~700ms/step (2.2s total), Medium = ~1250ms/step (5.2s total), Hard = ~2000ms/step (10.2s total)
      const intervalMs = selectedMode === "Easy" ? 700 : selectedMode === "Medium" ? 1250 : 2000;

      stepTimerRef.current = setInterval(() => {
        setActiveStepIndex((prev) => {
          if (prev < totalSteps - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, intervalMs);
    } else {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [isProcessing, selectedMode, currentSteps.length]);

  const handleHumanize = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const res = await humanizeText(
        inputText,
        selectedMode,
        userId,
      );
      setResult(res);
      if (onCreditUsed) onCreditUsed();
    } catch (err: any) {
      console.error("Humanize error:", err);
      setError(
        err.message ||
          `Failed to humanize text. Insufficient credits (${activeModeConfig.credits} credits required) or API error.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!result?.humanized_text) return;
    navigator.clipboard?.writeText(result.humanized_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Multi-Format Export Handlers (100% Free / Client-Side, 0 API consumption) ─
  const handleExportTxt = () => {
    if (!result?.humanized_text) return;
    const blob = new Blob([result.humanized_text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `humanized-${selectedMode.toLowerCase()}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportMd = () => {
    if (!result?.humanized_text) return;
    const mdContent = `# Humanized Output (${result.mode} Level)\n\n*Word Count: ${result.humanized_word_count} | AI Detection Score: ${result.ai_probability_score} | Burstiness Index: ${result.burstiness_index}*\n\n---\n\n${result.humanized_text}\n`;
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `humanized-${selectedMode.toLowerCase()}-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportDoc = () => {
    if (!result?.humanized_text) return;
    const htmlDoc = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Humanized Document</title>
      <style>body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.6; color: #111; }</style>
      </head>
      <body>
      <h2 style="color: #1e3a8a;">Humanized Output (${result.mode} Mode)</h2>
      <p style="color: #64748b; font-size: 10pt;"><em>Word Count: ${result.humanized_word_count} | AI Probability: ${result.ai_probability_score} | Burstiness: ${result.burstiness_index}</em></p>
      <hr/>
      ${result.humanized_text.split(/\n{2,}/).map((p) => `<p>${p.trim()}</p>`).join("")}
      </body></html>
    `;
    const blob = new Blob([htmlDoc], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `humanized-${selectedMode.toLowerCase()}-${Date.now()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrintPdf = () => {
    if (!result?.humanized_text) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Humanized Document - ${result.mode} Level</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; max-width: 800px; margin: auto; }
          h1 { font-size: 20px; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 8px; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
          p { margin-bottom: 16px; font-size: 14px; text-align: justify; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>Humanized Output (${result.mode} Level)</h1>
        <div class="meta">Word Count: ${result.humanized_word_count} | AI Probability: ${result.ai_probability_score} | Burstiness Score: ${result.burstiness_index}</div>
        ${result.humanized_text.split(/\n{2,}/).map((p) => `<p>${p.trim()}</p>`).join("")}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[var(--color-outline-variant)]/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">auto_fix_high</span>
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Workspace Humanizer</h2>
              <p className="text-xs text-gray-500">
                Transform robotic AI text into natural, highly organic human writing. Choose your desired output level below.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {inputText && (
            <button
              onClick={() => {
                setInputText("");
                setResult(null);
              }}
              className="px-3 py-2 text-gray-500 hover:text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
            >
              Clear Text
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ─── 3 OUTPUT TYPE SECTIONS (EASY, MEDIUM, HARD) ─── */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[var(--color-outline-variant)]/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Select Output Type & Intensity Level
            </label>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Each level delivers a completely distinct humanized output tailored to that tier, using different credits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {OUTPUT_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? `${mode.activeBorder} ${mode.activeBg} shadow-sm`
                    : "border-gray-200/90 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isSelected ? "bg-white shadow-2xs text-gray-900" : "bg-gray-100 text-gray-600"
                      }`}>
                        <span className="material-symbols-outlined text-[18px]">{mode.icon}</span>
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">{mode.label}</h4>
                    </div>

                    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${mode.pillBg} ${mode.pillText}`}>
                      {mode.badge}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-gray-700 mb-1">{mode.shortDesc}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{mode.fullDesc}</p>
                </div>

                <div className="pt-3 mt-3 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Credit Cost</span>
                  <span className="font-bold text-gray-800">{mode.credits} {mode.credits === 1 ? "Credit" : "Credits"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="material-symbols-outlined text-[16px] text-blue-600">info</span>
            <span>
              Active Level: <strong className="text-gray-800">{activeModeConfig.label}</strong> ({activeModeConfig.credits} {activeModeConfig.credits === 1 ? "credit" : "credits"} will be deducted)
            </span>
          </div>

          <button
            onClick={handleHumanize}
            disabled={isProcessing || !inputText.trim()}
            className={`px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              isProcessing || !inputText.trim()
                ? "opacity-50 cursor-not-allowed"
                : "hover:shadow-md active:scale-[0.99]"
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${isProcessing ? "animate-spin" : ""}`}>
              {isProcessing ? "refresh" : "auto_fix_high"}
            </span>
            <span>
              {isProcessing
                ? `Humanizing with ${activeModeConfig.label} Mode...`
                : `Humanize Text (${activeModeConfig.credits} ${activeModeConfig.credits === 1 ? "Credit" : "Credits"})`}
            </span>
          </button>
        </div>
      </div>

      {/* ─── DUAL PANE EDITOR ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Original Input */}
        <div className="bg-white rounded-3xl p-6 border border-[var(--color-outline-variant)]/40 shadow-xs flex flex-col justify-between min-h-[480px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-gray-400 text-[18px]">input</span>
                Original Text
              </span>
              {liveAnalysis && (
                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                  <span>{liveAnalysis.word_count} words</span>
                  <span>&bull;</span>
                  <span className="text-amber-600 font-semibold">{liveAnalysis.ai_probability_score} AI Probability</span>
                </div>
              )}
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type the text you want to humanize here..."
              rows={14}
              className="w-full text-sm text-gray-800 placeholder-gray-400 bg-transparent border-none focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Live Analysis Footer */}
          {liveAnalysis && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-[11px] text-gray-600 bg-gray-50/70 p-3 rounded-2xl">
              <div>
                <span className="text-gray-400 block text-[10px]">Cliches Detected</span>
                <span className="font-bold text-red-600">{liveAnalysis.cliches_detected} flagged</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Sentence Burstiness</span>
                <span className="font-bold text-gray-700">{liveAnalysis.burstiness_index} / 10</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Est. AI Probability</span>
                <span className="font-bold text-amber-600">{liveAnalysis.ai_probability_score}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Humanized Result / Diff Comparison View */}
        <div className="bg-white rounded-3xl p-6 border border-[var(--color-outline-variant)]/40 shadow-xs flex flex-col justify-between min-h-[480px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
                  Humanized Output {result ? `(${result.mode} Level)` : ""}
                </span>

                {/* FEATURE 1: Diff View Toggle (0 API Consumption) */}
                {result && (
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-xl ml-2">
                    <button
                      onClick={() => setViewMode("standard")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        viewMode === "standard"
                          ? "bg-white text-gray-900 shadow-2xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Clean View
                    </button>
                    <button
                      onClick={() => setViewMode("diff")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        viewMode === "diff"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">difference</span>
                      Show Changes
                    </button>
                  </div>
                )}
              </div>

              {result && (
                <div className="flex items-center gap-1.5 relative">
                  {/* FEATURE 5: Direct Re-roll Button */}
                  <button
                    onClick={handleHumanize}
                    disabled={isProcessing}
                    className="p-1.5 rounded-xl text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title={`Re-roll another variation with ${result.mode} mode (${activeModeConfig.credits} credits)`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isProcessing ? "animate-spin" : ""}`}>
                      cached
                    </span>
                    <span>Re-roll</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Copy Output"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copied ? "check" : "content_copy"}
                    </span>
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>

                  {/* FEATURE 2: Multi-Format Export Dropdown (0 API Consumption) */}
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="p-1.5 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Export Options"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Export</span>
                      <span className="material-symbols-outlined text-[14px]">expand_more</span>
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-3 py-1 text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                          Choose Format (Free)
                        </div>
                        <button
                          onClick={handlePrintPdf}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-500">picture_as_pdf</span>
                          <span>Download as PDF</span>
                        </button>
                        <button
                          onClick={handleExportDoc}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-blue-600">description</span>
                          <span>Export Word (.doc)</span>
                        </button>
                        <button
                          onClick={handleExportMd}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-purple-600">markdown</span>
                          <span>Export Markdown (.md)</span>
                        </button>
                        <button
                          onClick={handleExportTxt}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-gray-500">article</span>
                          <span>Plain Text (.txt)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-800 leading-relaxed min-h-[260px]">
              {/* ─── LIVE STEP-BY-STEP HUMANIZING PROCESS VISUALIZER ─── */}
              {isProcessing ? (
                <div className="space-y-4 py-2 animate-in fade-in duration-300">
                  {/* Status Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                          <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                        </span>
                        <span className="absolute -inset-1 rounded-xl bg-blue-400/30 animate-ping -z-10" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                            {selectedMode} Humanization in Progress
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            Step {activeStepIndex + 1} of {currentSteps.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-700 mt-0.5 font-medium">
                          {currentSteps[activeStepIndex]?.title}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Overall Shimmer Progress Bar */}
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full transition-all duration-500 relative"
                      style={{
                        width: `${Math.min(100, Math.round(((activeStepIndex + 1) / currentSteps.length) * 100))}%`,
                      }}
                    >
                      <div
                        className="absolute inset-0 bg-white/40"
                        style={{ animation: "shimmerBar 1.5s infinite" }}
                      />
                    </div>
                  </div>

                  {/* Step-by-Step Task List */}
                  <div className="space-y-2.5 pt-2">
                    {currentSteps.map((step, idx) => {
                      const isDone = idx < activeStepIndex;
                      const isCurrent = idx === activeStepIndex;

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 ${
                            isCurrent
                              ? "bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-300"
                              : isDone
                              ? "bg-emerald-50/40 border-emerald-200 opacity-90"
                              : "bg-gray-50/50 border-gray-100 opacity-40"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isDone ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[12px] font-bold shadow-xs">
                                ✓
                              </span>
                            ) : isCurrent ? (
                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold animate-pulse shadow-xs">
                                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className={`text-xs font-bold ${
                                isCurrent ? "text-blue-900" : isDone ? "text-emerald-900" : "text-gray-500"
                              }`}>
                                {step.title}
                              </h5>
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                isCurrent ? "text-blue-600 animate-pulse" : isDone ? "text-emerald-600" : "text-gray-400"
                              }`}>
                                {isDone ? "Completed" : isCurrent ? "Processing..." : "Pending"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : result ? (
                viewMode === "diff" ? (
                  /* ─── FEATURE 1: DIFF VISUALIZER VIEW ─── */
                  <div className="space-y-3">
                    <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-[11px] mb-2">
                      <span className="font-bold text-gray-700">Sentence Comparison Legend:</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                          Rewritten / Humanized
                        </span>
                        <span className="flex items-center gap-1 text-rose-700 line-through">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                          Replaced / AI Syntax
                        </span>
                      </div>
                    </div>

                    <div className="leading-relaxed p-2 bg-gray-50/40 rounded-xl border border-gray-100 font-normal">
                      {computeWordDiff(result.original_text, result.humanized_text).map((token, idx) => {
                        if (token.type === "added") {
                          return (
                            <span
                              key={idx}
                              className="bg-emerald-100 text-emerald-900 font-semibold px-1 py-0.5 rounded mx-0.5 border border-emerald-200 inline-block my-0.5"
                            >
                              {token.text}
                            </span>
                          );
                        } else if (token.type === "removed") {
                          return (
                            <span
                              key={idx}
                              className="line-through bg-rose-100/80 text-rose-700 opacity-60 px-1 py-0.5 rounded mx-0.5 inline-block my-0.5"
                            >
                              {token.text}
                            </span>
                          );
                        }
                        return <span key={idx}> {token.text} </span>;
                      })}
                    </div>
                  </div>
                ) : (
                  /* ─── CLEAN PROSE VIEW ─── */
                  <div className="space-y-3">
                    {result.humanized_text.split(/\n{2,}/).map((para, i) => (
                      <p key={i} className="mb-3 leading-relaxed">{para.trim()}</p>
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-56 text-center text-gray-400">
                  <span className="material-symbols-outlined text-[40px] text-gray-300 mb-2">magic_button</span>
                  <p className="text-xs font-medium text-gray-500">No humanized output yet</p>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                    Paste your text on the left, choose your output level (Easy, Medium, or Hard), and click Humanize.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Results Analytics Footer */}
          {result && (
            <div className="pt-3 border-t border-gray-100 bg-emerald-50/50 p-3.5 rounded-2xl space-y-2 mt-4">
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div>
                  <span className="text-gray-400 block text-[10px]">AI Probability</span>
                  <span className="font-bold text-emerald-700">{result.ai_probability_score}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Burstiness</span>
                  <span className="font-bold text-emerald-700">{result.burstiness_index}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Cliches Removed</span>
                  <span className="font-bold text-emerald-700">{result.cliches_removed}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Word Count</span>
                  <span className="font-bold text-gray-700">{result.humanized_word_count}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
