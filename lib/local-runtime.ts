// Local-only Vite alias. Never imported into a production Worker.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
const root = resolve(process.env.MENU_MATERIAL_DATA_DIR || ".local-data");
mkdirSync(root, { recursive: true });
const globalStore = globalThis as typeof globalThis & {
  __menuMaterialSqlite?: DatabaseSync;
};
const sqlite: DatabaseSync = (globalStore.__menuMaterialSqlite ??=
  new DatabaseSync(join(root, "menu-material.sqlite")));
sqlite.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)",
);
if (existsSync("drizzle"))
  for (const file of readdirSync("drizzle")
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    if (
      !sqlite.prepare("SELECT 1 FROM _local_migrations WHERE name=?").get(file)
    ) {
      sqlite.exec("BEGIN");
      try {
        sqlite.exec(readFileSync(join("drizzle", file), "utf8"));
        sqlite
          .prepare("INSERT INTO _local_migrations (name) VALUES (?)")
          .run(file);
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    }
  }
class Statement {
  constructor(
    private sql: string,
    private values: SQLInputValue[] = [],
  ) {}
  bind(...v: SQLInputValue[]) {
    return new Statement(this.sql, v);
  }
  async first(column?: string) {
    const r = sqlite.prepare(this.sql).get(...this.values);
    return column ? (r?.[column] ?? null) : (r ?? null);
  }
  executeAll() {
    return {
      results: sqlite.prepare(this.sql).all(...this.values),
      success: true,
      meta: {},
    };
  }
  async all() {
    return this.executeAll();
  }
  async run() {
    const v = sqlite.prepare(this.sql).run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(v.changes),
        last_row_id: Number(v.lastInsertRowid),
      },
    };
  }
}
const DB = {
  prepare: (s: string) => new Statement(s),
  async batch(statements: Statement[]) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const s of statements) results.push(s.executeAll());
      sqlite.exec("COMMIT");
      return results;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
const objectPath = (key: string) => {
  if (key.includes("..") || key.startsWith("/"))
    throw Error("Invalid object key");
  return join(root, "objects", key);
};
const BUCKET = {
  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | Uint8Array,
    options: Record<string, unknown> = {},
  ) {
    const p = objectPath(key);
    mkdirSync(dirname(p), { recursive: true });
    const bytes =
      value instanceof ReadableStream
        ? await new Response(value).arrayBuffer()
        : value;
    writeFileSync(p, new Uint8Array(bytes));
    writeFileSync(p + ".meta", JSON.stringify(options));
    return { key };
  },
  async head(key: string) {
    const p = objectPath(key);
    return existsSync(p) ? { key, size: statSync(p).size } : null;
  },
  async get(key: string) {
    const p = objectPath(key);
    if (!existsSync(p)) return null;
    const b = readFileSync(p);
    const meta = JSON.parse(readFileSync(p + ".meta", "utf8"));
    return {
      key,
      body: new Response(b).body,
      size: b.length,
      httpMetadata: meta.httpMetadata || {},
      arrayBuffer: async () =>
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      writeHttpMetadata(h: Headers) {
        h.set(
          "Content-Type",
          meta.httpMetadata?.contentType || "application/octet-stream",
        );
      },
    };
  },
  async delete(key: string | string[]) {
    for (const k of Array.isArray(key) ? key : [key])
      for (const p of [objectPath(k), objectPath(k) + ".meta"])
        if (existsSync(p)) unlinkSync(p);
  },
};
export const env = { ...process.env, DB, BUCKET, LOCAL_DEVELOPMENT: "true" };
