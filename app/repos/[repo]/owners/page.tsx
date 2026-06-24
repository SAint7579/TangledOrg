"use client";

import { Shell } from "@/components/layout/Shell";
import { Users } from "lucide-react";

export default function RepoOwnersPage({ params }: { params: { repo: string } }) {
  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: params.repo, href: `/repos/${params.repo}` },
        { label: "Code Owners" },
      ]}
    >
      <div className="max-w-4xl mx-auto text-center py-16">
        <Users size={40} className="text-zinc-700 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-zinc-200 mb-2">Code Owners</h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
          Code ownership records are stored as ATProto records
          (<code className="font-mono text-zinc-600">sh.tangled.governance.compliance.codeOwner</code>).
          Code owner management will be available here once you create ownership records.
        </p>
      </div>
    </Shell>
  );
}
