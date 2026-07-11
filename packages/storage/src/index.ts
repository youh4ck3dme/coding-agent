import Database from 'better-sqlite3';

type StorageDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run: (...args: unknown[]) => void;
    all: () => unknown[];
  };
};

function createDatabase(): StorageDb {
  const db = new Database(':memory:');
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
  return db;
}

let db: StorageDb | null = null;

function getDb(): StorageDb {
  if (!db) {
    db = createDatabase();
  }
  return db;
}

export function __setDatabaseForTests(testDb: StorageDb): void {
  db = testDb;
}

export function __resetDatabaseForTests(): void {
  db = null;
}

export function logMessage(message: string) {
  const stmt = getDb().prepare('INSERT INTO logs (message, timestamp) VALUES (?, ?)');
  stmt.run(message, Date.now());
}

export function getLogs() {
  return getDb().prepare('SELECT * FROM logs ORDER BY id DESC').all();
}

export interface ApprovalRecord {
  id?: number;
  action: string;
  details: string;
  approved: boolean;
  timestamp?: number;
}

export function addApproval(record: ApprovalRecord) {
  const stmt = getDb().prepare(
    'INSERT INTO approvals (action, details, approved, timestamp) VALUES (?, ?, ?, ?)'
  );
  stmt.run(record.action, record.details, record.approved ? 1 : 0, Date.now());
}

export function listApprovals() {
  return getDb().prepare('SELECT * FROM approvals ORDER BY id DESC').all();
}