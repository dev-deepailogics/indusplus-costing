import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PARAMETER_TABLES } from "@/lib/parameters/registry";

export default function ParametersIndexPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">POC Parameters</h1>
        <p className="text-sm text-muted-foreground">
          Select a parameter table to view and edit.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PARAMETER_TABLES.map((t) => (
          <Link
            key={t.slug}
            href={`/parameters/${t.slug}`}
            className="group flex items-center justify-between rounded-xl border bg-card p-4 text-sm font-medium shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
          >
            {t.title}
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
