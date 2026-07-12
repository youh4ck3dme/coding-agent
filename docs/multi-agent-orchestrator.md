# Local multi-agent orchestrator

## Why it belongs in this repository

`coding-agent` is the right home because it already owns the local agent runtime, MCP server, security policy, audit storage, CLI and editor integration. The orchestrator is an optional tool under `tools/`; it does not replace the existing Mistral-based product or introduce a second application repository.

## How one run works

```text
User task
   |
   +-- Mistral architect ------+
   +-- Mistral critic ---------+
   +-- Mistral implementer ----+
   +-- GitHub Copilot ---------+
   +-- Grok best-of-3 ---------+--> Mistral final editor --> runs/<time>/final.md
   +-- Gemini CLI -------------+                         +-> diagnostics.json
   +-- Codex CLI --------------+                         +-> one file per agent
   +-- Claude Code ------------+
```

All advisers run concurrently. Each provider has a timeout and two attempts. A provider failure becomes a diagnostic result instead of aborting the run. The final editor receives only successful answers, removes duplicates, marks uncertainty and writes one Slovak response.

## Agent responsibilities

| Agent | Role | Default safety mode |
|---|---|---|
| Mistral architect | Architecture and decomposition | API text response only |
| Mistral critic | Failure, security and correctness review | API text response only |
| Mistral implementer | Smallest practical implementation | API text response only |
| Copilot | Independent coding recommendation | shell and write tools denied |
| Grok | Heavy review through three isolated parallel `grok-composer-2.5-fast` candidates | plan mode |
| Gemini | Long-context independent review | plan mode |
| Codex | Repository-aware coding review | read-only sandbox, ephemeral session |
| Claude | Independent architecture and code review | plan mode, no tools, no persistence, USD cap |

The current version deliberately produces advice rather than applying changes. A later implementation phase should be a separate, human-approved workflow using the repository's existing MCP security and diff approval system.

## Setup

From the repository root:

```powershell
cd tools/local-agent-orchestrator
Copy-Item .env.example .env
# Edit .env and add a fresh MISTRAL_API_KEY.
uv sync
cd ../..
pnpm orchestrator:doctor
```

Authenticate the provider CLIs once:

```powershell
claude auth login
copilot login
grok login
gemini
```

Codex uses its existing desktop/CLI authentication. Gemini can alternatively use `GEMINI_API_KEY`. Never commit `.env` or paste keys into tasks.

Gemini is disabled by default in `config.json` because the currently configured personal account is rejected by Google's service. Set `enable_gemini` to `true` only after authentication works.

Run `pnpm orchestrator:e2e` to test the UI/MCP endpoint and every provider adapter with unique response markers. The command writes a Markdown report and JSON evidence under `tools/local-agent-orchestrator/runs/e2e-<time>/`. A provider rejected by its external account tier is reported as `blocked_external`, separately from local implementation errors.

## Run

```powershell
pnpm orchestrator "Review this repository and propose the safest next change"
```

To inspect another local repository, call the PowerShell launcher directly:

```powershell
.\tools\local-agent-orchestrator\run.ps1 `
  "Review architecture and list the three highest-impact improvements" `
  -Workspace "C:\path\to\another-repository"
```

## Output and audit

Every execution creates a timestamped directory under `tools/local-agent-orchestrator/runs/`:

- `final.md`: merged user-facing answer;
- `diagnostics.json`: status, duration, attempts and errors for every provider;
- one Markdown file per provider: raw answer or a concise failure record.

`runs/`, `.env` and `.venv/` are ignored by Git.

## Next architecture step

Keep the Python adapter as an experimental tool first. After its provider contracts stabilize, move the subprocess adapters behind a TypeScript interface in `packages/agent-core`, persist run metadata through `packages/storage`, enforce provider/tool permissions through `packages/security`, and expose orchestration through `packages/cli` and the web UI. This staged migration avoids coupling the stable product to rapidly changing third-party CLI flags.
