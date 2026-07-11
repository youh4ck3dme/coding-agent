# Coding Agent

This repository contains a local-first coding assistant built on the Mistral platform. It is designed as a monorepo with multiple packages, a command-line interface (CLI) and a Visual Studio Code extension. The assistant orchestrates conversations with Mistral models, executes safe local tooling via a **machine control protocol (MCP)** server, and provides an opinionated architecture for working on source code in a secure and auditable way.

## Features

- **Agent Core**: shared runtime that manages conversations, calls the Mistral Chat API and handles tool invocation and approval workflows.
- **Mistral Client**: thin wrapper around the Mistral API with configuration based on environment variables.
- **MCP Server**: local server exposing safe file and development tools with strict allowlists and path protection.
- **CLI**: a standalone command line application that lets you chat with the agent, request plans, apply patches and run verification tasks against your repository.
- **VS Code Extension**: an editor integration that leverages the shared agent core to provide chat and code modification within the editor.

## Getting Started

This project uses PNPM workspaces. Ensure you have [PNPM](https://pnpm.io/) installed before proceeding.

```bash
pnpm install
pnpm build
cp .env.example .env.local   # add MISTRAL_API_KEY

# Start MCP server + premium chat UI (http://127.0.0.1:3000)
pnpm dev

# Agent commands (auto-start MCP if needed)
pnpm dev ask "What does this module do?"
pnpm dev plan "Add a health endpoint"
pnpm dev apply "Add a comment to README"      # shows diff, asks y/N
pnpm dev apply --yes "Add a comment to README"

# Specialized agents
pnpm dev agent frontend "Add a dark-mode toggle"
pnpm dev agent backend "Add a preference endpoint"
pnpm dev agent qa "Review the dark-mode implementation"
pnpm dev parallel "Add a dark-mode preference" # parallel planning + QA review, without writes

# Status / stop
pnpm dev:status
pnpm dev:stop

# Do not use pnpm --filter ... dev directly

# Build the VS Code extension
pnpm --filter coding-agent-extension build
```

Environment variables must be provided via a local `.env.local` file (gitignored). Copy `.env.example` to `.env.local` and fill in your secrets.

## Výber lokálneho projektu

V pravom hornom rohu webového rozhrania je tlačidlo s aktuálne zvoleným projektom. Otvorí vyhľadateľný zoznam lokálnych repozitárov a projektov; výber určuje pracovný priestor pre všetky následné požiadavky agenta. Katalóg predvolene prehľadáva aktuálny workspace a priečinky `~/Projects`, `~/Developer`, `~/Code`, `~/Documents` a `~/Desktop`. Vlastné priečinky nastav cez `PROJECTS_ROOTS` v `.env.local`.

## Workspace Layout

```
coding-agent/
├── packages/
│   ├── agent-core/            # Reusable agent runtime, tool routing and approval workflow
│   ├── mistral-client/        # Mistral Chat API integration layer
│   ├── mcp-server/            # Local MCP server exposing safe developer tools
│   ├── tooling/               # Wrappers for git, lint, test and diff commands
│   ├── shared/                # Shared types, zod schemas, config and logger
│   ├── storage/               # Persistence adapters (uses SQLite via better-sqlite3)
│   ├── security/              # Policy engine, redaction, allowlists and approval guards
│   └── cli/                   # Command line interface
└── extensions/
    └── vscode/                # Visual Studio Code extension
```

## Testing

The monorepo has **79 automated tests** across all workspace packages. Run them with:

```bash
pnpm test
```

CI runs the same command on every push to `main`.

| Package | Tests | Focus |
|---------|------:|-------|
| `shared` | 3 | env config, MCP URL defaults |
| `security` | 5 | secret redaction, path allowlists |
| `mistral-client` | 3 | API request shape, error handling |
| `tooling` | 8 | git wrappers, pnpm/npm detection |
| `storage` | 2 | logs and approvals persistence |
| `agent-core` | 12 | role scope, tools, diff, MCP queue |
| `mcp-server` | 15 | errors, mutex, paths, projects |
| `cli` | 6 | approval prompt, role validation |
| `web` | 25 | ChatApp, XSS sanitization, auto-scroll |

### iPhone Air 17 viewport

Mobile layout is covered in `packages/web/src/components/ChatApp.iphone-air.test.tsx` using a **420×912** CSS viewport (DPR 3). Tests verify `100dvh` shell, project picker, mode switcher, chat submit, offline badge, and Enter-key send.

### VS Code extension — tests not required (for now)

The extension in `extensions/vscode/` is a thin wrapper (~95 lines) that registers three commands and delegates to `@coding-agent/agent-core`, which is already tested. Adding `@vscode/test-electron` would be heavy setup for little extra confidence. **Add extension tests later** when the extension grows (webview UI, diff preview, settings).

## Known Limitations

- The MCP server included here is intentionally minimal and should be extended to include additional tools following the safe patterns in `packages/mcp-server/src/index.ts`.
- The VS Code extension provides chat, plan and apply commands. Additional UI elements (diff previews) can be added for a complete experience.
- This repository does not include a web dashboard. If desired, one could be added as a separate package.

## License

This project is provided for educational and experimental purposes. Use at your own risk.