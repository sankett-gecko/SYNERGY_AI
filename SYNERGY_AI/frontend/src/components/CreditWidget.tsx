"use client";

import React, { useState } from "react";
import { CreditInfo } from "@/lib/api";

interface CreditWidgetProps {
  creditInfo: CreditInfo | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

export default function CreditWidget({
  creditInfo,
  isLoading = false,
  onRefresh,
  compact = false,
}: CreditWidgetProps) {
  const [showDetails, setShowDetails] = useState(false);

  const dailyLimit = creditInfo?.daily_limit ?? 50;
  const used = creditInfo?.used_credits ?? 0;
  const remaining = creditInfo?.remaining_credits ?? dailyLimit;
  const percentRemaining = Math.max(0, Math.min(100, (remaining / dailyLimit) * 100));

  // Color mapping based on credits remaining
  const getStatusColor = () => {
    if (percentRemaining > 40) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (percentRemaining > 15) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getProgressColor = () => {
    if (percentRemaining > 40) return "bg-emerald-500";
    if (percentRemaining > 15) return "bg-amber-500";
    return "bg-red-500";
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all hover:shadow-xs ${getStatusColor()}`}
          title="Daily Generation Credits (Used & Remaining)"
        >
          <span className="material-symbols-outlined text-[16px] animate-pulse">toll</span>
          <span>
            <strong className="font-bold">{used} Used</strong> &bull; {remaining} Left
          </span>
          <span className="material-symbols-outlined text-[14px]">
            {showDetails ? "expand_less" : "expand_more"}
          </span>
        </button>

        {showDetails && (
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[var(--color-outline-variant)]/40 p-4 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">account_balance_wallet</span>
                Credit Balance
              </span>
              {onRefresh && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                  title="Refresh Balance"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isLoading ? "animate-spin" : ""}`}>
                    refresh
                  </span>
                </button>
              )}
            </div>

            <div className="py-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Daily Limit: <strong className="text-gray-700">{dailyLimit}</strong></span>
                <span>Used Today: <strong className="text-blue-600 font-bold">{used}</strong></span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                  style={{ width: `${percentRemaining}%` }}
                />
              </div>
              <div className="mt-2 text-center text-xs font-bold text-gray-800">
                {remaining} Credits Remaining Today
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>4-Agent Generation:</span>
                <span className="font-semibold text-gray-700">2 credits</span>
              </div>
              <div className="flex justify-between">
                <span>Humanizer (Easy):</span>
                <span className="font-semibold text-gray-700">1 credit</span>
              </div>
              <div className="flex justify-between">
                <span>Humanizer (Medium):</span>
                <span className="font-semibold text-gray-700">2 credits</span>
              </div>
              <div className="flex justify-between">
                <span>Humanizer (Maximum):</span>
                <span className="font-semibold text-gray-700">3 credits</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-50">
                <span>Reset Schedule:</span>
                <span className="font-semibold text-blue-600">Daily (Midnight UTC)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-[var(--color-outline-variant)]/40 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 right-0 w-36 h-36 bg-blue-50/50 rounded-full -mr-12 -mt-12 pointer-events-none" />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px]">toll</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Daily Credit Allowance</h3>
            <p className="text-xs text-gray-500">Resets daily at 00:00 UTC</p>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-gray-400 hover:text-blue-600 p-2 rounded-xl hover:bg-gray-50 transition-colors"
            title="Refresh credits"
          >
            <span className={`material-symbols-outlined text-[20px] ${isLoading ? "animate-spin text-blue-600" : ""}`}>
              refresh
            </span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-extrabold text-gray-900">
            {remaining} <span className="text-sm font-normal text-gray-500">/ {dailyLimit} remaining</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {used} Used Today
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-bold border ${getStatusColor()}`}>
              {Math.round(percentRemaining)}% Available
            </span>
          </div>
        </div>

        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${percentRemaining}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100">
            <span className="text-blue-500 block text-[11px] font-semibold">Used Today</span>
            <span className="font-extrabold text-blue-700 text-lg">{used} Credits</span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 block text-[11px] font-medium">Easy Humanize</span>
            <span className="font-bold text-emerald-600 text-base">1 Credit</span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 block text-[11px] font-medium">Medium Humanize</span>
            <span className="font-bold text-blue-600 text-base">2 Credits</span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 block text-[11px] font-medium">Maximum Humanize</span>
            <span className="font-bold text-purple-600 text-base">3 Credits</span>
          </div>
        </div>
      </div>
    </div>
  );
}
