import * as sql from "mssql";

/**
 * Parse an ADO.NET-style connection string into mssql config.
 * Format: Server=tcp:<host>,<port>;Database=<db>;User Id=<user>;Password=<pw>;Encrypt=false;
 */
function parseConnectionString(cs: string): sql.config {
  const parts: Record<string, string> = {};
  cs.split(";").forEach((seg) => {
    const eq = seg.indexOf("=");
    if (eq === -1) return;
    const key = seg.slice(0, eq).trim().toLowerCase();
    const val = seg.slice(eq + 1).trim();
    parts[key] = val;
  });

  // "Server" may look like "tcp:46.250.237.171,1433"
  const rawServer = parts["server"] || parts["data source"] || "";
  const serverPart = rawServer.replace(/^tcp:/i, "");
  const [host, portStr] = serverPart.split(",");
  const port = portStr ? parseInt(portStr, 10) : 1433;

  const encrypt =
    parts["encrypt"] !== undefined
      ? parts["encrypt"].toLowerCase() !== "false"
      : true;

  const trustServerCertificate =
    parts["trustservercertificate"] !== undefined
      ? parts["trustservercertificate"].toLowerCase() === "true"
      : !encrypt;

  return {
    server: host,
    port,
    database: parts["database"] ?? parts["initial catalog"],
    user: parts["user id"] ?? parts["uid"],
    password: parts["password"] ?? parts["pwd"],
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: 15_000,
    requestTimeout: 30_000,
    pool: {
      max: 15,
      min: 2,
      idleTimeoutMillis: 300_000,
      acquireTimeoutMillis: 15_000,
    },
  };
}

// Module-level singleton – survives Next.js hot reloads in dev via global
declare global {
  // eslint-disable-next-line no-var
  var __mssqlPool: sql.ConnectionPool | undefined;
  // eslint-disable-next-line no-var
  var __mssqlPoolConnecting: Promise<sql.ConnectionPool> | undefined;
  // eslint-disable-next-line no-var
  var __mssqlIndusPool: sql.ConnectionPool | undefined;
  // eslint-disable-next-line no-var
  var __mssqlIndusPoolConnecting: Promise<sql.ConnectionPool> | undefined;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (global.__mssqlPool?.connected) {
    return global.__mssqlPool;
  }

  if (global.__mssqlPoolConnecting) {
    return global.__mssqlPoolConnecting;
  }

  const cs = process.env.MSSQL_CONNECTION_STRING;
  if (!cs) throw new Error("MSSQL_CONNECTION_STRING env var is not set");

  const config = parseConnectionString(cs);
  const pool = new sql.ConnectionPool(config);

  global.__mssqlPoolConnecting = pool
    .connect()
    .then((connectedPool) => {
      global.__mssqlPool = connectedPool;
      global.__mssqlPoolConnecting = undefined;
      ensureAuditColumns(connectedPool).catch(() => {});
      return connectedPool;
    })
    .catch((err) => {
      global.__mssqlPoolConnecting = undefined;
      throw err;
    });

  return global.__mssqlPoolConnecting;
}

let auditColumnsEnsured = false;

/**
 * Ensures all database tables have the standard audit fields and users table has isdeleted soft deletion field.
 */
