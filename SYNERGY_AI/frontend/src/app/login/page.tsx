"use client";

import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // False = Sign In, True = Sign Up
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // If user is already authenticated, automatically redirect to dashboard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Translate cryptic Firebase error codes into human-friendly instructions
  const getFriendlyErrorMessage = (err: any): string => {
    const code = err?.code || "";
    const msg = err?.message || "";

    if (code.includes("invalid-credential") || code.includes("user-not-found")) {
      return isSignUp
        ? "Unable to create account. Please ensure the email format is correct."
        : "Invalid email or password. If you don't have an account yet, click 'Create Account' above.";
    }
    if (code.includes("wrong-password")) {
      return "Incorrect password. Please double check and try again.";
    }
    if (code.includes("email-already-in-use")) {
      return "An account with this email already exists. Please switch to the 'Sign In' tab.";
    }
    if (code.includes("weak-password")) {
      return "Password is too short. Please use at least 6 characters.";
    }
    if (code.includes("invalid-email")) {
      return "Please enter a valid email address (e.g., name@example.com).";
    }
    if (code.includes("too-many-requests")) {
      return "Too many failed attempts. Please wait a minute before trying again.";
    }
    if (code.includes("network-request-failed")) {
      return "Network connection issue. Please check your internet connection.";
    }
    return msg.replace(/^Firebase:\s*/, "") || "Authentication failed. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Creates a new account in Firebase
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        setSuccessMsg("Account created successfully! Redirecting...");
      } else {
        // Logs in with existing credentials
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setSuccessMsg("Signed in successfully! Redirecting...");
      }
      setTimeout(() => router.push("/dashboard"), 400);
    } catch (err: any) {
      console.error("Firebase auth error:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/50 p-4 selection:bg-blue-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all">
        {/* Brand Header */}
        <div className="pt-8 pb-6 px-8 text-center border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md mb-3">
            <span className="material-symbols-outlined text-[26px]">auto_awesome</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            Synergy AI
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Enterprise Multi-Agent Platform & Humanizer
          </p>

          {/* Segmented Sign In / Sign Up Switcher */}
          <div className="grid grid-cols-2 bg-gray-100/80 p-1 rounded-2xl mt-5 gap-1">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(""); setSuccessMsg(""); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                !isSignUp
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(""); setSuccessMsg(""); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                isSignUp
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0 mt-0.5">error</span>
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-emerald-500 shrink-0 mt-0.5">check_circle</span>
              <div className="flex-1 font-medium leading-relaxed">{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-gray-400">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Password {isSignUp && <span className="text-gray-400 font-normal">(min 6 characters)</span>}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-gray-400">
                  lock
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-3 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>{isSignUp ? "Creating Account..." : "Signing In..."}</span>
                </>
              ) : isSignUp ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">login</span>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Informational security footer */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-emerald-500">verified_user</span>
              <span>Secured by Firebase Authentication</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}