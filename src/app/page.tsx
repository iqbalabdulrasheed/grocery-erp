"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/auth";
import { db, User, logAction } from "@/services/db";
import { Lock, User as UserIcon, Sparkles, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load theme and check if already logged in
  useEffect(() => {
    const storedTheme = (localStorage.getItem("erp_theme") as "dark" | "light") || "dark";
    document.documentElement.setAttribute("data-theme", storedTheme);
    if (storedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const currentUser = auth.getCurrentUser();
    if (currentUser) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Simulate slight network delay for premium feel
      setTimeout(async () => {
        try {
          const loggedInUser = await auth.login(username, password);
          // Log user login in audit ledger
          await logAction(loggedInUser.id, loggedInUser.name, loggedInUser.role, `User Login`, `${loggedInUser.username} logged in`);
          router.push("/dashboard");
        } catch (err: any) {
          setError(err.message || "Invalid credentials");
          setLoading(false);
        }
      }, 800);
    } catch (err: any) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };



  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/20 dark:bg-blue-900/20 bg-blue-200/40 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/20 dark:bg-indigo-900/20 bg-indigo-200/40 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Zenvora Saudi Arabia ERP
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            ZENVORA <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">ERP</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
            Grocery Warehouse Management & Financial System (SAR)
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">Sign In</h2>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 text-sm mb-6 animate-fade-in">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-slate-400 dark:placeholder-gray-600"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-slate-400 dark:placeholder-gray-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Log In"
              )}
            </button>
          </form>
        </div>


      </div>
    </div>
  );
}
