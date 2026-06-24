"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSessionToken } from "@/lib/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const session = searchParams.get("session");
    if (session) {
      setSessionToken(session);
      router.replace("/");
    } else {
      router.replace("/login");
    }
  }, [searchParams, router]);

  return (
    <div className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-zinc-500 text-sm font-mono">
        Signing in...
      </div>
    </div>
  );
}
