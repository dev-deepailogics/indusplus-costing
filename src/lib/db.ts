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

  return {
    server: host,
    port,
    database: parts["database"] ?? parts["initial catalog"],
    user: parts["user id"] ?? parts["uid"],
    password: parts["password"] ?? parts["pwd"],
    options: {
      encrypt,
      trustServerCertificate: !encrypt,
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
      return connectedPool;
    })
    .catch((err) => {
      global.__mssqlPoolConnecting = undefined;
      throw err;
    });

  return global.__mssqlPoolConnecting;
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
