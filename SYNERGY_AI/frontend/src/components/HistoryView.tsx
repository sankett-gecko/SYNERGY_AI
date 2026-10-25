"use client";

import React, { useState, useEffect } from "react";
import { HistoryItem, getGenerationHistory, deleteHistoryItem } from "@/lib/api";

interface HistoryViewProps {
  userId: string;
  onSelectPrompt?: (prompt: string, format: string) => void;
  onSendToWorkspace?: (text: string) => void;
}

export default function HistoryView({
  userId,
  onSelectPrompt,
  onSendToWorkspace,
}: HistoryViewProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "REPORTS" | "EASY" | "MEDIUM" | "HARD">("ALL");
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getGenerationHistory(userId, searchQuery);
      setHistory(data.history || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [userId, searchQuery]);

  // Reset original toggle when preview changes
  useEffect(() => {
    setShowOriginal(false);
  }, [previewItem?.id]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this record?")) return;
    setDeletingId(id);
    try {
      const success = await deleteHistoryItem(id, userId);
      if (success) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (previewItem?.id === id) setPreviewItem(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (text: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportTxt = (item: HistoryItem) => {
    const blob = new Blob([item.final_text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.prompt.slice(0, 25).replace(/[^\w]/g, "_")}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMd = (item: HistoryItem) => {
    const md = `# ${item.prompt}\n\n*Format: ${item.format_type} | Words: ${item.word_count} | AI Score: ${item.ai_score}*\n\n---\n\n${item.final_text}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.prompt.slice(0, 25).replace(/[^\w]/g, "_")}-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDoc = (item: HistoryItem) => {
    const htmlDoc = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${item.prompt}</title>
      <style>body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.6; color: #111; }</style>
      </head>
      <body>
      <h2 style="color: #1e3a8a;">${item.prompt}</h2>
      <p style="color: #64748b; font-size: 10pt;"><em>Format: ${item.format_type} | Word Count: ${item.word_count} | AI Score: ${item.ai_score}</em></p>
      <hr/>
      ${item.final_text.split(/\n{2,}/).map(p => `<p>${p.trim()}</p>`).join("")}
      </body></html>
    `;
    const blob = new Blob([htmlDoc], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.prompt.slice(0, 25).replace(/[^\w]/g, "_")}-${Date.now()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = (item: HistoryItem) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${item.prompt}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; max-width: 800px; margin: auto; }
          h1 { font-size: 20px; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 8px; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
          p { margin-bottom: 16px; font-size: 14px; text-align: justify; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${item.prompt}</h1>
        <div class="meta">Format: ${item.format_type} | Word Count: ${item.word_count} | AI Score: ${item.ai_score}</div>
        ${item.final_text.split(/\n{2,}/).map(p => `<p>${p.trim()}</p>`).join("")}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter items based on active tab
  const filteredHistory = history.filter((item) => {
    const format = item.format_type.toLowerCase();
    if (filterType === "ALL") return true;
    if (filterType === "REPORTS") return !format.includes("humanizer");
    if (filterType === "EASY") return format.includes("easy");
    if (filterType === "MEDIUM") return format.includes("medium");
    if (filterType === "HARD") return format.includes("hard") || format.includes("maximum");
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search and Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-[var(--color-outline-variant)]/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">history_edu</span>
            Generation & Humanizer History
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            View past 4-agent reports and humanizer drafts across Easy, Medium, and Hard tiers.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-80">
          <div className="relative w-full">
            <span className="material-symbols-outlined text-[18px] text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts, reports, or drafts..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-2.5 py-2 text-xs text-gray-500 hover:text-gray-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "ALL", label: "All Items", icon: "all_inclusive", count: history.length },
          {
            id: "REPORTS",
            label: "Generated Reports",
            icon: "article",
            count: history.filter((i) => !i.format_type.toLowerCase().includes("humanizer")).length,
          },
          {
            id: "EASY",
            label: "Humanizer (Easy)",
            icon: "draw",
            count: history.filter((i) => i.format_type.toLowerCase().includes("easy")).length,
          },
          {
            id: "MEDIUM",
            label: "Humanizer (Medium)",
            icon: "auto_fix_normal",
            count: history.filter((i) => i.format_type.toLowerCase().includes("medium")).length,
          },
          {
            id: "HARD",
            label: "Humanizer (Hard)",
            icon: "shield_person",
            count: history.filter((i) => i.format_type.toLowerCase().includes("hard") || i.format_type.toLowerCase().includes("maximum")).length,
          },
        ].map((tab) => {
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: History Records List */}
        <div className={`${previewItem ? "lg:col-span-5" : "lg:col-span-12"} space-y-3`}>
          {isLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-[var(--color-outline-variant)]/40">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500">Loading history records...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-[var(--color-outline-variant)]/40">
              <span className="material-symbols-outlined text-[36px] text-gray-300 mb-2">inbox</span>
              <p className="text-sm font-semibold text-gray-700">No records found</p>
              <p className="text-xs text-gray-400 mt-1">
                {filterType === "ALL"
                  ? "Run a multi-agent generation or humanize text in Workspace to see items here."
                  : "No items match the selected filter."}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isSelected = previewItem?.id === item.id;
              const isHumanizer = item.format_type.toLowerCase().includes("humanizer");
              const isEasy = item.format_type.toLowerCase().includes("easy");
              const isMed = item.format_type.toLowerCase().includes("medium");
              const isHard = item.format_type.toLowerCase().includes("hard") || item.format_type.toLowerCase().includes("maximum");

              const dateStr = new Date(item.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  onClick={() => setPreviewItem(item)}
                  className={`bg-white rounded-2xl p-5 border cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 ring-1 ring-blue-500 shadow-sm"
                      : "border-[var(--color-outline-variant)]/40 hover:border-gray-300 hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isEasy
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : isMed
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : isHard
                        ? "bg-purple-50 text-purple-800 border-purple-200"
                        : "bg-indigo-50 text-indigo-800 border-indigo-200"
                    }`}>
                      {item.format_type}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">{dateStr}</span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-sm line-clamp-1 mb-1">
                    {item.prompt}
                  </h3>

                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                    {item.final_text}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                    <div className="flex items-center gap-3">
                      <span>{item.word_count} words</span>
                      <span>&bull;</span>
                      <span className="text-emerald-600 font-semibold">{item.ai_score}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleCopy(item.final_text, item.id, e)}
                        className="p-1 hover:text-blue-600 rounded-md"
                        title="Copy Text"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedId === item.id ? "check" : "content_copy"}
                        </span>
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        disabled={deletingId === item.id}
                        className="p-1 hover:text-red-600 rounded-md"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Preview Pane */}
        {previewItem && (
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 border border-[var(--color-outline-variant)]/40 shadow-xs flex flex-col justify-between h-fit sticky top-24">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {previewItem.format_type}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">
                    {previewItem.prompt}
                  </h3>
                </div>

                <div className="flex items-center gap-2 relative">
                  {onSendToWorkspace && (
                    <button
                      onClick={() => onSendToWorkspace(previewItem.final_text)}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold border border-purple-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Send to Workspace Humanizer"
                    >
                      <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                      <span>Send to Workspace</span>
                    </button>
                  )}

                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Export Options"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Export</span>
                      <span className="material-symbols-outlined text-[14px]">expand_more</span>
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          onClick={() => { handlePrintPdf(previewItem); setShowExportMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-500">picture_as_pdf</span>
                          <span>Download PDF</span>
                        </button>
                        <button
                          onClick={() => { handleExportDoc(previewItem); setShowExportMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-blue-600">description</span>
                          <span>Export Word (.doc)</span>
                        </button>
                        <button
                          onClick={() => { handleExportMd(previewItem); setShowExportMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-purple-600">markdown</span>
                          <span>Export Markdown</span>
                        </button>
                        <button
                          onClick={() => { handleExportTxt(previewItem); setShowExportMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-gray-500">article</span>
                          <span>Plain Text (.txt)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs p-3 bg-gray-50 rounded-2xl mb-4">
                <div>
                  <span className="text-gray-400 block text-[10px]">Words</span>
                  <span className="font-bold text-gray-800">{previewItem.word_count}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Read Time</span>
                  <span className="font-bold text-gray-800">{previewItem.read_time}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Score / Burstiness</span>
                  <span className="font-bold text-emerald-600">{previewItem.ai_score}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Originality</span>
                  <span className="font-bold text-blue-600">{previewItem.plagiarism_originality}</span>
                </div>
              </div>

              {/* Original vs Humanized Toggle for Humanizer items */}
              {(previewItem as any).original_text && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <button
                    onClick={() => setShowOriginal(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !showOriginal
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Humanized Output
                  </button>
                  <button
                    onClick={() => setShowOriginal(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      showOriginal
                        ? "bg-gray-800 text-white shadow-2xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Original Input
                  </button>
                </div>
              )}

              {/* Content Prose */}
              <div className="prose prose-sm max-w-none text-gray-800 text-sm leading-relaxed max-h-[500px] overflow-y-auto pr-2 space-y-3">
                {showOriginal && (previewItem as any).original_text ? (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-700 italic space-y-2">
                    {(previewItem as any).original_text.split(/\n{2,}/).map((para: string, i: number) => (
                      <p key={i} className="mb-2 leading-relaxed">{para.trim()}</p>
                    ))}
                  </div>
                ) : (
                  previewItem.final_text.split(/\n{2,}/).map((para, i) => (
                    <p key={i} className="mb-3 leading-relaxed">{para.trim()}</p>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