export async function ensureAuditColumns(pool: sql.ConnectionPool): Promise<void> {
  if (auditColumnsEnsured) return;
  try {
    const tablesRes = await pool.request().query<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
    );
    const tables = tablesRes.recordset.map((r) => r.TABLE_NAME);

    const auditFields = [
      { name: "inserted_by", type: "NVARCHAR(256) NULL" },
      { name: "inserted_at", type: "DATETIME2 NULL DEFAULT GETDATE()" },
      { name: "updated_by", type: "NVARCHAR(256) NULL" },
      { name: "updated_at", type: "DATETIME2 NULL" },
      { name: "deleted_by", type: "NVARCHAR(256) NULL" },
      { name: "deleted_at", type: "DATETIME2 NULL" },
    ];

    for (const table of tables) {
      for (const field of auditFields) {
        await pool.request().query(`
          IF NOT EXISTS (
            SELECT 1 FROM sys.columns 
            WHERE object_id = OBJECT_ID('${table}') 
              AND name = '${field.name}'
          )
          BEGIN
            ALTER TABLE [${table}] ADD [${field.name}] ${field.type};
          END
        `);
      }

      // Rename / migrate legacy createdAt to inserted_at without data loss
      await pool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns 
          WHERE object_id = OBJECT_ID('${table}') 
            AND name = 'createdAt'
        )
        BEGIN
          EXEC('UPDATE [${table}] SET inserted_at = createdAt WHERE createdAt IS NOT NULL AND inserted_at IS NULL;');
          DECLARE @dfCreatedAt NVARCHAR(200);
          SELECT @dfCreatedAt = d.name 
          FROM sys.tables t
          JOIN sys.columns c ON t.object_id = c.object_id
          JOIN sys.default_constraints d ON c.default_object_id = d.object_id
          WHERE t.name = '${table}' AND c.name = 'createdAt';
          IF @dfCreatedAt IS NOT NULL
            EXEC('ALTER TABLE [${table}] DROP CONSTRAINT [' + @dfCreatedAt + '];');
          EXEC('ALTER TABLE [${table}] DROP COLUMN [createdAt];');
        END
      `);

      // Rename / migrate legacy updatedAt to updated_at without data loss
      await pool.request().query(`
        IF EXISTS (
          SELECT 1 FROM sys.columns 
          WHERE object_id = OBJECT_ID('${table}') 
            AND name = 'updatedAt'
        )
        BEGIN
          EXEC('UPDATE [${table}] SET updated_at = updatedAt WHERE updatedAt IS NOT NULL AND updated_at IS NULL;');
          DECLARE @dfUpdatedAt NVARCHAR(200);
          SELECT @dfUpdatedAt = d.name 
          FROM sys.tables t
          JOIN sys.columns c ON t.object_id = c.object_id
          JOIN sys.default_constraints d ON c.default_object_id = d.object_id
          WHERE t.name = '${table}' AND c.name = 'updatedAt';
          IF @dfUpdatedAt IS NOT NULL
            EXEC('ALTER TABLE [${table}] DROP CONSTRAINT [' + @dfUpdatedAt + '];');
          EXEC('ALTER TABLE [${table}] DROP COLUMN [updatedAt];');
        END
      `);
    }

    // pre_order_cost_sheets backfill from saved_at
    await pool.request().query(`
      IF EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'saved_at'
      )
      BEGIN
        EXEC('UPDATE pre_order_cost_sheets SET inserted_at = TRY_CAST(saved_at AS DATETIME2) WHERE inserted_at IS NULL AND saved_at IS NOT NULL;');
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('users') 
          AND name = 'isdeleted'
      )
      BEGIN
        ALTER TABLE [users] ADD [isdeleted] BIT NOT NULL DEFAULT 0;
      END
    `);

    auditColumnsEnsured = true;
  } catch (err) {
    console.warn("[ensureAuditColumns] Error ensuring audit columns:", err);
  }
}

/** Pool for the indus-plus database (MSSQL_INDUS_PLUS_CONNECTION_STRING). */
export async function getIndusPool(): Promise<sql.ConnectionPool> {
  if (global.__mssqlIndusPool?.connected) {
    return global.__mssqlIndusPool;
  }

  if (global.__mssqlIndusPoolConnecting) {
    return global.__mssqlIndusPoolConnecting;
  }

  const cs = process.env.MSSQL_INDUS_PLUS_CONNECTION_STRING;
  if (!cs)
    throw new Error("MSSQL_INDUS_PLUS_CONNECTION_STRING env var is not set");

  const config = parseConnectionString(cs);
  const pool = new sql.ConnectionPool(config);

  global.__mssqlIndusPoolConnecting = pool
    .connect()
    .then((connectedPool) => {
      global.__mssqlIndusPool = connectedPool;
      global.__mssqlIndusPoolConnecting = undefined;
      return connectedPool;
    })
    .catch((err) => {
      global.__mssqlIndusPoolConnecting = undefined;
      throw err;
    });

  return global.__mssqlIndusPoolConnecting;
}

export { sql };
