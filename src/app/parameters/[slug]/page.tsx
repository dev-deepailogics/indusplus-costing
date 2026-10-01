"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { getParameterDef } from "@/lib/parameters/registry";
import { saveTable, subscribeToTable } from "@/lib/parameters/api";
import type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
  CustomerTestingCostData,
  PaymentTermsData,
} from "@/lib/parameters/types";
import { MatrixTableEditor } from "@/components/parameters/matrix-table-editor";
import { ProcessMatrixEditor } from "@/components/parameters/process-matrix-editor";
import { SimpleTableEditor } from "@/components/parameters/simple-table-editor";
import { DropdownListsEditor } from "@/components/parameters/dropdown-lists-editor";
import { CustomerTestingCostEditor } from "@/components/parameters/customer-testing-cost-editor";
import { PaymentTermsEditor } from "@/components/parameters/payment-terms-editor";
import { useAuth } from "@/lib/auth/auth-provider";

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
  const { user, role: userRole, can } = useAuth();
  const isAdmin = userRole === "admin";
  const canCreate = isAdmin || can("page_parameters", "create") || can("parameters", "create");
  const canEdit = isAdmin || can("page_parameters", "edit") || can("parameters", "edit");
  const canDelete = isAdmin || can("page_parameters", "delete") || can("parameters", "delete");

  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    return subscribeToTable(slug, setData);
  }, [slug]);

  const handleSave = async (next: unknown) => {
    setData(next);
    await saveTable(slug, next);
  };

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
            onSave={handleSave}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : def.kind === "process-matrix" ? (
          <ProcessMatrixEditor
            data={data as ProcessMatrixTableData}
            onSave={handleSave}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : def.kind === "customer-testing" ? (
          <CustomerTestingCostEditor
            data={data as CustomerTestingCostData}
            onSave={handleSave}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : def.kind === "payment-terms" ? (
          <PaymentTermsEditor
            data={data as PaymentTermsData}
            onSave={handleSave}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : def.kind === "dropdown-lists" ? (
          <DropdownListsEditor
            data={data as DropdownListsData}
            onSave={handleSave}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <SimpleTableEditor
            data={data as SimpleTableData}
            onSave={handleSave}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}
      </div>
    </div>
  );
}

