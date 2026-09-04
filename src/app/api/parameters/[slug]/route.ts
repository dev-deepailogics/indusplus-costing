import { NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";
import type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "@/lib/parameters/types";

// ---------------------------------------------------------------------------
// DDL — runs once per server lifetime
// ---------------------------------------------------------------------------
let tablesReady = false;

async function ensureTables(pool: Awaited<ReturnType<typeof getPool>>) {
  if (tablesReady) return;

  const ddlStatements = [
    // ── cut_to_ship_grid ────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='cut_to_ship_grid')
     CREATE TABLE cut_to_ship_grid (
       qty_band       NVARCHAR(64) NOT NULL,
       style_category NVARCHAR(64) NOT NULL,
       value          NVARCHAR(32) NOT NULL DEFAULT '',
       row_order      INT          NOT NULL DEFAULT 0,
       col_order      INT          NOT NULL DEFAULT 0,
       PRIMARY KEY (qty_band, style_category)
     )`,

    // ── rejection_grid ──────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='rejection_grid')
     CREATE TABLE rejection_grid (
       process        NVARCHAR(64) NOT NULL,
       qty_band       NVARCHAR(64) NOT NULL,
       style_category NVARCHAR(64) NOT NULL,
       value          NVARCHAR(32) NOT NULL DEFAULT '',
       process_order  INT          NOT NULL DEFAULT 0,
       row_order      INT          NOT NULL DEFAULT 0,
       col_order      INT          NOT NULL DEFAULT 0,
       PRIMARY KEY (process, qty_band, style_category)
     )`,

    // ── customer_rejections ──────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='customer_rejections')
     CREATE TABLE customer_rejections (
       customer_name NVARCHAR(128) NOT NULL PRIMARY KEY,
       rejection_pct NVARCHAR(32)  NOT NULL DEFAULT '',
       row_order     INT           NOT NULL DEFAULT 0
     )`,

    // ── styles (dedicated 2-table schema for dynamic fields) ────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='styles_columns')
     CREATE TABLE styles_columns (
       col_key    NVARCHAR(128) NOT NULL PRIMARY KEY,
       col_label  NVARCHAR(256) NOT NULL,
       sort_order INT           NOT NULL DEFAULT 0
     )`,

    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='styles_values')
     CREATE TABLE styles_values (
       row_id    NVARCHAR(128) NOT NULL,
       col_key   NVARCHAR(128) NOT NULL,
       col_value NVARCHAR(MAX) NOT NULL DEFAULT '',
       row_order INT           NOT NULL DEFAULT 0,
       PRIMARY KEY (row_id, col_key)
     )`,

    `IF NOT EXISTS (
       SELECT 1 FROM sys.indexes
       WHERE name = 'IX_styles_values_order'
       AND object_id = OBJECT_ID('styles_values')
     )
     CREATE INDEX IX_styles_values_order ON styles_values (row_order, row_id)`,

    // ── other_expenses ──────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='other_expenses')
     CREATE TABLE other_expenses (
       id               NVARCHAR(128) NOT NULL PRIMARY KEY,
       description      NVARCHAR(256) NOT NULL DEFAULT '',
       percent_of_sales NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order        INT           NOT NULL DEFAULT 0
     )`,

    // ── order_types ─────────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='order_types')
     CREATE TABLE order_types (
       id         NVARCHAR(128) NOT NULL PRIMARY KEY,
       order_type NVARCHAR(128) NOT NULL DEFAULT '',
       row_order  INT           NOT NULL DEFAULT 0
     )`,

    // ── customer_commissions ────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='customer_commissions')
     CREATE TABLE customer_commissions (
       id                 NVARCHAR(128) NOT NULL PRIMARY KEY,
       customer           NVARCHAR(256) NOT NULL DEFAULT '',
       commission_percent NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order          INT           NOT NULL DEFAULT 0
     )`,

    // ── cost_as_percent_of_sales ────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='cost_as_percent_of_sales')
     CREATE TABLE cost_as_percent_of_sales (
       id               NVARCHAR(128) NOT NULL PRIMARY KEY,
       description      NVARCHAR(256) NOT NULL DEFAULT '',
       percent_of_sales NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order        INT           NOT NULL DEFAULT 0
     )`,

    // ── direct_labour_foh ───────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='direct_labour_foh')
     CREATE TABLE direct_labour_foh (
       id           NVARCHAR(128) NOT NULL PRIMARY KEY,
       description  NVARCHAR(256) NOT NULL DEFAULT '',
       cost_per_sam NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order    INT           NOT NULL DEFAULT 0
     )`,

    // ── admin_selling ───────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='admin_selling')
     CREATE TABLE admin_selling (
       id           NVARCHAR(128) NOT NULL PRIMARY KEY,
       description  NVARCHAR(256) NOT NULL DEFAULT '',
       cost_per_sam NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order    INT           NOT NULL DEFAULT 0
     )`,

    // ── dropdown_lists ──────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='dropdown_lists')
     CREATE TABLE dropdown_lists (
       list_key   NVARCHAR(128) NOT NULL PRIMARY KEY,
       list_label NVARCHAR(256) NOT NULL,
       items_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
       sort_order INT           NOT NULL DEFAULT 0
     )`,
  ];

  for (const ddl of ddlStatements) {
    await pool.request().query(ddl);
  }

  tablesReady = true;
}

