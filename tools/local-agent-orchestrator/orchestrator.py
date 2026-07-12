"""Bezpečný lokálny orchestrátor viacerých AI CLI a Mistral API."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from mistralai.client import Mistral


ROOT = Path(__file__).resolve().parent


@dataclass
class AgentResult:
    name: str
    status: str
    answer: str
    attempts: int
    seconds: float
    error: str = ""


def load_settings() -> dict[str, Any]:
    settings = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    load_dotenv(ROOT / ".env")
    # Dočasná kompatibilita s už vytvoreným Mistral Workflows projektom.
    if not os.getenv("MISTRAL_API_KEY"):
        load_dotenv(ROOT.parent.parent / "workflow" / ".env")
    return settings


def role_prompt(task: str, role: str) -> str:
    return f"""Sme tím AI agentov. Pracuješ iba ako poradca a nemeníš súbory.

Tvoja rola: {role}
Úloha používateľa: {task}

Vráť stručný, konkrétny návrh v slovenčine. Uveď:
1. odporúčané riešenie,
2. riziká alebo chyby,
3. čo treba overiť.
Nevymýšľaj výsledky testov ani fakty, ktoré si neoveril.
"""


async def run_process(
    name: str,
    command: list[str],
    *,
    cwd: Path,
    timeout: int,
    retries: int,
    stdin_text: str | None = None,
    env_overrides: dict[str, str] | None = None,
) -> AgentResult:
    started = asyncio.get_running_loop().time()
    last_error = ""
    executable = shutil.which(command[0])
    if executable is None:
        return AgentResult(name, "unavailable", "", 0, 0.0, f"Chýba príkaz: {command[0]}")

    for attempt in range(1, retries + 1):
        try:
            process = await asyncio.create_subprocess_exec(
                executable,
                *command[1:],
                cwd=str(cwd),
                stdin=asyncio.subprocess.PIPE if stdin_text is not None else asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, **(env_overrides or {})},
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(stdin_text.encode("utf-8") if stdin_text is not None else None),
                timeout=timeout,
            )
            out = stdout.decode("utf-8", errors="replace").strip()
            err = stderr.decode("utf-8", errors="replace").strip()
            if process.returncode == 0 and out:
                elapsed = asyncio.get_running_loop().time() - started
                return AgentResult(name, "ok", out, attempt, round(elapsed, 2))
            last_error = f"exit={process.returncode}; {err or out}"[-3000:]
        except TimeoutError:
            process.kill()
            await process.wait()
            last_error = f"Timeout po {timeout} sekundách"
        except Exception as exc:  # pokračujeme aj pri chybe jedného agenta
            last_error = f"{type(exc).__name__}: {exc}"

        if attempt < retries:
            await asyncio.sleep(2 ** (attempt - 1))

    elapsed = asyncio.get_running_loop().time() - started
    return AgentResult(name, "error", "", retries, round(elapsed, 2), last_error)


async def run_grok_heavy(
    prompt: str,
    workspace: Path,
    settings: dict[str, Any],
) -> AgentResult:
    """Run isolated Grok candidates without the CLI's interleaved best-of-n output."""
    started = asyncio.get_running_loop().time()
    candidate_count = int(settings.get("grok_best_of_n", 3))
    candidate_jobs = []
    for candidate_number in range(1, candidate_count + 1):
        candidate_prompt = (
            f"{prompt}\n\n"
            f"Si nezávislý Grok kandidát {candidate_number}/{candidate_count}. "
            "Vráť iba svoj čistý finálny návrh. Nespúšťaj subagentov a neopisuj interný postup."
        )
        candidate_jobs.append(
            run_process(
                f"Grok kandidát {candidate_number}",
                [
                    "grok",
                    "--single",
                    candidate_prompt,
                    "--model",
                    str(settings["grok_model"]),
                    "--permission-mode",
                    "plan",
                    "--no-subagents",
                    "--output-format",
                    "plain",
                    "--cwd",
                    str(workspace),
                ],
                cwd=workspace,
                timeout=int(settings["timeout_seconds"]),
                retries=int(settings["retries"]),
            )
        )

    candidates = list(await asyncio.gather(*candidate_jobs))
    successful = [candidate for candidate in candidates if candidate.status == "ok"]
    elapsed = round(asyncio.get_running_loop().time() - started, 2)
    if not successful:
        errors = "; ".join(candidate.error for candidate in candidates if candidate.error)
        return AgentResult(
            "Grok Heavy (3 kandidáti)",
            "error",
            "",
            max((candidate.attempts for candidate in candidates), default=0),
            elapsed,
            errors[-3000:],
        )

    answer = "\n\n".join(
        f"## Grok kandidát {index}\n{candidate.answer}"
        for index, candidate in enumerate(successful, start=1)
    )
    return AgentResult(
        "Grok Heavy (3 kandidáti)",
        "ok",
        answer,
        max(candidate.attempts for candidate in successful),
        elapsed,
    )


async def run_mistral(
    name: str,
    role: str,
    task: str,
    settings: dict[str, Any],
) -> AgentResult:
    started = asyncio.get_running_loop().time()
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        return AgentResult(name, "unavailable", "", 0, 0.0, "Chýba MISTRAL_API_KEY")

    last_error = ""
    for attempt in range(1, int(settings["retries"]) + 1):
        try:
            client = Mistral(api_key=api_key, timeout_ms=int(settings["timeout_seconds"]) * 1000)
            response = await client.chat.complete_async(
                model=str(settings["mistral_model"]),
                messages=[{"role": "user", "content": role_prompt(task, role)}],
                max_tokens=1400,
            )
            message = response.choices[0].message
            if message and isinstance(message.content, str) and message.content.strip():
                elapsed = asyncio.get_running_loop().time() - started
                return AgentResult(name, "ok", message.content.strip(), attempt, round(elapsed, 2))
            last_error = "Mistral nevrátil text"
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        if attempt < int(settings["retries"]):
            await asyncio.sleep(2 ** (attempt - 1))

    elapsed = asyncio.get_running_loop().time() - started
    return AgentResult(name, "error", "", int(settings["retries"]), round(elapsed, 2), last_error[-3000:])


