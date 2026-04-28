"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function SignInPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  // Already signed in — send to the app
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-lg overflow-hidden">
        {/* Top stripe */}
        <div className="h-1.5 bg-linear-to-r from-indigo-500 via-violet-500 to-indigo-400" />

        <div className="px-8 pt-8 pb-10">
          {/* Logo / brand */}
          <div className="mb-8 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              EliseAI
            </span>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900 leading-tight">
              Lead Enrichment Tool
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in to save and access your enrichment history across sessions.
            </p>
          </div>

          {/* Feature highlights */}
          <ul className="mb-8 space-y-2.5">
            {[
              "Census Bureau renter + income data",
              "WalkScore walkability analysis",
              "Claude AI lead scoring & outreach drafts",
              "Persistent history across devices",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* Google sign-in */}
          <button
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 active:bg-zinc-100 transition-colors shadow-sm text-sm font-medium text-zinc-700"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p className="mt-5 text-center text-xs text-zinc-400">
            Your data is stored securely per account.
            <br />
            No password required.
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-zinc-400">
        Built with Census Bureau · WalkScore · Anthropic Claude
      </p>
    </div>
  );
}