// ---------------------------------------------------------------------------
// 1. CUT-TO-SHIP GRID
// ---------------------------------------------------------------------------
async function getCutToShipGrid(pool: Awaited<ReturnType<typeof getPool>>): Promise<MatrixTableData> {
  const result = await pool.request().query<{
    qty_band: string;
    style_category: string;
    value: string;
    row_order: number;
    col_order: number;
  }>("SELECT qty_band, style_category, value, row_order, col_order FROM cut_to_ship_grid ORDER BY row_order, col_order");

  const rowMap = new Map<string, number>();
  const colMap = new Map<string, number>();
  const cells: Record<string, Record<string, string>> = {};

  for (const r of result.recordset) {
    if (!rowMap.has(r.qty_band)) rowMap.set(r.qty_band, r.row_order);
    if (!colMap.has(r.style_category)) colMap.set(r.style_category, r.col_order);
    if (!cells[r.qty_band]) cells[r.qty_band] = {};
    cells[r.qty_band][r.style_category] = r.value;
  }

  const rowLabels = [...rowMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const columnLabels = [...colMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);

  return { rowLabels, columnLabels, cells };
}

async function saveCutToShipGrid(pool: Awaited<ReturnType<typeof getPool>>, data: MatrixTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM cut_to_ship_grid");
    for (let ri = 0; ri < data.rowLabels.length; ri++) {
      const qty = data.rowLabels[ri];
      for (let ci = 0; ci < data.columnLabels.length; ci++) {
        const cat = data.columnLabels[ci];
        await new sql.Request(tx)
          .input("qty_band", sql.NVarChar(64), qty)
          .input("style_category", sql.NVarChar(64), cat)
          .input("value", sql.NVarChar(32), data.cells[qty]?.[cat] ?? "")
          .input("row_order", sql.Int, ri)
          .input("col_order", sql.Int, ci)
          .query(
            "INSERT INTO cut_to_ship_grid (qty_band, style_category, value, row_order, col_order) VALUES (@qty_band, @style_category, @value, @row_order, @col_order)"
          );
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. REJECTION GRID
// ---------------------------------------------------------------------------
async function getRejectionGrid(pool: Awaited<ReturnType<typeof getPool>>): Promise<ProcessMatrixTableData> {
  const result = await pool.request().query<{
    process: string;
    qty_band: string;
    style_category: string;
    value: string;
    process_order: number;
    row_order: number;
    col_order: number;
  }>("SELECT process, qty_band, style_category, value, process_order, row_order, col_order FROM rejection_grid ORDER BY process_order, row_order, col_order");

  const processMap = new Map<string, number>();
  const tables: Record<string, MatrixTableData> = {};

  for (const r of result.recordset) {
    if (!processMap.has(r.process)) {
      processMap.set(r.process, r.process_order);
      tables[r.process] = { rowLabels: [], columnLabels: [], cells: {} };
    }
    const tbl = tables[r.process];
    if (!tbl.rowLabels.includes(r.qty_band)) tbl.rowLabels.push(r.qty_band);
    if (!tbl.columnLabels.includes(r.style_category)) tbl.columnLabels.push(r.style_category);
    if (!tbl.cells[r.qty_band]) tbl.cells[r.qty_band] = {};
    tbl.cells[r.qty_band][r.style_category] = r.value;
  }

  const processes = [...processMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  if (processes.length === 0) {
    processes.push("Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1");
  }

  // Load customer single rejection rates
  const customerRejections: Record<string, string> = {};
  try {
    const custRes = await pool.request().query<{
      customer_name: string;
      rejection_pct: string;
    }>("SELECT customer_name, rejection_pct FROM customer_rejections ORDER BY row_order, customer_name");
    for (const row of custRes.recordset) {
      if (row.customer_name) {
        customerRejections[row.customer_name] = row.rejection_pct;
      }
    }
  } catch {
    // If table doesn't exist yet, ignore
  }

  return { processes, tables, customerRejections };
}

async function saveRejectionGrid(pool: Awaited<ReturnType<typeof getPool>>, data: ProcessMatrixTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM rejection_grid");

    for (let pi = 0; pi < data.processes.length; pi++) {
      const process = data.processes[pi];
      const matrix = data.tables[process];
      if (!matrix) continue;

      for (let ri = 0; ri < matrix.rowLabels.length; ri++) {
        const qty = matrix.rowLabels[ri];
        for (let ci = 0; ci < matrix.columnLabels.length; ci++) {
          const cat = matrix.columnLabels[ci];
          await new sql.Request(tx)
            .input("process", sql.NVarChar(64), process)
            .input("qty_band", sql.NVarChar(64), qty)
            .input("style_category", sql.NVarChar(64), cat)
            .input("value", sql.NVarChar(32), matrix.cells[qty]?.[cat] ?? "")
            .input("process_order", sql.Int, pi)
            .input("row_order", sql.Int, ri)
            .input("col_order", sql.Int, ci)
            .query(
              "INSERT INTO rejection_grid (process, qty_band, style_category, value, process_order, row_order, col_order) VALUES (@process, @qty_band, @style_category, @value, @process_order, @row_order, @col_order)"
            );
        }
      }
    }

    // Save customer single rejection values
    if (data.customerRejections) {
      await new sql.Request(tx).query("DELETE FROM customer_rejections");
      let idx = 0;
      for (const [custName, rejVal] of Object.entries(data.customerRejections)) {
        if (!custName.trim() || !rejVal || !rejVal.trim()) continue;
        await new sql.Request(tx)
          .input("customer_name", sql.NVarChar(128), custName.trim())
          .input("rejection_pct", sql.NVarChar(32), rejVal.trim())
          .input("row_order", sql.Int, idx++)
          .query(
            "INSERT INTO customer_rejections (customer_name, rejection_pct, row_order) VALUES (@customer_name, @rejection_pct, @row_order)"
          );
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. STYLES
// ---------------------------------------------------------------------------
async function getStyles(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const [colResult, valResult] = await Promise.all([
    pool.request().query<{ col_key: string; col_label: string; sort_order: number }>(
      "SELECT col_key, col_label, sort_order FROM styles_columns ORDER BY sort_order"
    ),
    pool.request().query<{ row_id: string; col_key: string; col_value: string; row_order: number }>(
      "SELECT row_id, col_key, col_value, row_order FROM styles_values ORDER BY row_order, row_id"
    ),
  ]);

  const columns = colResult.recordset.length > 0
    ? colResult.recordset.map((r) => ({ key: r.col_key, label: r.col_label }))
    : [
        { key: "styleName", label: "Style Category" },
        { key: "samPcFrom", label: "SAM/PC From" },
        { key: "samPcTo", label: "SAM/PC To" },
      ];

  const rowMap = new Map<string, { order: number; values: Record<string, string> }>();
  for (const r of valResult.recordset) {
    if (!rowMap.has(r.row_id)) rowMap.set(r.row_id, { order: r.row_order, values: {} });
    rowMap.get(r.row_id)!.values[r.col_key] = r.col_value;
  }

  const rows = [...rowMap.entries()].sort((a, b) => a[1].order - b[1].order).map(([id, { values }]) => ({ id, values }));
  return { columns, rows };
}

async function saveStyles(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM styles_values");
    await new sql.Request(tx).query("DELETE FROM styles_columns");

    for (let i = 0; i < data.columns.length; i++) {
      const col = data.columns[i];
      await new sql.Request(tx)
        .input("col_key", sql.NVarChar(128), col.key)
        .input("col_label", sql.NVarChar(256), col.label)
        .input("sort_order", sql.Int, i)
        .query("INSERT INTO styles_columns (col_key, col_label, sort_order) VALUES (@col_key, @col_label, @sort_order)");
    }

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      for (const col of data.columns) {
        await new sql.Request(tx)
          .input("row_id", sql.NVarChar(128), row.id)
          .input("col_key", sql.NVarChar(128), col.key)
          .input("col_value", sql.NVarChar(sql.MAX), row.values[col.key] ?? "")
          .input("row_order", sql.Int, i)
          .query("INSERT INTO styles_values (row_id, col_key, col_value, row_order) VALUES (@row_id, @col_key, @col_value, @row_order)");
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. OTHER EXPENSES (dedicated table: other_expenses)
// ---------------------------------------------------------------------------
async function getOtherExpenses(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{ id: string; description: string; percent_of_sales: string; row_order: number }>(
    "SELECT id, description, percent_of_sales, row_order FROM other_expenses ORDER BY row_order, id"
  );

  const columns = [
    { key: "description", label: "Description" },
    { key: "percentOfSales", label: "% of Sales" },
  ];

  const rows = result.recordset.map((r) => ({
    id: r.id,
    values: { description: r.description, percentOfSales: r.percent_of_sales },
  }));

  return { columns, rows };
}

async function saveOtherExpenses(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM other_expenses");
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      await new sql.Request(tx)
        .input("id", sql.NVarChar(128), row.id)
        .input("description", sql.NVarChar(256), row.values.description ?? "")
        .input("percent_of_sales", sql.NVarChar(64), row.values.percentOfSales ?? "")
        .input("row_order", sql.Int, i)
        .query("INSERT INTO other_expenses (id, description, percent_of_sales, row_order) VALUES (@id, @description, @percent_of_sales, @row_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. ORDER TYPES (dedicated table: order_types)
// ---------------------------------------------------------------------------
async function getOrderTypes(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{ id: string; order_type: string; row_order: number }>(
    "SELECT id, order_type, row_order FROM order_types ORDER BY row_order, id"
  );

  const columns = [{ key: "orderType", label: "Order Type" }];

  const rows = result.recordset.map((r) => ({
    id: r.id,
    values: { orderType: r.order_type },
  }));

  return { columns, rows };
}

async function saveOrderTypes(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM order_types");
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      await new sql.Request(tx)
        .input("id", sql.NVarChar(128), row.id)
        .input("order_type", sql.NVarChar(128), row.values.orderType ?? "")
        .input("row_order", sql.Int, i)
        .query("INSERT INTO order_types (id, order_type, row_order) VALUES (@id, @order_type, @row_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. CUSTOMER COMMISSIONS (dedicated table: customer_commissions)
// ---------------------------------------------------------------------------
async function getCustomerCommissions(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{ id: string; customer: string; commission_percent: string; row_order: number }>(
    "SELECT id, customer, commission_percent, row_order FROM customer_commissions ORDER BY row_order, id"
  );

  const columns = [
    { key: "customer", label: "Customer" },
    { key: "commissionPercent", label: "Commission %" },
  ];

  const rows = result.recordset.map((r) => ({
    id: r.id,
    values: { customer: r.customer, commissionPercent: r.commission_percent },
  }));

  return { columns, rows };
}

async function saveCustomerCommissions(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM customer_commissions");
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      await new sql.Request(tx)
        .input("id", sql.NVarChar(128), row.id)
        .input("customer", sql.NVarChar(256), row.values.customer ?? "")
        .input("commission_percent", sql.NVarChar(64), row.values.commissionPercent ?? "")
        .input("row_order", sql.Int, i)
        .query("INSERT INTO customer_commissions (id, customer, commission_percent, row_order) VALUES (@id, @customer, @commission_percent, @row_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. COST AS % OF SALES (dedicated table: cost_as_percent_of_sales)
// ---------------------------------------------------------------------------
async function getCostAsPercentOfSales(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{ id: string; description: string; percent_of_sales: string; row_order: number }>(
    "SELECT id, description, percent_of_sales, row_order FROM cost_as_percent_of_sales ORDER BY row_order, id"
  );

  const columns = [
    { key: "description", label: "Description" },
    { key: "percentOfSales", label: "% of Sales" },
  ];

  const rows = result.recordset.map((r) => ({
    id: r.id,
    values: { description: r.description, percentOfSales: r.percent_of_sales },
  }));

  return { columns, rows };
}

async function saveCostAsPercentOfSales(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM cost_as_percent_of_sales");
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      await new sql.Request(tx)
        .input("id", sql.NVarChar(128), row.id)
        .input("description", sql.NVarChar(256), row.values.description ?? "")
        .input("percent_of_sales", sql.NVarChar(64), row.values.percentOfSales ?? "")
        .input("row_order", sql.Int, i)
        .query("INSERT INTO cost_as_percent_of_sales (id, description, percent_of_sales, row_order) VALUES (@id, @description, @percent_of_sales, @row_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 8. DIRECT LABOUR AND FOH (dedicated table: direct_labour_foh)
// ---------------------------------------------------------------------------
async function getDirectLabourFoh(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{ id: string; description: string; cost_per_sam: string; row_order: number }>(
    "SELECT id, description, cost_per_sam, row_order FROM direct_labour_foh ORDER BY row_order, id"
  );

  const columns = [
    { key: "description", label: "Description" },
    { key: "costPerSam", label: "Cost/SAM" },
  ];

  const rows = result.recordset.map((r) => ({
    id: r.id,
    values: { description: r.description, costPerSam: r.cost_per_sam },
  }));

  return { columns, rows };
}

async function saveDirectLabourFoh(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM direct_labour_foh");
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      await new sql.Request(tx)
        .input("id", sql.NVarChar(128), row.id)
        .input("description", sql.NVarChar(256), row.values.description ?? "")
        .input("cost_per_sam", sql.NVarChar(64), row.values.costPerSam ?? "")
        .input("row_order", sql.Int, i)
        .query("INSERT INTO direct_labour_foh (id, description, cost_per_sam, row_order) VALUES (@id, @description, @cost_per_sam, @row_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 9. ADMIN AND SELLING (dedicated table: admin_selling)
// ---------------------------------------------------------------------------
async function getAdminSelling(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{ id: string; description: string; cost_per_sam: string; row_order: number }>(
    "SELECT id, description, cost_per_sam, row_order FROM admin_selling ORDER BY row_order, id"
  );

  const columns = [
    { key: "description", label: "Description" },
    { key: "costPerSam", label: "Cost/SAM" },
  ];

  const rows = result.recordset.map((r) => ({
    id: r.id,
    values: { description: r.description, costPerSam: r.cost_per_sam },
  }));

  return { columns, rows };
}

async function saveAdminSelling(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM admin_selling");
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      await new sql.Request(tx)
        .input("id", sql.NVarChar(128), row.id)
        .input("description", sql.NVarChar(256), row.values.description ?? "")
        .input("cost_per_sam", sql.NVarChar(64), row.values.costPerSam ?? "")
        .input("row_order", sql.Int, i)
        .query("INSERT INTO admin_selling (id, description, cost_per_sam, row_order) VALUES (@id, @description, @cost_per_sam, @row_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 10. DROPDOWN LISTS (dedicated table: dropdown_lists)
// ---------------------------------------------------------------------------
async function getDropdownLists(pool: Awaited<ReturnType<typeof getPool>>): Promise<DropdownListsData> {
  const result = await pool.request().query<{
    list_key: string;
    list_label: string;
    items_json: string;
    sort_order: number;
  }>("SELECT list_key, list_label, items_json, sort_order FROM dropdown_lists ORDER BY sort_order");

  const lists = result.recordset.map((r) => ({
    key: r.list_key,
    label: r.list_label,
    items: JSON.parse(r.items_json || "[]") as string[],
  }));

  return { lists };
}

async function saveDropdownLists(pool: Awaited<ReturnType<typeof getPool>>, data: DropdownListsData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM dropdown_lists");
    for (let i = 0; i < data.lists.length; i++) {
      const list = data.lists[i];
      await new sql.Request(tx)
        .input("list_key", sql.NVarChar(128), list.key)
        .input("list_label", sql.NVarChar(256), list.label)
        .input("items_json", sql.NVarChar(sql.MAX), JSON.stringify(list.items))
        .input("sort_order", sql.Int, i)
        .query("INSERT INTO dropdown_lists (list_key, list_label, items_json, sort_order) VALUES (@list_key, @list_label, @items_json, @sort_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ===========================================================================
// Route Handlers
// ===========================================================================

// GET /api/parameters/[slug]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const pool = await getPool();
    await ensureTables(pool);

    let data: unknown;

    switch (slug) {
      case "cut-to-ship-grid":
        data = await getCutToShipGrid(pool);
        break;
      case "rejection-grid":
        data = await getRejectionGrid(pool);
        break;
      case "styles":
        data = await getStyles(pool);
        break;
      case "other-expenses":
        data = await getOtherExpenses(pool);
        break;
      case "order-type":
        data = await getOrderTypes(pool);
        break;
      case "customer-commission":
        data = await getCustomerCommissions(pool);
        break;
      case "cost-as-percent-of-sales":
        data = await getCostAsPercentOfSales(pool);
        break;
      case "direct-labour-foh":
        data = await getDirectLabourFoh(pool);
        break;
      case "admin-selling":
        data = await getAdminSelling(pool);
        break;
      case "dropdown-lists":
        data = await getDropdownLists(pool);
        break;
      default:
        return Response.json({ error: "Unknown parameter slug" }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    console.error("[GET /api/parameters/[slug]]", err);
    return Response.json({ error: "Failed to fetch parameter" }, { status: 500 });
  }
}

// PUT /api/parameters/[slug]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const pool = await getPool();
    await ensureTables(pool);

    switch (slug) {
      case "cut-to-ship-grid":
        await saveCutToShipGrid(pool, body as MatrixTableData);
        break;
      case "rejection-grid":
        await saveRejectionGrid(pool, body as ProcessMatrixTableData);
        break;
      case "styles":
        await saveStyles(pool, body as SimpleTableData);
        break;
      case "other-expenses":
        await saveOtherExpenses(pool, body as SimpleTableData);
        break;
      case "order-type":
        await saveOrderTypes(pool, body as SimpleTableData);
        break;
      case "customer-commission":
        await saveCustomerCommissions(pool, body as SimpleTableData);
        break;
      case "cost-as-percent-of-sales":
        await saveCostAsPercentOfSales(pool, body as SimpleTableData);
        break;
      case "direct-labour-foh":
        await saveDirectLabourFoh(pool, body as SimpleTableData);
        break;
      case "admin-selling":
        await saveAdminSelling(pool, body as SimpleTableData);
        break;
      case "dropdown-lists":
        await saveDropdownLists(pool, body as DropdownListsData);
        break;
      default:
        return Response.json({ error: "Unknown parameter slug" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/parameters/[slug]]", err);
    return Response.json({ error: "Failed to save parameter" }, { status: 500 });
  }
}
