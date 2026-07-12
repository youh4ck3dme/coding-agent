# Lokálny AI tím

Jeden dirigent spustí osem poradcov naraz:

- Mistral architekt,
- Mistral kritik,
- Mistral realizátor,
- GitHub Copilot,
- Grok Heavy režim (`grok-build`, best-of-3 a kontrola),
- Gemini CLI,
- Codex CLI.
- Claude Code.

Agenti predvolene iba čítajú a radia. Jeden chybný agent nezastaví ostatných. Každý má timeout a dva pokusy. Na konci Mistral editor spojí úspešné odpovede do `runs/<čas>/final.md`; `diagnostics.json` ukáže stav všetkých agentov.

## Spustenie

V PowerShelli:

```powershell
cd C:\Users\Admin\Documents\Codex\2026-07-12\build-your-first-workflow-create-reliable\outputs\local-agent-orchestrator
.\run.ps1 "Navrhni jednoduchú webovú aplikáciu na rodinné úlohy"
```

Analýza konkrétneho projektu:

```powershell
.\run.ps1 "Skontroluj architektúru a navrhni tri najdôležitejšie zlepšenia" -Workspace "C:\cesta\k\projektu"
```

## Nastavenia

V `config.json` môžeš meniť timeout, počet pokusov a modely. Grok účet momentálne neponúka model s doslovným názvom `heavy`, preto sa používa dostupný `grok-build` s tromi kandidátmi a sebakontrolou.

Vytvor nový kľúč, skopíruj `.env.example` ako `.env` a vlož ho tam. Lokálny `.env` Git ignoruje.

Diagnostiku inštalácie spustíš bez odhalenia kľúčov:

```powershell
.\doctor.ps1
```

Skutočný E2E test UI, Mistral API a všetkých CLI agentov spustíš:

```powershell
pnpm orchestrator:e2e
```

Test vyžaduje od každého providera unikátny marker a vytvorí `runs/e2e-<čas>/e2e-report.md` aj strojovo čitateľný `e2e-results.json`. Stav `blocked_external` znamená, že lokálny adaptér je dostupný, ale účet poskytovateľa odmietol požiadavku.

## Stav poskytovateľov na tomto PC

- Mistral 3×: funkčný.
- Codex CLI: funkčný.
- Grok heavy režim: tri izolované Grok procesy bežia paralelne. Finálny Mistral editor ich vyhodnotí spolu s ostatnými odpoveďami; nepoužíva sa chybný vstavaný `--best-of-n`, ktorý vo verzii 0.2.93 mieša výstupy kandidátov.
- Copilot CLI: funkčný cez vlastné OAuth prihlásenie (`copilot login`). Classic `ghp_` token Copilot nepodporuje.
- Gemini CLI: adaptér je pripravený, ale v `config.json` je dočasne vypnutý (`enable_gemini: false`), pretože Google server vrátil `IneligibleTierError` pre aktuálny osobný účet. Po nastavení podporovaného účtu alebo `GEMINI_API_KEY` ho zapni hodnotou `true`.
- Claude Code: funkčný. Beží v režime `plan`, bez nástrojov, bez perzistencie relácie a s limitom 0,25 USD na jeden beh.

Ak Copilot alebo Gemini nie sú autorizované, flow sa nezastaví. Ich stav bude `error` v `diagnostics.json` a finálnu odpoveď zostavia úspešní agenti.

## Bezpečnosť

- Predvolený režim agentom nedáva oprávnenie zapisovať do analyzovaného projektu.
- Do úlohy nevkladaj heslá, API kľúče ani osobné údaje.
- Výstupy zostávajú lokálne v `runs/`, ale požiadavky sa odosielajú poskytovateľom jednotlivých modelov.
- Orchestrátor zámerne nevykonáva automaticky odporúčané zmeny. Najprv ich skontroluje človek.
