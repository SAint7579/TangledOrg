"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Shield, ScanLine, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchRepos, fetchDashboard, runScan, fetchTaskStatus } from "@/lib/api";

export default function ReposPage() {
  const [repos, setRepos] = useState<any[]>([]);
  const [scanCounts, setScanCounts] = useState<Record<string, number>>({});
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const [scanDone, setScanDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [reposRes, dashRes] = await Promise.all([fetchRepos(), fetchDashboard()]);
    setRepos(reposRes?.repos ?? []);
    // Build rkey → scanCount map from dashboard stats
    const counts: Record<string, number> = {};
    for (const stat of dashRes?.repoStats ?? []) {
      counts[stat.rkey] = stat.scanCount;
    }
    setScanCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScan = async (e: React.MouseEvent, repoRkey: string) => {
    e.preventDefault();
    setScanning(p => ({ ...p, [repoRkey]: true }));
    const taskRes = await runScan(repoRkey);
    if (!taskRes?.taskId) {
      setScanning(p => ({ ...p, [repoRkey]: false }));
      return;
    }
    const poll = async () => {
      const status = await fetchTaskStatus(taskRes.taskId);
      if (!status || status.status === "completed") {
        setScanning(p => ({ ...p, [repoRkey]: false }));
        setScanDone(p => ({ ...p, [repoRkey]: true }));
        setScanCounts(p => ({ ...p, [repoRkey]: (p[repoRkey] ?? 0) + 1 }));
      } else if (status.status === "failed") {
        setScanning(p => ({ ...p, [repoRkey]: false }));
      } else {
        setTimeout(poll, 3000);
      }
    };
    setTimeout(poll, 2000);
  };

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Repos" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Loading…</span>
        </div>
      </Shell>
    );
  }

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
            const rkey = repo.name ?? repo.slug ?? repo.id;
            const classification = repo.profile?.dataClassification ?? repo.dataClassification;
            const regulations = repo.profile?.applicableRegulations ?? repo.regulations ?? [];
            const scans = scanCounts[rkey] ?? 0;
            const isScanning = scanning[rkey] ?? false;
            const justScanned = scanDone[rkey] ?? false;

            return (
              <Card key={repo.id ?? idx} padding={false}>
                <div className="flex items-center gap-4 p-4">
                  {/* Left: repo info — clicking navigates */}
                  <Link
                    href={`/repos/${rkey}`}
                    className="flex-1 min-w-0 group"
                  >
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span
                        className="text-base font-semibold font-mono group-hover:opacity-80 transition-opacity"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {repo.name}
                      </span>
                      {classification && (
                        <Badge variant="neutral" size="sm">
                          <span className="capitalize">{classification}</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs flex-wrap mt-1" style={{ color: "var(--text-muted)" }}>
                      {repo.knot && (
                        <span className="flex items-center gap-1">
                          <Shield size={11} />
                          {repo.knot}
                        </span>
                      )}
                      {repo.repoDid && (
                        <span className="font-mono text-[10px]">
                          {repo.repoDid.substring(0, 24)}…
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Right: regulations + scan status + scan button */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    {/* Regulations */}
                    {regulations.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end max-w-[180px]">
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

                    {/* Scan status indicator */}
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {justScanned ? (
                        <>
                          <CheckCircle2 size={12} style={{ color: "#86efac" }} />
                          <span style={{ color: "#86efac" }}>Scanned</span>
                        </>
                      ) : scans > 0 ? (
                        <>
                          <CheckCircle2 size={12} style={{ color: "#86efac" }} />
                          <span>{scans} scan{scans !== 1 ? "s" : ""}</span>
                        </>
                      ) : (
                        <>
                          <Clock size={12} style={{ color: "#fde68a" }} />
                          <span style={{ color: "#fde68a" }}>Never scanned</span>
                        </>
                      )}
                    </div>

                    {/* Scan button */}
                    <button
                      onClick={(e) => handleScan(e, rkey)}
                      disabled={isScanning}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded border transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: isScanning ? "var(--hover-bg)" : "transparent",
                        borderColor: isScanning ? "#818cf8" : "var(--border-subtle)",
                        color: isScanning ? "#a5b4fc" : "var(--text-secondary)",
                      }}
                      title="Run AI compliance scan"
                    >
                      {isScanning ? (
                        <Loader2 size={12} className="animate-spin" style={{ color: "#a5b4fc" }} />
                      ) : (
                        <ScanLine size={12} style={{ color: "#a5b4fc" }} />
                      )}
                      {isScanning ? "Scanning…" : "Scan"}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}

          {repos.length === 0 && (
            <Card className="py-12 text-center">
              <Shield size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No repos found.</p>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
