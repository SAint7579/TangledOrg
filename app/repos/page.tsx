"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchRepos } from "@/lib/api";


export default function ReposPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepos().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Repos" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const repos = data?.repos ?? [];

  return (
    <Shell breadcrumbs={[{ label: "Repos" }]}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Repositories</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {repos.length} repos tracked via AT Protocol
          </p>
        </div>

        <div className="space-y-2">
          {repos.map((repo: any, idx: number) => {
            const classification =
              repo.profile?.dataClassification ?? repo.dataClassification;
            const regulations =
              repo.profile?.applicableRegulations ?? repo.regulations ?? [];
            return (
              <Card key={repo.id ?? idx} padding={false}>
                <Link
                  href={`/repos/${repo.name ?? repo.slug}`}
                  className="flex items-start gap-4 p-4 hover:bg-zinc-800/20 transition-colors group rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span className="text-base font-semibold text-zinc-100 group-hover:text-white font-mono">
                        {repo.name}
                      </span>
                      {classification && (
                        <Badge variant="neutral" size="sm">
                          <span className="capitalize">{classification}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap mt-2">
                      {repo.knot && (
                        <span className="flex items-center gap-1">
                          <Shield size={11} className="text-zinc-600" />
                          {repo.knot}
                        </span>
                      )}
                      {repo.repoDid && (
                        <span className="font-mono text-[10px] text-zinc-600">
                          {repo.repoDid.substring(0, 24)}...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {regulations.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                        {regulations.map((reg: string) => (
                          <span
                            key={reg}
                            className="text-[9px] px-1.5 py-0.5 rounded font-mono border"
                            style={{
                              color: "var(--badge-default-text)",
                              backgroundColor: "var(--hover-bg)",
                              borderColor: "var(--badge-default-border)",
                            }}
                          >
                            {reg}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </Card>
            );
          })}

          {repos.length === 0 && (
            <Card className="py-12 text-center">
              <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No repos found.</p>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
