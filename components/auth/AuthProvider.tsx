"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, type AuthUser } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = async () => {
    setLoading(true);
    const me = await fetchMe();
    setUser(me);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const publicPaths = ["/login", "/auth/callback"];
    if (!loading && !user && !publicPaths.includes(pathname)) {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-zinc-500 text-sm font-mono">
          Connecting...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
