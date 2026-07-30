"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { getParameterDef } from "@/lib/parameters/registry";
import { saveTable, subscribeToTable } from "@/lib/parameters/firestore";
import type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "@/lib/parameters/types";
import { MatrixTableEditor } from "@/components/parameters/matrix-table-editor";
import { ProcessMatrixEditor } from "@/components/parameters/process-matrix-editor";
import { SimpleTableEditor } from "@/components/parameters/simple-table-editor";
import { DropdownListsEditor } from "@/components/parameters/dropdown-lists-editor";

export default function ParameterTablePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const def = getParameterDef(slug);

  if (!def) notFound();

  return <ParameterTable key={slug} slug={slug} def={def} />;
}

function ParameterTable({
  slug,
  def,
}: {
  slug: string;
  def: NonNullable<ReturnType<typeof getParameterDef>>;
}) {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    return subscribeToTable(slug, setData);
  }, [slug]);

  const notReady = data === null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {notReady ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : def.kind === "matrix" ? (
          <MatrixTableEditor
            data={data as MatrixTableData}
            onSave={(next) => saveTable(slug, next)}
          />
        ) : def.kind === "process-matrix" ? (
          <ProcessMatrixEditor
            data={data as ProcessMatrixTableData}
            onSave={(next) => saveTable(slug, next)}
          />
        ) : def.kind === "dropdown-lists" ? (
          <DropdownListsEditor
            data={data as DropdownListsData}
            onSave={(next) => saveTable(slug, next)}
          />
        ) : (
          <SimpleTableEditor
            data={data as SimpleTableData}
            onSave={(next) => saveTable(slug, next)}
            allowAddColumn={slug !== "order-type"}
          />
        )}
      </div>
    </div>
  );
}
