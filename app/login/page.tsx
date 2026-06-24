"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { getLoginUrl } from "@/lib/api";

export default function LoginPage() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) {
      setError("Please enter your handle");
      return;
    }
    const full = trimmed.includes(".") ? trimmed : `${trimmed}.tngl.sh`;
    window.location.href = getLoginUrl(full);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <Shield size={20} className="text-blue-400" strokeWidth={2} />
            <span className="text-xl font-semibold text-zinc-100 tracking-tight">
              Tangled Org
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Sign in with your AT Protocol identity
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="handle"
              className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1.5"
            >
              Handle
            </label>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setError("");
              }}
              placeholder="yourname.tngl.sh"
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm px-3 py-2.5 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs mt-1.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 transition-colors"
          >
            Sign in with Tangled
          </button>
        </form>

        <p className="text-center text-[11px] text-zinc-700 mt-6">
          Uses ATProto OAuth. Your credentials go directly to your PDS.
        </p>
      </div>
    </div>
  );
}
