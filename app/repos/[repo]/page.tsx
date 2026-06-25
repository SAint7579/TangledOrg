"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield, Lock, FileText, Settings, AlertCircle,
  Code2, GitPullRequest, Folder, File, ChevronRight,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import {
  fetchRepos, fetchRepoProfile, fetchPolicies, fetchIncidents,
  fetchRepoIssues, fetchRepoPulls, fetchRepoTree,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "code" | "issues" | "pulls" | "compliance" | "policies";

const REGULATION_LABELS: Record<string, string> = {
  "iso-27001": "ISO 27001", gdpr: "GDPR", "eu-ai-act": "EU AI Act",
  soc2: "SOC 2", hipaa: "HIPAA", "pci-dss": "PCI-DSS",
};

function formatDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RepoDetailPage({ params }: { params: { repo: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>("code");
  const [repo, setRepo] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [pulls, setPulls] = useState<any[]>([]);
  const [treeEntries, setTreeEntries] = useState<any[]>([]);
  const [treePath, setTreePath] = useState("");
  const [treeLoading, setTreeLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rkey = params.repo;
    Promise.all([
      fetchRepos(),
      fetchRepoProfile(rkey),
      fetchPolicies(),
      fetchIncidents(),
      fetchRepoIssues(rkey),
      fetchRepoPulls(rkey),
    ]).then(([reposData, profileData, policiesData, incidentsData, issuesData, pullsData]) => {
      const r = reposData?.repos?.find((r: any) => r.id === rkey);
      setRepo(r || { id: rkey, name: rkey, knot: "" });
      setProfile(profileData?.profile || null);
      setPolicies(policiesData?.policyPacks || []);
      setIncidents((incidentsData?.incidents || []).filter((i: any) => (i.repo || "").includes(rkey)));
      setIssues(issuesData?.issues || []);
      setPulls(pullsData?.pulls || []);
      setLoading(false);
    });
  }, [params.repo]);

  const loadTree = useCallback((path: string) => {
    setTreeLoading(true);
    fetchRepoTree(params.repo, "main", path).then((data) => {
      const entries = (data as any)?.files || (data as any)?.entries || (data as any)?.tree || [];
      setTreeEntries(Array.isArray(entries) ? entries : []);
      setTreePath(path);
      setTreeLoading(false);
    });
  }, [params.repo]);

  useEffect(() => {
    if (!loading && activeTab === "code" && treeEntries.length === 0) {
      loadTree("");
    }
  }, [loading, activeTab, treeEntries.length, loadTree]);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Repos", href: "/repos" }, { label: params.repo }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const openIssues = issues.filter((i: any) => i.state === "open");
  const openPulls = pulls.filter((p: any) => p.status === "open");
  const boundPolicies = policies.filter((p: any) =>
    p.bindings?.some((b: any) => (b.repo || "").includes(repo.id))
  );

  const pathParts = treePath ? treePath.split("/") : [];

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "code", label: "Code", icon: Code2 },
    { id: "issues", label: "Issues", icon: AlertCircle, badge: openIssues.length },
    { id: "pulls", label: "Pull Requests", icon: GitPullRequest, badge: openPulls.length },
    { id: "compliance", label: "Compliance Profile", icon: Shield },
    { id: "policies", label: "Bound Policies", icon: FileText },
  ];

  return (
    <Shell breadcrumbs={[{ label: "Repos", href: "/repos" }, { label: repo.name }]}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-100 font-mono">{repo.name}</h1>
              {profile?.riskTier && <RiskBadge tier={profile.riskTier} />}
              {profile?.dataClassification && (
                <Badge variant="neutral" size="sm" className="capitalize">{profile.dataClassification}</Badge>
              )}
            </div>
            {profile?.description && <p className="text-sm text-zinc-400">{profile.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
              {repo.knot && <span className="font-mono">knot: {repo.knot}</span>}
              {repo.uri && <span className="font-mono text-zinc-600 text-[10px]">{repo.uri.substring(0, 32)}...</span>}
            </div>
          </div>
          <Link
            href={`/repos/${repo.id}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <Settings size={12} /> Settings
          </Link>
        </div>

        <div>
          <div className="flex gap-0 border-b border-zinc-800 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon size={13} />
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-px rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {/* ── Code Tab ─────────────────────────── */}
            {activeTab === "code" && (
              <Card padding={false}>
                {pathParts.length > 0 && (
                  <div className="flex items-center gap-1 px-4 py-2.5 border-b border-zinc-800 text-xs">
                    <button onClick={() => loadTree("")} className="text-blue-400 hover:text-blue-300 font-mono">
                      {repo.name}
                    </button>
                    {pathParts.map((part, i) => {
                      const subPath = pathParts.slice(0, i + 1).join("/");
                      const isLast = i === pathParts.length - 1;
                      return (
                        <span key={subPath} className="flex items-center gap-1">
                          <ChevronRight size={10} className="text-zinc-600" />
                          {isLast ? (
                            <span className="text-zinc-300 font-mono">{part}</span>
                          ) : (
                            <button onClick={() => loadTree(subPath)} className="text-blue-400 hover:text-blue-300 font-mono">
                              {part}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                {treeLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="text-zinc-500 text-sm animate-pulse">Loading tree...</span>
                  </div>
                ) : treeEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Code2 size={32} className="text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">No files found. The knot server may be unreachable.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60">
                    {[...treeEntries]
                      .sort((a, b) => {
                        const aDir = a.type === "tree" || (a.mode || "").includes("040000") ? 0 : 1;
                        const bDir = b.type === "tree" || (b.mode || "").includes("040000") ? 0 : 1;
                        if (aDir !== bDir) return aDir - bDir;
                        return (a.name || "").localeCompare(b.name || "");
                      })
                      .map((entry: any) => {
                        const isDir = entry.type === "tree" || (entry.mode || "").includes("040000");
                        const name = entry.name || entry.path || "";
                        const fullPath = treePath ? `${treePath}/${name}` : name;
                        return (
                          <button
                            key={name}
                            onClick={() => isDir && loadTree(fullPath)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2 w-full text-left hover:bg-zinc-800/40 transition-colors",
                              !isDir && "cursor-default"
                            )}
                          >
                            {isDir ? (
                              <Folder size={14} className="text-blue-400 flex-shrink-0" />
                            ) : (
                              <File size={14} className="text-zinc-500 flex-shrink-0" />
                            )}
                            <span className={cn("text-sm font-mono flex-1", isDir ? "text-blue-400" : "text-zinc-300")}>
                              {name}
                            </span>
                            {entry.size != null && !isDir && (
                              <span className="text-[10px] text-zinc-600 font-mono">{formatSize(entry.size)}</span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </Card>
            )}

            {/* ── Issues Tab ─────────────────────────── */}
            {activeTab === "issues" && (
              <div className="space-y-2">
                {issues.length === 0 ? (
                  <Card>
                    <div className="text-center py-8">
                      <AlertCircle size={32} className="text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No issues found for this repository.</p>
                    </div>
                  </Card>
                ) : (
                  issues.map((issue: any) => (
                    <Card key={issue.id} className="hover:border-zinc-700 transition-colors">
                      <div className="flex items-start gap-3">
                        <AlertCircle
                          size={16}
                          className={cn(
                            "mt-0.5 flex-shrink-0",
                            issue.state === "open" ? "text-green-400" : "text-zinc-600"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-zinc-200">{issue.title}</span>
                            <Badge
                              variant={issue.state === "open" ? "success" : "neutral"}
                              size="sm"
                            >
                              {issue.state}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            opened {formatDate(issue.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* ── Pull Requests Tab ─────────────────────────── */}
            {activeTab === "pulls" && (
              <div className="space-y-2">
                {pulls.length === 0 ? (
                  <Card>
                    <div className="text-center py-8">
                      <GitPullRequest size={32} className="text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No pull requests found for this repository.</p>
                    </div>
                  </Card>
                ) : (
                  pulls.map((pr: any) => {
                    const statusVariant = pr.status === "merged"
                      ? "info"
                      : pr.status === "open"
                        ? "success"
                        : "neutral";
                    return (
                      <Card key={pr.id} className="hover:border-zinc-700 transition-colors">
                        <div className="flex items-start gap-3">
                          <GitPullRequest
                            size={16}
                            className={cn(
                              "mt-0.5 flex-shrink-0",
                              pr.status === "merged" ? "text-purple-400"
                                : pr.status === "open" ? "text-green-400"
                                : "text-zinc-600"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-zinc-200">{pr.title}</span>
                              <Badge variant={statusVariant} size="sm">
                                {pr.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">
                              {pr.sourceBranch && pr.targetBranch && (
                                <span className="font-mono">
                                  {pr.sourceBranch}
                                  <span className="text-zinc-600 mx-1">&rarr;</span>
                                  {pr.targetBranch}
                                </span>
                              )}
                              {pr.createdAt && (
                                <span className="ml-2">{formatDate(pr.createdAt)}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Compliance Tab ─────────────────────────── */}
            {activeTab === "compliance" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile ? (
                  <>
                    <Card>
                      <CardHeader title="Compliance Profile" />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                          <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Lock size={11} /> Data Classification</span>
                          <Badge variant="neutral" className="capitalize">{profile.dataClassification}</Badge>
                        </div>
                        {profile.riskTier && (
                          <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                            <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Shield size={11} /> Risk Tier</span>
                            <RiskBadge tier={profile.riskTier} />
                          </div>
                        )}
                        {profile.enforcementMode && (
                          <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                            <span className="text-xs text-zinc-500">Enforcement</span>
                            <Badge variant="neutral" className="capitalize">{profile.enforcementMode}</Badge>
                          </div>
                        )}
                        {profile.handlesData?.length > 0 && (
                          <div className="flex items-start justify-between py-1.5 border-b border-zinc-800/50">
                            <span className="text-xs text-zinc-500">Data Types</span>
                            <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                              {profile.handlesData.map((dt: string) => (
                                <Badge key={dt} variant="neutral" size="sm">{dt}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {profile.applicableRegulations?.length > 0 && (
                          <div className="flex items-start justify-between py-1.5">
                            <span className="text-xs text-zinc-500">Regulations</span>
                            <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                              {profile.applicableRegulations.map((reg: string) => (
                                <Badge key={reg} variant="info" size="sm">{REGULATION_LABELS[reg] || reg}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                    <Card>
                      <CardHeader title="Bound Policy Packs" description={`${boundPolicies.length} packs bound`} />
                      {boundPolicies.length === 0 ? (
                        <p className="text-xs text-zinc-600">No policy packs bound. Go to Settings to bind one.</p>
                      ) : (
                        <div className="space-y-2">
                          {boundPolicies.map((pack: any) => (
                            <div key={pack.id} className="flex items-center justify-between p-2.5 bg-zinc-800/40 border border-zinc-800/60">
                              <div>
                                <p className="text-xs font-medium text-zinc-200">{pack.displayName || pack.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{pack.controlCount} controls</p>
                              </div>
                              {pack.framework && <Badge variant="info" size="sm">{REGULATION_LABELS[pack.framework] || pack.framework}</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </>
                ) : (
                  <Card className="md:col-span-2">
                    <div className="text-center py-8">
                      <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No compliance profile configured.</p>
                      <Link href={`/repos/${repo.id}/settings`} className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">
                        Configure in Settings
                      </Link>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── Policies Tab ─────────────────────────── */}
            {activeTab === "policies" && (
              <div className="space-y-3">
                {boundPolicies.length === 0 ? (
                  <Card>
                    <div className="text-center py-8">
                      <FileText size={32} className="text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No policy packs bound to this repo.</p>
                      <Link href="/policies" className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">
                        Browse Policy Packs
                      </Link>
                    </div>
                  </Card>
                ) : (
                  boundPolicies.map((pack: any) => (
                    <Card key={pack.id}>
                      <CardHeader
                        title={pack.displayName || pack.name}
                        description={pack.description}
                        action={pack.framework ? <Badge variant="info" size="sm">{REGULATION_LABELS[pack.framework] || pack.framework}</Badge> : undefined}
                      />
                      {pack.controls?.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {pack.controls.map((ctrl: any) => (
                            <div key={ctrl.controlId || ctrl.id} className="p-2 bg-zinc-800/40 border border-zinc-800/60">
                              <p className="text-[10px] font-medium text-zinc-200 leading-snug">{ctrl.name}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge size="sm" variant="neutral">{ctrl.checkType}</Badge>
                                <Badge size="sm" variant="neutral">{ctrl.enforcement}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
