"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchRepoIssues } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function RepoIssuesPage({ params }: { params: { repo: string } }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");

  useEffect(() => {
    fetchRepoIssues(params.repo).then((data) => {
      setIssues(data?.issues || []);
      setLoading(false);
    });
  }, [params.repo]);

  const filtered = filter === "all" ? issues : issues.filter((i) => i.state === filter);
  const openCount = issues.filter((i) => i.state === "open").length;
  const closedCount = issues.filter((i) => i.state === "closed").length;

  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: params.repo, href: `/repos/${params.repo}` },
        { label: "Issues" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100">Issues</h1>
          <div className="flex items-center gap-1 text-xs">
            {(["open", "closed", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 capitalize border transition-colors",
                  filter === f
                    ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                )}
              >
                {f}
                {f === "open" && ` (${openCount})`}
                {f === "closed" && ` (${closedCount})`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-zinc-500 text-sm animate-pulse">Loading issues...</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <AlertCircle size={36} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                {issues.length === 0
                  ? "No issues found for this repository."
                  : `No ${filter} issues.`}
              </p>
              <Link href={`/repos/${params.repo}`} className="text-xs text-blue-400 hover:text-blue-300 mt-3 inline-block">
                Back to repo
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((issue: any) => (
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
                    {issue.body && (
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{issue.body}</p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      opened {formatDate(issue.createdAt)}
                      {issue.mentions?.length > 0 && (
                        <span className="ml-2">&middot; {issue.mentions.length} mention{issue.mentions.length !== 1 ? "s" : ""}</span>
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
