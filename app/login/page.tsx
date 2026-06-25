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
    <div
      className="min-h-screen flex items-center justify-center px-4 transition-colors duration-200"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <Shield size={22} className="text-[#a5b4fc]" strokeWidth={2} />
            <span
              className="text-xl font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              HSB
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Sign in with your AT Protocol identity
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="handle"
              className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5"
              style={{ color: "var(--text-muted)" }}
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
              className="w-full text-sm px-3 py-2.5 font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-[rgba(167,139,250,0.4)]"
              style={{
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              autoFocus
            />
            {error && (
              <p className="text-[#fca5a5] text-xs mt-1.5">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#8b5cf6] hover:bg-[#a78bfa] text-white text-sm font-medium py-2.5 transition-colors"
          >
            Sign in with Tangled
          </button>
        </form>

        <p
          className="text-center text-[11px] mt-6"
          style={{ color: "var(--text-muted)" }}
        >
          Uses ATProto OAuth. Your credentials go directly to your PDS.
        </p>
      </div>
    </div>
  );
}
