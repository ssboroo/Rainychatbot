import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const globalDb = globalThis as unknown as { rainyDb?: DatabaseSync };
export function db() {
 if (globalDb.rainyDb) return globalDb.rainyDb;
 const file = process.env.DATABASE_PATH || resolve('data/rainy.db'); mkdirSync(dirname(file), { recursive: true });
 const d = new DatabaseSync(file); d.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, brand_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner');
 CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, expires_at INTEGER NOT NULL, platform TEXT NOT NULL, pending_id TEXT);
 CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '', tags TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS resources (workspace_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(workspace_id, kind, id));
 CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, workspace_id TEXT, event TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bot_rules (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, account_id TEXT NOT NULL, trigger TEXT NOT NULL, config TEXT NOT NULL, enabled INTEGER NOT NULL, priority INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bot_jobs (id TEXT PRIMARY KEY, workspace_id TEXT, event TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', next_block INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL DEFAULT 0, inflight INTEGER NOT NULL DEFAULT 0, rule_id TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bot_runs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, rule_id TEXT NOT NULL, recipient TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS bot_runs_recipient ON bot_runs(workspace_id,recipient,created_at);
 CREATE TABLE IF NOT EXISTS bot_handoffs (workspace_id TEXT NOT NULL, conversation_id TEXT NOT NULL, until_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,conversation_id));
 CREATE TABLE IF NOT EXISTS qpay_credentials (workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id), encrypted TEXT NOT NULL, token_encrypted TEXT, token_expires INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), public_token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), request_key TEXT NOT NULL, request_hash TEXT NOT NULL, public_token TEXT UNIQUE NOT NULL, callback_hash TEXT NOT NULL, provider_id TEXT, environment TEXT NOT NULL, amount INTEGER NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, qr_image TEXT, bank_urls TEXT, product_id TEXT, conversation_id TEXT, account_id TEXT, error TEXT, created_at INTEGER NOT NULL, paid_at INTEGER, UNIQUE(workspace_id,request_key));
 CREATE TABLE IF NOT EXISTS outbound_requests (workspace_id TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL, result TEXT, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,request_key));

 `); globalDb.rainyDb = d; return d;
}
export type User = { id: string; workspace_id: string; name: string; email: string; role: string; workspace_name: string; brand_id: string | null };
export function audit(user: User, action: string) { db().prepare('INSERT INTO audit(id,workspace_id,user_id,action) VALUES(?,?,?,?)').run(randomUUID(),user.workspace_id,user.id,action); }
export function rateLimit(key: string, limit: number, seconds: number) { const d=db(), now=Date.now(); d.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(now); d.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+seconds*1000); const row=d.prepare('SELECT count FROM rate_limits WHERE key=?').get(key) as {count:number}; return row.count <= limit; }
