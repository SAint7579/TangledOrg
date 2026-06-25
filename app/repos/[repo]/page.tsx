"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield, Lock, FileText, Settings, AlertCircle,
  Code2, GitPullRequest, Folder, File, ChevronRight, ChevronDown,
  ScanSearch, Loader2, CheckCircle2, XCircle, AlertTriangle, Clock,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import {
  fetchRepos, fetchRepoProfile, fetchPolicies, fetchIncidents,
  fetchRepoIssues, fetchRepoPulls, fetchRepoTree, runScan, fetchRepoScans,
  fetchPRAssessment,
} from "@/lib/api";
import type { ScanResult, ScanHistoryItem, PRAssessmentResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "code" | "issues" | "pulls" | "compliance" | "policies" | "scan";

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
  const [expandedPRId, setExpandedPRId] = useState<string | null>(null);
  const [prAssessments, setPrAssessments] = useState<Record<string, PRAssessmentResponse>>({});
  const [prAssessmentLoading, setPrAssessmentLoading] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);

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

  const handleExpandPR = useCallback(async (prId: string) => {
    if (expandedPRId === prId) {
      setExpandedPRId(null);
      return;
    }
    setExpandedPRId(prId);
    if (!prAssessments[prId]) {
      setPrAssessmentLoading(prId);
      const data = await fetchPRAssessment(params.repo, prId);
      if (data) {
        setPrAssessments((prev) => ({ ...prev, [prId]: data }));
      }
      setPrAssessmentLoading(null);
    }
  }, [expandedPRId, prAssessments, params.repo]);

  const loadScanHistory = useCallback(() => {
    fetchRepoScans(params.repo).then((data) => {
      setScanHistory(data?.scans || []);
    });
  }, [params.repo]);

  useEffect(() => {
    if (activeTab === "scan") loadScanHistory();
  }, [activeTab, loadScanHistory]);

  const handleScan = useCallback(async () => {
    setScanRunning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = await runScan(params.repo);
      if (!result) {
        setScanError("Scan failed. The agent may not be configured.");
        return;
      }
      if (result.error && !result.findings?.length) {
        setScanError(result.error);
        return;
      }
      setScanResult(result);
      loadScanHistory();
      if (result.issues_created?.length) {
        fetchRepoIssues(params.repo).then((data) => setIssues(data?.issues || []));
      }
    } catch (err: any) {
      setScanError(err?.message || "Unknown error");
    } finally {
      setScanRunning(false);
    }
  }, [params.repo]);

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
    { id: "scan", label: "Code Review", icon: ScanSearch, badge: scanResult?.findings?.length },
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
                    const isExpanded = expandedPRId === pr.id;
                    const assessment = prAssessments[pr.id];
                    const isLoadingAssessment = prAssessmentLoading === pr.id;

                    return (
                      <div key={pr.id} className="border border-zinc-800 rounded overflow-hidden">
                        <button
                          onClick={() => handleExpandPR(pr.id)}
                          className="w-full text-left px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {isExpanded ? (
                              <ChevronDown size={14} className="mt-0.5 text-zinc-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="mt-0.5 text-zinc-500 flex-shrink-0" />
                            )}
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
                                {assessment?.gate && (
                                  <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase",
                                    assessment.gate.status === "pass" ? "bg-green-500/10 text-green-400" :
                                    assessment.gate.status === "warning" ? "bg-yellow-500/10 text-yellow-400" :
                                    assessment.gate.status === "blocked" ? "bg-red-500/10 text-red-400" :
                                    "bg-orange-500/10 text-orange-400"
                                  )}>
                                    {assessment.gate.status}
                                  </span>
                                )}
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
                        </button>

                        {isExpanded && (
                          <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-4">
                            {isLoadingAssessment && (
                              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                                <Loader2 size={12} className="animate-spin" />
                                Loading assessment...
                              </div>
                            )}

                            {!isLoadingAssessment && (!assessment || !assessment.assessment) && (
                              <p className="text-xs text-zinc-600">No compliance assessment found for this PR.</p>
                            )}

                            {!isLoadingAssessment && assessment?.assessment && (
                              <div className="space-y-4">
                                {/* Risk + Summary */}
                                <div className="flex items-start gap-3">
                                  <RiskBadge tier={assessment.assessment.riskLevel as any} size="sm" />
                                  <p className="text-sm text-zinc-300 flex-1">{assessment.assessment.summary}</p>
                                </div>

                                {/* Gate verdict */}
                                {assessment.gate && (
                                  <div className={cn(
                                    "px-3 py-2 rounded border text-xs",
                                    assessment.gate.status === "pass" ? "bg-green-950/30 border-green-900/30 text-green-300" :
                                    assessment.gate.status === "warning" ? "bg-yellow-950/30 border-yellow-900/30 text-yellow-300" :
                                    assessment.gate.status === "blocked" ? "bg-red-950/30 border-red-900/30 text-red-300" :
                                    "bg-orange-950/30 border-orange-900/30 text-orange-300"
                                  )}>
                                    <span className="font-semibold uppercase">{assessment.gate.status}</span>
                                    {assessment.gate.reason && (
                                      <span className="ml-2 opacity-80">— {assessment.gate.reason}</span>
                                    )}
                                  </div>
                                )}

                                {/* Control stats */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="flex items-center gap-2 p-2 bg-green-950/30 border border-green-900/30 rounded">
                                    <CheckCircle2 size={13} className="text-green-400" />
                                    <div>
                                      <p className="text-sm font-bold text-green-400">{assessment.assessment.controlsPassed}</p>
                                      <p className="text-[9px] text-zinc-500">Passed</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 bg-yellow-950/30 border border-yellow-900/30 rounded">
                                    <AlertTriangle size={13} className="text-yellow-400" />
                                    <div>
                                      <p className="text-sm font-bold text-yellow-400">{assessment.assessment.controlsWarning}</p>
                                      <p className="text-[9px] text-zinc-500">Warnings</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 p-2 bg-red-950/30 border border-red-900/30 rounded">
                                    <XCircle size={13} className="text-red-400" />
                                    <div>
                                      <p className="text-sm font-bold text-red-400">{assessment.assessment.controlsFailed}</p>
                                      <p className="text-[9px] text-zinc-500">Failed</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Control evaluations */}
                                {assessment.controlEvaluations.length > 0 && (
                                  <div className="space-y-1">
                                    <h4 className="text-xs text-zinc-500">Control Evaluations</h4>
                                    <div className="divide-y divide-zinc-800/60">
                                      {assessment.controlEvaluations.map((ev) => (
                                        <div key={ev.id} className="flex items-start gap-2 py-1.5">
                                          {ev.status === "pass" ? (
                                            <CheckCircle2 size={11} className="text-green-400 mt-0.5 flex-shrink-0" />
                                          ) : ev.status === "fail" ? (
                                            <XCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                                          ) : (
                                            <AlertTriangle size={11} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-mono text-zinc-400">{ev.control}</span>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">{ev.reason}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Downstream impact */}
                                {assessment.impact && assessment.impact.affectedEdges.length > 0 && (
                                  <div className="space-y-1">
                                    <h4 className="text-xs text-zinc-500">
                                      Downstream Impact ({assessment.impact.affectedEdges.length} repo{assessment.impact.affectedEdges.length > 1 ? "s" : ""})
                                    </h4>
                                    <div className="divide-y divide-zinc-800/60">
                                      {assessment.impact.affectedEdges.map((edge, i) => (
                                        <div key={i} className="py-1.5">
                                          <div className="flex items-center gap-2">
                                            <AlertTriangle size={10} className="text-orange-400" />
                                            <span className="text-xs font-mono text-orange-300">{edge.downstreamRepo}</span>
                                            {edge.downstreamPath && (
                                              <span className="text-[10px] text-zinc-500 font-mono">:{edge.downstreamPath}</span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-zinc-600 mt-0.5 pl-5">{edge.reason}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <p className="text-[10px] text-zinc-700">
                                  {assessment.assessment.changedFiles} files changed &middot; assessed {assessment.assessment.createdAt ? new Date(assessment.assessment.createdAt).toLocaleString() : ""}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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

            {/* ── Scan / Code Review Tab ─────────────────────────── */}
            {activeTab === "scan" && (
              <div className="space-y-4">
                {/* Header with scan button */}
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">AI Compliance Code Review</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Scans source files against bound policy controls and raises issues for violations.
                      </p>
                    </div>
                    <button
                      onClick={handleScan}
                      disabled={scanRunning}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors",
                        scanRunning
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                      )}
                    >
                      {scanRunning ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <ScanSearch size={14} />
                          Run Scan
                        </>
                      )}
                    </button>
                  </div>
                </Card>

                {/* Error */}
                {scanError && (
                  <Card className="border-red-900/50">
                    <div className="flex items-start gap-3">
                      <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400">Scan Failed</p>
                        <p className="text-xs text-zinc-400 mt-1">{scanError}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Running indicator */}
                {scanRunning && (
                  <Card>
                    <div className="flex flex-col items-center py-8 gap-3">
                      <Loader2 size={32} className="text-blue-400 animate-spin" />
                      <p className="text-sm text-zinc-400">Reading files and evaluating against policies...</p>
                      <p className="text-xs text-zinc-600">This may take 30-60 seconds depending on the repo size.</p>
                    </div>
                  </Card>
                )}

                {/* Results */}
                {scanResult && !scanRunning && (
                  <>
                    {/* Summary card */}
                    <Card>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-zinc-200">Scan Results</h3>
                          <div className="flex items-center gap-2">
                            <RiskBadge tier={scanResult.risk_level as any} />
                            <span className="text-xs text-zinc-500">
                              {scanResult.files_scanned} files scanned in {(scanResult.duration_ms / 1000).toFixed(1)}s
                            </span>
                          </div>
                        </div>
                        {scanResult.policy_pack && (
                          <p className="text-xs text-zinc-500">
                            Policy: <span className="text-zinc-400">{scanResult.policy_pack}</span>
                          </p>
                        )}
                        <p className="text-sm text-zinc-300">{scanResult.summary}</p>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex items-center gap-2 p-2.5 bg-green-950/30 border border-green-900/30 rounded">
                            <CheckCircle2 size={14} className="text-green-400" />
                            <div>
                              <p className="text-lg font-bold text-green-400">{scanResult.controls_passed}</p>
                              <p className="text-[10px] text-zinc-500">Passed</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2.5 bg-yellow-950/30 border border-yellow-900/30 rounded">
                            <AlertTriangle size={14} className="text-yellow-400" />
                            <div>
                              <p className="text-lg font-bold text-yellow-400">{scanResult.controls_warning}</p>
                              <p className="text-[10px] text-zinc-500">Warnings</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2.5 bg-red-950/30 border border-red-900/30 rounded">
                            <XCircle size={14} className="text-red-400" />
                            <div>
                              <p className="text-lg font-bold text-red-400">{scanResult.controls_failed}</p>
                              <p className="text-[10px] text-zinc-500">Failed</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Findings list */}
                    {scanResult.findings.length > 0 && (
                      <Card>
                        <CardHeader
                          title={`Findings (${scanResult.findings.length})`}
                          description="Issues auto-created for each finding"
                        />
                        <div className="divide-y divide-zinc-800/60">
                          {scanResult.findings.map((finding, idx) => {
                            const sevColor = {
                              critical: "text-red-400 bg-red-950/40 border-red-900/40",
                              high: "text-orange-400 bg-orange-950/40 border-orange-900/40",
                              medium: "text-yellow-400 bg-yellow-950/40 border-yellow-900/40",
                              low: "text-blue-400 bg-blue-950/40 border-blue-900/40",
                            }[finding.severity] || "text-zinc-400 bg-zinc-800/40 border-zinc-700/40";

                            return (
                              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                                <div className="flex items-start gap-3">
                                  <span className={cn("px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border", sevColor)}>
                                    {finding.severity}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-200">{finding.title}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                                      {finding.file}
                                      {finding.line ? `:${finding.line}` : ""}
                                      <span className="ml-2 text-zinc-600">{finding.control_id}</span>
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{finding.description}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    )}

                    {/* Issues created */}
                    {scanResult.issues_created.length > 0 && (
                      <Card>
                        <CardHeader
                          title={`Issues Created (${scanResult.issues_created.length})`}
                          description="Click Issues tab to see all open issues"
                        />
                        <div className="space-y-1">
                          {scanResult.issues_created.map((iss, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-800/30 rounded text-xs">
                              <AlertCircle size={12} className="text-yellow-400 flex-shrink-0" />
                              <span className="text-zinc-300 truncate">{iss.title}</span>
                              <Badge size="sm" variant={
                                iss.severity === "critical" ? "danger"
                                  : iss.severity === "high" ? "warning"
                                  : "neutral"
                              }>
                                {iss.severity}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {scanResult.error && (
                      <Card className="border-yellow-900/50">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-zinc-400">{scanResult.error}</p>
                        </div>
                      </Card>
                    )}
                  </>
                )}

                {/* Empty state (no current result and no history) */}
                {!scanResult && !scanRunning && !scanError && scanHistory.length === 0 && (
                  <Card>
                    <div className="text-center py-12">
                      <ScanSearch size={40} className="text-zinc-700 mx-auto mb-4" />
                      <p className="text-sm text-zinc-400">
                        Run a compliance scan to check this repo&apos;s code against its bound policy controls.
                      </p>
                      <p className="text-xs text-zinc-600 mt-2">
                        The AI will read source files, evaluate them against each control, and create issues for violations.
                      </p>
                    </div>
                  </Card>
                )}

                {/* Scan history */}
                {scanHistory.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <Clock size={13} />
                      Scan History ({scanHistory.length})
                    </h3>
                    {scanHistory.map((scan) => {
                      const isExpanded = expandedScanId === scan.id;
                      const date = scan.createdAt
                        ? new Date(scan.createdAt).toLocaleString()
                        : "Unknown date";

                      return (
                        <div key={scan.id} className="border border-zinc-800 rounded overflow-hidden">
                          <button
                            onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-zinc-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-zinc-500 flex-shrink-0" />
                            )}
                            <RiskBadge tier={scan.riskLevel as any} size="sm" />
                            <span className="text-xs text-zinc-300 flex-1 truncate">
                              {scan.findingsCount} findings &middot; {scan.filesScanned} files scanned
                            </span>
                            <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0">
                              {date}
                            </span>
                            {scan.durationMs && (
                              <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">
                                {(scan.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-4 space-y-4">
                              {/* Summary */}
                              <div>
                                <p className="text-xs text-zinc-500 mb-1">Policy: {scan.policyPack}</p>
                                <p className="text-sm text-zinc-300">{scan.summary}</p>
                              </div>

                              {/* Stats */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="flex items-center gap-2 p-2 bg-green-950/30 border border-green-900/30 rounded">
                                  <CheckCircle2 size={13} className="text-green-400" />
                                  <div>
                                    <p className="text-sm font-bold text-green-400">{scan.controlsPassed}</p>
                                    <p className="text-[9px] text-zinc-500">Passed</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-yellow-950/30 border border-yellow-900/30 rounded">
                                  <AlertTriangle size={13} className="text-yellow-400" />
                                  <div>
                                    <p className="text-sm font-bold text-yellow-400">{scan.controlsWarning}</p>
                                    <p className="text-[9px] text-zinc-500">Warnings</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-red-950/30 border border-red-900/30 rounded">
                                  <XCircle size={13} className="text-red-400" />
                                  <div>
                                    <p className="text-sm font-bold text-red-400">{scan.controlsFailed}</p>
                                    <p className="text-[9px] text-zinc-500">Failed</p>
                                  </div>
                                </div>
                              </div>

                              {/* Findings */}
                              {scan.findings && scan.findings.length > 0 && (
                                <div className="divide-y divide-zinc-800/60">
                                  {scan.findings.map((f, fi) => {
                                    const sevColor = {
                                      critical: "text-red-400",
                                      high: "text-orange-400",
                                      medium: "text-yellow-400",
                                      low: "text-blue-400",
                                    }[f.severity] || "text-zinc-400";

                                    return (
                                      <div key={fi} className="py-2 first:pt-0 last:pb-0">
                                        <div className="flex items-start gap-2">
                                          <span className={cn("text-[10px] font-bold uppercase", sevColor)}>
                                            {f.severity}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-zinc-200">{f.title}</p>
                                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                              {f.file}{f.line ? `:${f.line}` : ""}
                                              <span className="ml-2 text-zinc-600">{f.control_id}</span>
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {scan.issuesCreated > 0 && (
                                <p className="text-[10px] text-zinc-600">
                                  {scan.issuesCreated} issues auto-created
                                </p>
                              )}

                              {scan.error && (
                                <p className="text-xs text-yellow-400/70">{scan.error}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
