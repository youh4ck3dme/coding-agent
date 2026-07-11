import { AgentRole } from '@coding-agent/shared/dist/types';

const FRONTEND_PREFIXES = ['packages/web/', 'extensions/vscode/'];
const BACKEND_PREFIXES = [
  'packages/mcp-server/',
  'packages/agent-core/',
  'packages/mistral-client/',
  'packages/cli/',
  'packages/tooling/',
  'packages/shared/',
  'packages/security/',
  'packages/storage/',
  'scripts/'
];

export function normalizeToolPath(file: string): string {
  return file.replace(/^\/+/, '').replace(/\\/g, '/');
}

export function isPathAllowedForRole(file: string, role?: AgentRole): boolean {
  if (!role || role === 'qa') {
    return true;
  }

  const path = normalizeToolPath(file);
  const prefixes = role === 'frontend' ? FRONTEND_PREFIXES : BACKEND_PREFIXES;
  return prefixes.some(prefix => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

export function roleScopeHint(role?: AgentRole): string | undefined {
  switch (role) {
    case 'frontend':
      return [
        'Rozsah Frontend (povinné):',
        '- Pracuj len v packages/web/ a extensions/vscode/.',
        '- Hlavný chat komponent: packages/web/src/components/ChatApp.tsx.',
        '- Neexistujúce cesty nevymýšľaj — najprv list_directory alebo read_file.',
        '- Netýkaj sa backend balíkov (mcp-server, agent-core, cli…).'
      ].join('\n');
    case 'backend':
      return [
        'Rozsah Backend (povinné):',
        '- Pracuj v packages/mcp-server/, agent-core/, mistral-client/, cli/, shared/, tooling/, scripts/.',
        '- Nemeň ani neanalyzuj packages/web/ ani extensions/vscode/ — to je frontend.',
        '- Neexistujúce cesty nevymýšľaj — najprv list_directory.'
      ].join('\n');
    case 'qa':
      return [
        'Rozsah QA (povinné):',
        '- Iba čítanie a analýza. Žiadne zápisy do súborov.',
        '- Výstup bez kódu: žiadne ``` bloky, žiadny JSX/TS, žiadne copy-paste.',
        '- Formát: Zhrnutie → Nálezy (závažnosť, súbor, problém, odporúčanie) → Záver.'
      ].join('\n');
    default:
      return undefined;
  }
}

export function roleScopeViolationMessage(file: string, role: AgentRole): string {
  const scope = role === 'frontend' ? FRONTEND_PREFIXES.join(', ') : BACKEND_PREFIXES.join(', ');
  return `Cesta "${file}" je mimo rozsahu roly ${role}. Povolené prefixy: ${scope}`;
}