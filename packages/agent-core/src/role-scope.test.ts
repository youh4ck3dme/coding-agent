import { describe, expect, it } from 'vitest';
import {
  isPathAllowedForRole,
  normalizeToolPath,
  roleScopeHint,
  roleScopeViolationMessage
} from './role-scope';

describe('role-scope', () => {
  it('normalizes windows-style paths', () => {
    expect(normalizeToolPath('\\packages\\web\\App.tsx')).toBe('packages/web/App.tsx');
  });

  it('allows frontend paths only for frontend role', () => {
    expect(isPathAllowedForRole('packages/web/src/components/ChatApp.tsx', 'frontend')).toBe(true);
    expect(isPathAllowedForRole('packages/mcp-server/src/index.ts', 'frontend')).toBe(false);
  });

  it('allows backend paths only for backend role', () => {
    expect(isPathAllowedForRole('packages/agent-core/src/index.ts', 'backend')).toBe(true);
    expect(isPathAllowedForRole('packages/web/src/App.tsx', 'backend')).toBe(false);
  });

  it('allows all read paths for qa role', () => {
    expect(isPathAllowedForRole('packages/web/src/App.tsx', 'qa')).toBe(true);
    expect(isPathAllowedForRole('packages/mcp-server/src/index.ts', 'qa')).toBe(true);
  });

  it('returns scope hints and violation messages', () => {
    expect(roleScopeHint('qa')).toContain('Žiadne zápisy');
    expect(roleScopeViolationMessage('packages/web/x.ts', 'backend')).toContain('backend');
  });
});