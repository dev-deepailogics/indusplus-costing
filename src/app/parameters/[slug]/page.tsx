"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { getParameterDef } from "@/lib/parameters/registry";
import { saveTable, subscribeToTable } from "@/lib/parameters/firestore";
import type {
  DropdownListsData,
  GridCardListData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "@/lib/parameters/types";
import { MatrixTableEditor } from "@/components/parameters/matrix-table-editor";
import { ProcessMatrixEditor } from "@/components/parameters/process-matrix-editor";
import { SimpleTableEditor } from "@/components/parameters/simple-table-editor";
import { DropdownListsEditor } from "@/components/parameters/dropdown-lists-editor";
import { GridCardList } from "@/components/parameters/grid-card-list";
import { EMPTY_MATRIX, EMPTY_PROCESS_MATRIX } from "@/lib/parameters/seed-data";

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

  const isCardListKind = def.kind === "matrix" || def.kind === "process-matrix";
  const notReady =
    data === null ||
    (isCardListKind && !Array.isArray((data as GridCardListData<unknown>)?.cards));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {notReady ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : def.kind === "matrix" ? (
          <GridCardList
            data={data as GridCardListData<MatrixTableData>}
            onSave={(next) => saveTable(slug, next)}
            emptyData={EMPTY_MATRIX}
            renderEditor={(cardData, save) => (
              <MatrixTableEditor data={cardData} onSave={save} />
            )}
          />
        ) : def.kind === "process-matrix" ? (
          <GridCardList
            data={data as GridCardListData<ProcessMatrixTableData>}
            onSave={(next) => saveTable(slug, next)}
            emptyData={EMPTY_PROCESS_MATRIX}
            renderEditor={(cardData, save) => (
              <ProcessMatrixEditor data={cardData} onSave={save} />
            )}
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
          />
        )}
      </div>
    </div>
  );
}
