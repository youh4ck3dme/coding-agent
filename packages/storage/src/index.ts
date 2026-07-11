import Database from 'better-sqlite3';

// Initialize a SQLite database.  In a more robust implementation this would
// persist to disk (e.g. WORKSPACE_ROOT + '/.agent.sqlite'), but for
// demonstration purposes an in‑memory database is sufficient.
const db = new Database(':memory:');

// Create tables for logs and approvals
db.exec(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT,
  timestamp INTEGER
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  details TEXT,
  approved BOOLEAN,
  timestamp INTEGER
);
`);

export function logMessage(message: string) {
  const stmt = db.prepare('INSERT INTO logs (message, timestamp) VALUES (?, ?)');
  stmt.run(message, Date.now());
}

export function getLogs() {
  return db.prepare('SELECT * FROM logs ORDER BY id DESC').all();
}

export interface ApprovalRecord {
  id?: number;
  action: string;
  details: string;
  approved: boolean;
  timestamp?: number;
}

export function addApproval(record: ApprovalRecord) {
  const stmt = db.prepare('INSERT INTO approvals (action, details, approved, timestamp) VALUES (?, ?, ?, ?)');
  stmt.run(record.action, record.details, record.approved ? 1 : 0, Date.now());
}

export function listApprovals() {
  return db.prepare('SELECT * FROM approvals ORDER BY id DESC').all();
}