"use client";

import { Shell } from "@/components/layout/Shell";
import { Shield } from "lucide-react";

export default function PRPage({ params }: { params: { repo: string; pr: string } }) {
  return (
    <Shell breadcrumbs={[{ label: "Repos", href: "/repos" }, { label: params.repo, href: `/repos/${params.repo}` }, { label: `PR #${params.pr}` }]}>
      <div className="max-w-4xl mx-auto text-center py-16">
        <Shield size={40} className="text-zinc-700 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-zinc-200 mb-2">PR Compliance Assessment</h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
          PR assessments are created by the governance agent (Spindle) when a pull request is opened on Tangled.
          Once the agent analyzes the PR, the compliance panel with control evaluations, required approvals,
          and merge gate status will appear here.
        </p>
        <p className="text-xs text-zinc-600 mt-4 font-mono">
          sh.tangled.governance.compliance.prAssessment
        </p>
      </div>
    </Shell>
  );
}
