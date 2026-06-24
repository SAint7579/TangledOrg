"use client";

import { useEffect, useState } from "react";
import { Save, Lock, Shield } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { fetchRepos, fetchRepoProfile, fetchOrgs, createRepoProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

const DATA_TYPES = [
  { value: "pii", label: "PII" },
  { value: "phi", label: "PHI" },
  { value: "financial", label: "Financial" },
  { value: "credentials", label: "Credentials" },
  { value: "ml-training-data", label: "ML Training Data" },
  { value: "public-data", label: "Public Data" },
];

const REGULATIONS = [
  { value: "iso-27001", label: "ISO 27001" },
  { value: "gdpr", label: "GDPR" },
  { value: "eu-ai-act", label: "EU AI Act" },
  { value: "soc2", label: "SOC 2" },
  { value: "hipaa", label: "HIPAA" },
  { value: "pci-dss", label: "PCI-DSS" },
];

const ENFORCEMENT_MODES = [
  { value: "advisory", label: "Advisory", description: "Policy checks run but do not block merge. Findings surfaced as comments." },
  { value: "soft", label: "Soft Enforce", description: "Warnings block merge until a maintainer explicitly overrides. Override is logged." },
  { value: "hard", label: "Hard Enforce", description: "Policy failures always block merge. No overrides permitted." },
];

export default function RepoSettingsPage({ params }: { params: { repo: string } }) {
  const [repo, setRepo] = useState<any>(null);
  const [orgUri, setOrgUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [dataClassification, setDataClassification] = useState("internal");
  const [riskTier, setRiskTier] = useState("medium");
  const [enforcementMode, setEnforcementMode] = useState("advisory");
  const [description, setDescription] = useState("");
  const [dataTypes, setDataTypes] = useState<Set<string>>(new Set());
  const [regulations, setRegulations] = useState<Set<string>>(new Set());

  useEffect(() => {
    const rkey = params.repo;
    Promise.all([
      fetchRepos(),
      fetchRepoProfile(rkey),
      fetchOrgs(),
    ]).then(([reposData, profileData, orgsData]) => {
      const r = reposData?.repos?.find((r: any) => r.id === rkey);
      setRepo(r || { id: rkey, name: rkey, uri: "" });

      if (orgsData?.organizations?.length) {
        setOrgUri(orgsData.organizations[0].uri);
      }

      if (profileData?.profile) {
        const p = profileData.profile;
        setDataClassification(p.dataClassification || "internal");
        setRiskTier(p.riskTier || "medium");
        setEnforcementMode(p.enforcementMode || "advisory");
        setDescription(p.description || "");
        setDataTypes(new Set(p.handlesData || []));
        setRegulations(new Set(p.applicableRegulations || []));
      }
      setLoading(false);
    });
  }, [params.repo]);

  async function handleSave() {
    if (!repo) return;
    setSaving(true);
    await createRepoProfile(repo.id, {
      repoUri: repo.uri,
      orgUri,
      dataClassification,
      handlesData: Array.from(dataTypes),
      applicableRegulations: Array.from(regulations),
      riskTier,
      enforcementMode,
      description: description || undefined,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleItem(set: Set<string>, item: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setter(next);
  }

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Repos", href: "/repos" }, { label: params.repo }, { label: "Settings" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: repo?.name || params.repo, href: `/repos/${params.repo}` },
        { label: "Settings" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">
              <span className="font-mono">{repo?.name}</span>
              <span className="text-zinc-500 font-normal"> — Governance Settings</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Configure compliance profile, data classification, and policy enforcement.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all",
              saved
                ? "bg-green-600/30 text-green-300 border border-green-500/30"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            <Save size={14} />
            {saving ? "Saving..." : saved ? "Saved!" : "Save to PDS"}
          </button>
        </div>

        <Card>
          <CardHeader
            title="Compliance Profile"
            description="This data is stored as an ATProto record on your PDS."
            action={<Lock size={14} className="text-zinc-500" />}
          />
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                <Lock size={11} className="text-zinc-500" /> Data Classification
              </label>
              <select
                value={dataClassification}
                onChange={(e) => setDataClassification(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="public">Public — No restrictions</option>
                <option value="internal">Internal — Company use only</option>
                <option value="confidential">Confidential — Restricted access, business sensitive</option>
                <option value="restricted">Restricted — Highly sensitive, need-to-know access</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Data Types Handled</label>
              <div className="flex flex-wrap gap-2">
                {DATA_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    onClick={() => toggleItem(dataTypes, dt.value, setDataTypes)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium border transition-all",
                      dataTypes.has(dt.value)
                        ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                        : "bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:border-zinc-600"
                    )}
                  >
                    {dataTypes.has(dt.value) && <span className="mr-1">✓</span>}{dt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Applicable Regulations</label>
              <div className="flex flex-wrap gap-2">
                {REGULATIONS.map((reg) => (
                  <button
                    key={reg.value}
                    onClick={() => toggleItem(regulations, reg.value, setRegulations)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium border transition-all",
                      regulations.has(reg.value)
                        ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                        : "bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:border-zinc-600"
                    )}
                  >
                    {regulations.has(reg.value) && <span className="mr-1">✓</span>}{reg.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                <Shield size={11} className="text-zinc-500" /> Risk Tier
              </label>
              <select
                value={riskTier}
                onChange={(e) => setRiskTier(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="critical">Critical — Core infrastructure, data store</option>
                <option value="high">High — Customer-facing, handles PII</option>
                <option value="medium">Medium — Internal tools, limited exposure</option>
                <option value="low">Low — Dev tooling, no production data</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Enforcement Mode</label>
              <div className="space-y-2">
                {ENFORCEMENT_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className={cn(
                      "flex items-start gap-3 p-3 border cursor-pointer transition-all",
                      enforcementMode === mode.value
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-zinc-800/30 border-zinc-800/60 hover:border-zinc-700"
                    )}
                  >
                    <input
                      type="radio"
                      name="enforcement"
                      value={mode.value}
                      checked={enforcementMode === mode.value}
                      onChange={() => setEnforcementMode(mode.value)}
                      className="mt-0.5 accent-blue-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{mode.label}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{mode.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-sm text-zinc-200 resize-none focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 placeholder:text-zinc-600"
                placeholder="Describe the compliance requirements of this repository..."
              />
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
