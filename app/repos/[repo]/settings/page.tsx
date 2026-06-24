"use client";

import { useState } from "react";
import { Save, Lock, Shield, Tag, FileText } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockRepos, mockPolicyPacks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { DataClassification, RiskTier } from "@/types";

const DATA_TYPES = ["PII", "PHI", "Financial", "Credentials", "ML Training Data"] as const;
type DataType = (typeof DATA_TYPES)[number];

const REGULATIONS = ["ISO 27001", "GDPR", "EU AI Act", "SOC 2", "HIPAA", "PCI-DSS"] as const;
type Regulation = (typeof REGULATIONS)[number];

const ENFORCEMENT_MODES = [
  { value: "advisory", label: "Advisory", description: "Policy checks run but do not block merge. Findings surfaced as comments." },
  { value: "soft", label: "Soft Enforce", description: "Warnings block merge until a maintainer explicitly overrides. Override is logged." },
  { value: "hard", label: "Hard Enforce", description: "Policy failures always block merge. No overrides permitted. Required approvals enforced." },
] as const;
type EnforcementMode = (typeof ENFORCEMENT_MODES)[number]["value"];

export default function RepoSettingsPage({ params }: { params: { repo: string } }) {
  const repo = mockRepos.find((r) => r.slug === params.repo) ?? mockRepos[0];
  const boundPacks = mockPolicyPacks.filter((p) => repo.policyPacks.includes(p.id));

  const [dataClassification, setDataClassification] = useState<DataClassification>(repo.dataClassification);
  const [riskTier, setRiskTier] = useState<RiskTier>(repo.riskTier);
  const [enforcementMode, setEnforcementMode] = useState<EnforcementMode>("hard");
  const [description, setDescription] = useState(repo.description);

  const initialDataTypes: DataType[] = repo.regulations.includes("GDPR") ? ["PII", "PHI"] : repo.regulations.includes("EU AI Act") ? ["ML Training Data"] : [];
  const [dataTypes, setDataTypes] = useState<Set<DataType>>(new Set(initialDataTypes));

  const initialRegulations: Set<Regulation> = new Set(repo.regulations as Regulation[]);
  const [regulations, setRegulations] = useState<Set<Regulation>>(initialRegulations);

  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleDataType(dt: DataType) {
    setDataTypes((prev) => {
      const next = new Set(prev);
      if (next.has(dt)) next.delete(dt);
      else next.add(dt);
      return next;
    });
  }

  function toggleRegulation(reg: Regulation) {
    setRegulations((prev) => {
      const next = new Set(prev);
      if (next.has(reg)) next.delete(reg);
      else next.add(reg);
      return next;
    });
  }

  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: repo.name, href: `/repos/${repo.slug}` },
        { label: "Settings" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">
              <span className="font-mono">{repo.name}</span>
              <span className="text-zinc-500 font-normal"> — Governance Settings</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Configure compliance profile, data classification, and policy enforcement.</p>
          </div>
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all",
              saved
                ? "bg-green-600/30 text-green-300 border border-green-500/30"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            <Save size={14} />
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        {/* Compliance Profile */}
        <Card>
          <CardHeader
            title="Compliance Profile"
            description="Set the data classification and regulatory scope for this repository."
            action={<Lock size={14} className="text-zinc-500" />}
          />
          <div className="space-y-5">
            {/* Data Classification */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                <Lock size={11} className="text-zinc-500" /> Data Classification
              </label>
              <select
                value={dataClassification}
                onChange={(e) => setDataClassification(e.target.value as DataClassification)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="public">Public — No restrictions</option>
                <option value="internal">Internal — Company use only</option>
                <option value="confidential">Confidential — Restricted access, business sensitive</option>
                <option value="restricted">Restricted — Highly sensitive, need-to-know access</option>
              </select>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                {dataClassification === "confidential" && "Confidential data requires encrypted storage and access logging."}
                {dataClassification === "restricted" && "Restricted data requires field-level encryption and DPO approval for access."}
                {dataClassification === "internal" && "Internal data requires authentication but no additional controls."}
                {dataClassification === "public" && "Public data has no additional compliance requirements."}
              </p>
            </div>

            {/* Data Types */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Data Types Handled</label>
              <div className="flex flex-wrap gap-2">
                {DATA_TYPES.map((dt) => (
                  <button
                    key={dt}
                    onClick={() => toggleDataType(dt)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                      dataTypes.has(dt)
                        ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                        : "bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:border-zinc-600"
                    )}
                  >
                    {dataTypes.has(dt) && <span className="mr-1">✓</span>}{dt}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Determines which policy controls are automatically applied.</p>
            </div>

            {/* Applicable Regulations */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Applicable Regulations</label>
              <div className="flex flex-wrap gap-2">
                {REGULATIONS.map((reg) => (
                  <button
                    key={reg}
                    onClick={() => toggleRegulation(reg)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                      regulations.has(reg)
                        ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                        : "bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:border-zinc-600"
                    )}
                  >
                    {regulations.has(reg) && <span className="mr-1">✓</span>}{reg}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Selected regulations determine which policy packs are recommended to bind.</p>
            </div>

            {/* Risk Tier */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                <Shield size={11} className="text-zinc-500" /> Risk Tier
              </label>
              <select
                value={riskTier}
                onChange={(e) => setRiskTier(e.target.value as RiskTier)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="critical">Critical — Core infrastructure, data store</option>
                <option value="high">High — Customer-facing, handles PII</option>
                <option value="medium">Medium — Internal tools, limited external exposure</option>
                <option value="low">Low — Dev tooling, no production data</option>
              </select>
            </div>

            {/* Enforcement Mode */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Enforcement Mode</label>
              <div className="space-y-2">
                {ENFORCEMENT_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all",
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

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-200 resize-none focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 placeholder:text-zinc-600"
                placeholder="Describe the purpose and compliance requirements of this repository..."
              />
            </div>
          </div>
        </Card>

        {/* Bound Policy Packs */}
        <Card>
          <CardHeader
            title="Bound Policy Packs"
            description={`${boundPacks.length} packs actively enforcing controls on this repository`}
            action={<Tag size={14} className="text-zinc-500" />}
          />
          <div className="space-y-2 mb-4">
            {boundPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-3 rounded-md bg-zinc-800/40 border border-zinc-800/60"
              >
                <div className="flex items-center gap-3">
                  <FileText size={13} className="text-zinc-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{pack.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{pack.controlCount} controls · v{pack.version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info" size="sm">{pack.framework}</Badge>
                  <button className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-700/40">
                    Configure
                  </button>
                  <button className="text-[10px] text-red-500/60 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10">
                    Unbind
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-zinc-700/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all text-sm">
            <span className="text-lg leading-none">+</span> Bind Pack
          </button>
        </Card>
      </div>
    </Shell>
  );
}
