import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {
    constructor() {
      throw new Error('better-sqlite3 should not be instantiated in unit tests');
    }
  }
}));

import {
  __resetDatabaseForTests,
  __setDatabaseForTests,
  addApproval,
  getLogs,
  listApprovals,
  logMessage
} from './index';

type LogRow = { id: number; message: string; timestamp: number };
type ApprovalRow = { id: number; action: string; details: string; approved: number; timestamp: number };

function createMemoryDatabase() {
  const logs: LogRow[] = [];
  const approvals: ApprovalRow[] = [];
  let logId = 0;
  let approvalId = 0;

  return {
    exec() {},
    prepare(sql: string) {
      if (sql.includes('INSERT INTO logs')) {
        return {
          run(message: string, timestamp: number) {
            logs.unshift({ id: ++logId, message, timestamp });
          },
          all: () => [...logs]
        };
      }

      if (sql.includes('SELECT * FROM logs')) {
        return {
          run: () => {},
          all: () => [...logs]
        };
      }

      if (sql.includes('INSERT INTO approvals')) {
        return {
          run(action: string, details: string, approved: number, timestamp: number) {
            approvals.unshift({ id: ++approvalId, action, details, approved, timestamp });
          },
          all: () => [...approvals]
        };
      }

      return {
        run: () => {},
        all: () => [...approvals]
      };
    }
  };
}

describe('storage logs', () => {
  beforeEach(() => {
    __setDatabaseForTests(createMemoryDatabase());
  });

  afterEach(() => {
    __resetDatabaseForTests();
  });

  it('stores and returns messages newest first', () => {
    logMessage('first');
    logMessage('second');

    const logs = getLogs() as Array<{ message: string }>;
    expect(logs[0]?.message).toBe('second');
    expect(logs[1]?.message).toBe('first');
  });
});

describe('storage approvals', () => {
  beforeEach(() => {
    __setDatabaseForTests(createMemoryDatabase());
  });

  afterEach(() => {
    __resetDatabaseForTests();
  });

  it('persists approval records', () => {
    addApproval({
      action: 'write_file',
      details: 'src/index.ts',
      approved: true
    });
    addApproval({
      action: 'write_file',
      details: 'src/app.ts',
      approved: false
    });

    const approvals = listApprovals() as Array<{ details: string; approved: number }>;
    expect(approvals).toHaveLength(2);
    expect(approvals[0]?.details).toBe('src/app.ts');
    expect(approvals[0]?.approved).toBe(0);
    expect(approvals[1]?.approved).toBe(1);
  });
});