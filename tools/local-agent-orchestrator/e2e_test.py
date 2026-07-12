"""Repeatable end-to-end health check for every configured agent provider."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

from mistralai.client import Mistral

from orchestrator import (
    ROOT,
    AgentResult,
    load_settings,
    run_grok_heavy,
    run_process,
)


def redact(value: str) -> str:
    value = re.sub(r"gh[pousr]_[A-Za-z0-9_]+", "<redacted-github-token>", value)
    value = re.sub(r"(?i)(api[_-]?key[=: ]+)[^\s,;]+", r"\1<redacted>", value)
    return value[-1000:]


def validate_marker(result: AgentResult, marker: str) -> AgentResult:
    if result.status == "ok" and marker not in result.answer:
        result.status = "error"
        result.error = f"Provider odpovedal, ale chýba očakávaný marker {marker}"
    result.error = redact(result.error)
    return result


async def probe_mistral(settings: dict, marker: str) -> AgentResult:
    started = asyncio.get_running_loop().time()
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        return AgentResult("Mistral API", "unavailable", "", 0, 0.0, "Chýba MISTRAL_API_KEY")
    try:
        client = Mistral(api_key=api_key, timeout_ms=int(settings["timeout_seconds"]) * 1000)
        response = await client.chat.complete_async(
            model=str(settings["mistral_model"]),
            messages=[{"role": "user", "content": f"Reply exactly {marker}"}],
            max_tokens=40,
        )
        message = response.choices[0].message
        answer = message.content.strip() if message and isinstance(message.content, str) else ""
        elapsed = round(asyncio.get_running_loop().time() - started, 2)
        return validate_marker(AgentResult("Mistral API", "ok", answer, 1, elapsed), marker)
    except Exception as exc:
        elapsed = round(asyncio.get_running_loop().time() - started, 2)
        return AgentResult("Mistral API", "error", "", 1, elapsed, redact(str(exc)))


async def probe_ui(marker: str) -> AgentResult:
    started = asyncio.get_running_loop().time()

    def request() -> tuple[int, str]:
        with urlopen("http://127.0.0.1:3000", timeout=15) as response:
            return response.status, response.read(200).decode("utf-8", errors="replace")

    try:
        status, body = await asyncio.to_thread(request)
        elapsed = round(asyncio.get_running_loop().time() - started, 2)
        answer = marker if status == 200 and body else f"HTTP {status}"
        return validate_marker(AgentResult("UI + MCP HTTP", "ok", answer, 1, elapsed), marker)
    except Exception as exc:
        elapsed = round(asyncio.get_running_loop().time() - started, 2)
        return AgentResult("UI + MCP HTTP", "error", "", 1, elapsed, redact(str(exc)))


def classify_gemini(result: AgentResult) -> AgentResult:
    if result.status == "error" and (
        "IneligibleTierError" in result.error or "UNSUPPORTED_CLIENT" in result.error
    ):
        result.status = "blocked_external"
        result.error = "Google odmieta aktuálny účet: UNSUPPORTED_CLIENT/IneligibleTierError"
    return result


def write_report(results: list[AgentResult]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = ROOT / "runs" / f"e2e-{stamp}"
    run_dir.mkdir(parents=True, exist_ok=False)
    ok_count = sum(result.status == "ok" for result in results)
    blocked_count = sum(result.status == "blocked_external" for result in results)
    error_count = sum(result.status not in {"ok", "blocked_external"} for result in results)
    verdict = "PASS" if error_count == 0 and blocked_count == 0 else (
        "PASS_WITH_EXTERNAL_BLOCKER" if error_count == 0 else "FAIL"
    )

    rows = [
        "# Agent API E2E report",
        "",
        f"Verdikt: **{verdict}**",
        "",
        "| Provider | Stav | Čas | Pokusy | Detail |",
        "|---|---:|---:|---:|---|",
    ]
    for result in results:
        detail = result.error or result.answer.replace("\n", " ")[:160]
        rows.append(
            f"| {result.name} | {result.status} | {result.seconds:.2f}s | "
            f"{result.attempts} | {detail.replace('|', '/')} |"
        )
    rows.extend(
        [
            "",
            f"- OK: {ok_count}",
            f"- Externe blokované: {blocked_count}",
            f"- Chyby: {error_count}",
            "",
            "Gemini je externý blocker, kým Google účet nepodporí Gemini CLI alebo nebude nastavený GEMINI_API_KEY.",
        ]
    )
    (run_dir / "e2e-report.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    (run_dir / "e2e-results.json").write_text(
        json.dumps({"verdict": verdict, "results": [asdict(result) for result in results]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return run_dir


async def main_async(workspace: Path) -> int:
    settings = load_settings()
    timeout = int(settings["timeout_seconds"])
    retries = int(settings["retries"])
    markers = {
        "mistral": "E2E_MISTRAL_OK",
        "copilot": "E2E_COPILOT_OK",
        "grok": "E2E_GROK_OK",
        "gemini": "E2E_GEMINI_OK",
        "codex": "E2E_CODEX_OK",
        "claude": "E2E_CLAUDE_OK",
        "ui": "E2E_UI_OK",
    }

    copilot = run_process(
        "GitHub Copilot",
        ["copilot", "-p", f"Reply exactly {markers['copilot']}", "--allow-all-tools", "--deny-tool=shell", "--deny-tool=write", "--no-ask-user", "--no-color", "--silent"],
        cwd=workspace,
        timeout=timeout,
        retries=retries,
    )
    grok = run_grok_heavy(f"Reply exactly {markers['grok']}", workspace, settings)
    gemini = run_process(
        "Gemini CLI",
        ["gemini", "-p", f"Reply exactly {markers['gemini']}", "--output-format", "text", "--approval-mode", "plan", "--skip-trust"],
        cwd=workspace,
        timeout=timeout,
        retries=1,
        env_overrides={"GEMINI_CLI_SYSTEM_SETTINGS_PATH": str(ROOT / "gemini-settings.json")},
    )
    codex = run_process(
        "Codex CLI",
        ["codex", "exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", str(workspace), "-"],
        cwd=workspace,
        timeout=timeout,
        retries=retries,
        stdin_text=f"Reply exactly {markers['codex']}",
    )
    claude = run_process(
        "Claude Code",
        ["claude", "-p", f"Reply exactly {markers['claude']}", "--permission-mode", "plan", "--tools", "", "--no-session-persistence", "--output-format", "text", "--max-budget-usd", "0.05"],
        cwd=workspace,
        timeout=timeout,
        retries=retries,
    )

    results = list(
        await asyncio.gather(
            probe_ui(markers["ui"]),
            probe_mistral(settings, markers["mistral"]),
            copilot,
            grok,
            gemini,
            codex,
            claude,
        )
    )
    expected_markers = [
        markers["ui"],
        markers["mistral"],
        markers["copilot"],
        markers["grok"],
        markers["gemini"],
        markers["codex"],
        markers["claude"],
    ]
    results = [validate_marker(result, marker) for result, marker in zip(results, expected_markers)]
    results[4] = classify_gemini(results[4])
    run_dir = write_report(results)

    print("\nAgent API E2E výsledky:")
    for result in results:
        print(f"- {result.name}: {result.status} ({result.seconds}s, pokusy: {result.attempts})")
    print(f"\nReport: {run_dir / 'e2e-report.md'}")
    return 1 if any(result.status not in {"ok", "blocked_external"} for result in results) else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="E2E test všetkých agent API/CLI adaptérov")
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    return asyncio.run(main_async(args.workspace.resolve()))


if __name__ == "__main__":
    raise SystemExit(main())
