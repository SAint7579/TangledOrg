"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSessionToken } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();

  useEffect(() => {
    const session = searchParams.get("session");
    if (session) {
      setSessionToken(session);
      refresh().then(() => router.replace("/"));
    } else {
      router.replace("/login");
    }
  }, [searchParams, router, refresh]);

  return (
    <div className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-zinc-500 text-sm font-mono">
        Signing in...
      </div>
    </div>
  );
}
