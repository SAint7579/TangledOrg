"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";

export default function RepoIssuesPage({ params }: { params: { repo: string } }) {
  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: params.repo, href: `/repos/${params.repo}` },
        { label: "Issues" },
      ]}
    >
      <div className="max-w-4xl mx-auto text-center py-16">
        <AlertCircle size={40} className="text-zinc-700 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-zinc-200 mb-2">Repo Issues</h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed mb-4">
          View all compliance incidents across repos from the global Issues page.
        </p>
        <Link href="/issues" className="text-xs text-blue-400 hover:text-blue-300">
          Go to Issues
        </Link>
      </div>
    </Shell>
  );
}
