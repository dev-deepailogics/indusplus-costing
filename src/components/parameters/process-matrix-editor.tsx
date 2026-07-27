"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatrixTableEditor } from "./matrix-table-editor";
import type { MatrixTableData, ProcessMatrixTableData } from "@/lib/parameters/types";

export function ProcessMatrixEditor({
  data,
  onSave,
}: {
  data: ProcessMatrixTableData;
  onSave: (data: ProcessMatrixTableData) => Promise<void>;
}) {
  const [active, setActive] = useState(data.processes[0]);

  function saveProcessTable(process: string, table: MatrixTableData) {
    return onSave({ ...data, tables: { ...data.tables, [process]: table } });
  }

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as string)}>
      <TabsList>
        {data.processes.map((p) => (
          <TabsTrigger
            key={p}
            value={p}
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            {p}
          </TabsTrigger>
        ))}
      </TabsList>
      {data.processes.map((p) => (
        <TabsContent key={p} value={p} className="pt-4">
          <MatrixTableEditor
            data={data.tables[p]}
            onSave={(table) => saveProcessTable(p, table)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