async def synthesize(task: str, results: list[AgentResult], settings: dict[str, Any]) -> str:
    successful = [r for r in results if r.status == "ok"]
    if not successful:
        return "Žiadny agent nevrátil použiteľnú odpoveď. Pozri diagnostics.json."

    limit = int(settings["max_answer_chars"])
    evidence = "\n\n".join(
        f"### {result.name}\n{result.answer[:limit]}" for result in successful
    )
    prompt = f"""Si hlavný editor tímu AI agentov.
Používateľova úloha: {task}

Nižšie sú nezávislé návrhy. Vytvor jednu finálnu odpoveď v slovenčine.
Odstráň duplicity, označ neistoty a nedovoľ, aby hlasovanie nahradilo dôkazy.
Začni výsledkom, potom uveď odporúčaný postup a nakoniec krátke riziká.

{evidence}
"""
    final = await run_mistral("Mistral final editor", "hlavný editor", prompt, settings)
    if final.status == "ok":
        return final.answer
    return "\n\n".join(f"## {r.name}\n{r.answer}" for r in successful)


async def orchestrate(task: str, workspace: Path) -> Path:
    settings = load_settings()
    timeout = int(settings["timeout_seconds"])
    retries = int(settings["retries"])
    workspace = workspace.resolve()
    if not workspace.exists() or not workspace.is_dir():
        raise ValueError(f"Workspace neexistuje alebo nie je priečinok: {workspace}")

    # Classic GitHub PAT (ghp_) Copilot nepodporuje. Použije iba vlastné OAuth
    # prihlásenie alebo používateľom dodaný fine-grained token.
    for token_name in ("GH_TOKEN", "GITHUB_TOKEN"):
        if os.getenv(token_name, "").startswith("ghp_"):
            os.environ.pop(token_name, None)

    roles = [
        ("Mistral architekt", "navrhni architektúru a rozdelenie krokov"),
        ("Mistral kritik", "hľadaj chyby, bezpečnostné riziká a slabé miesta"),
        ("Mistral realizátor", "navrhni najjednoduchšiu praktickú implementáciu"),
    ]
    prompt = role_prompt(task, "nezávislý technický poradca")
    jobs = [run_mistral(name, role, task, settings) for name, role in roles]
    jobs.extend(
        [
            run_process(
                "GitHub Copilot",
                ["copilot", "-p", prompt, "--allow-all-tools", "--deny-tool=shell", "--deny-tool=write", "--no-ask-user", "--no-color", "--silent"],
                cwd=workspace,
                timeout=timeout,
                retries=retries,
            ),
            run_grok_heavy(prompt, workspace, settings),
            run_process(
                "Codex CLI",
                ["codex", "exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", str(workspace), "-"],
                cwd=workspace,
                timeout=timeout,
                retries=retries,
                stdin_text=prompt,
            ),
            run_process(
                "Claude Code",
                [
                    "claude",
                    "-p",
                    prompt,
                    "--permission-mode",
                    "plan",
                    "--tools",
                    "",
                    "--no-session-persistence",
                    "--output-format",
                    "text",
                    "--max-budget-usd",
                    "0.25",
                ],
                cwd=workspace,
                timeout=timeout,
                retries=retries,
            ),
        ]
    )
    if bool(settings.get("enable_gemini", False)):
        jobs.append(
            run_process(
                "Gemini CLI",
                ["gemini", "-p", prompt, "--output-format", "text", "--approval-mode", "plan", "--skip-trust"],
                cwd=workspace,
                timeout=timeout,
                retries=retries,
                env_overrides={"GEMINI_CLI_SYSTEM_SETTINGS_PATH": str(ROOT / "gemini-settings.json")},
            )
        )

    print(f"Spúšťam {len(jobs)} agentov paralelne…", flush=True)
    results = list(await asyncio.gather(*jobs))
    final_answer = await synthesize(task, results, settings)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = ROOT / "runs" / stamp
    run_dir.mkdir(parents=True, exist_ok=False)
    (run_dir / "final.md").write_text(final_answer + "\n", encoding="utf-8")
    (run_dir / "diagnostics.json").write_text(
        json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    for result in results:
        safe_name = result.name.lower().replace(" ", "-").replace("(", "").replace(")", "")
        (run_dir / f"{safe_name}.md").write_text(
            result.answer or f"STATUS: {result.status}\nERROR: {result.error}\n",
            encoding="utf-8",
        )

    print("\nStav agentov:")
    for result in results:
        print(f"- {result.name}: {result.status} ({result.seconds}s, pokusy: {result.attempts})")
    print(f"\nFinálny výsledok: {run_dir / 'final.md'}")
    return run_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="Lokálny tím AI agentov")
    parser.add_argument("--task", required=True, help="Úloha pre tím")
    parser.add_argument("--workspace", default=".", help="Priečinok, ktorý smú agenti čítať")
    args = parser.parse_args()
    try:
        asyncio.run(orchestrate(args.task, Path(args.workspace)))
        return 0
    except KeyboardInterrupt:
        print("Prerušené používateľom.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"CHYBA: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
