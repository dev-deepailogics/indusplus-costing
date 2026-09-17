"use client";

import { useParameterTableFacade } from "../hooks/useParameterTableFacade";
import type {
  ParameterDef,
  MatrixTableData,
  ProcessMatrixTableData,
  DropdownListsData,
  SimpleTableData,
} from "../types";
import { MatrixTableEditor } from "./MatrixTableEditor";
import { ProcessMatrixEditor } from "./ProcessMatrixEditor";
import { SimpleTableEditor } from "./SimpleTableEditor";
import { DropdownListsEditor } from "./DropdownListsEditor";

export function ParameterTableView({
  slug,
  def,
}: {
  slug: string;
  def: ParameterDef;
}) {
  const { data, loading, handleSave } = useParameterTableFacade<unknown>(slug);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {loading || data === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : def.kind === "matrix" ? (
          <MatrixTableEditor
            data={data as MatrixTableData}
            onSave={handleSave as (d: MatrixTableData) => Promise<void>}
          />
        ) : def.kind === "process-matrix" ? (
          <ProcessMatrixEditor
            data={data as ProcessMatrixTableData}
            onSave={handleSave as (d: ProcessMatrixTableData) => Promise<void>}
          />
        ) : def.kind === "dropdown-lists" ? (
          <DropdownListsEditor
            data={data as DropdownListsData}
            onSave={handleSave as (d: DropdownListsData) => Promise<void>}
          />
        ) : (
          <SimpleTableEditor
            data={data as SimpleTableData}
            onSave={handleSave as (d: SimpleTableData) => Promise<void>}
          />
        )}
      </div>
    </div>
  );
}
