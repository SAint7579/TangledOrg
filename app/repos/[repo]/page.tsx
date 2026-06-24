"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Users, Lock, FileText, Settings, AlertCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { fetchRepos, fetchRepoProfile, fetchPolicies, fetchIncidents } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "compliance" | "policies";

const REGULATION_LABELS: Record<string, string> = {
  "iso-27001": "ISO 27001", gdpr: "GDPR", "eu-ai-act": "EU AI Act",
  soc2: "SOC 2", hipaa: "HIPAA", "pci-dss": "PCI-DSS",
};

export default function RepoDetailPage({ params }: { params: { repo: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>("compliance");
  const [repo, setRepo] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rkey = params.repo;
    Promise.all([
      fetchRepos(),
      fetchRepoProfile(rkey),
      fetchPolicies(),
      fetchIncidents(),
    ]).then(([reposData, profileData, policiesData, incidentsData]) => {
      const r = reposData?.repos?.find((r: any) => r.id === rkey);
      setRepo(r || { id: rkey, name: rkey, knot: "" });
      setProfile(profileData?.profile || null);
      setPolicies(policiesData?.policyPacks || []);
      setIncidents((incidentsData?.incidents || []).filter((i: any) => (i.repo || "").includes(rkey)));
      setLoading(false);
    });
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

  const openIssues = incidents.filter((i: any) => i.status !== "resolved");
  const boundPolicies = policies.filter((p: any) =>
    p.bindings?.some((b: any) => (b.repo || "").includes(repo.id))
  );

  const tabs: { id: Tab; label: string; icon: React.ElementType; external?: string; badge?: number }[] = [
    { id: "compliance", label: "Compliance Profile", icon: Shield },
    { id: "policies", label: "Bound Policies", icon: FileText },
  ];

  const externalLinks = [
    { label: "Issues", icon: AlertCircle, href: `/issues`, badge: openIssues.length },
    { label: "Settings", icon: Settings, href: `/repos/${repo.id}/settings` },
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
        </div>

        <div>
          <div className="flex gap-0 border-b border-zinc-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
            {externalLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px border-transparent text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Icon size={13} />
                  {link.label}
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1 py-px">{link.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-4">
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
