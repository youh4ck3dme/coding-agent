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

## Stav poskytovateľov na tomto PC

- Mistral 3×: funkčný.
- Codex CLI: funkčný.
- Grok heavy režim: funkčný; jeden test best-of-3 trval približne tri minúty.
- Copilot CLI: nainštalovaný, ale potrebuje vlastné OAuth prihlásenie. Spusti `copilot login` a potvrď ho v prehliadači. Classic `ghp_` token Copilot nepodporuje.
- Gemini CLI: adaptér je pripravený, ale v `config.json` je dočasne vypnutý (`enable_gemini: false`), pretože Google server vrátil `IneligibleTierError` pre aktuálny osobný účet. Po nastavení podporovaného účtu alebo `GEMINI_API_KEY` ho zapni hodnotou `true`.
- Claude Code: nainštalovaný, bezpečný adaptér je zapojený, ale treba dokončiť `claude auth login`. Beží v režime `plan`, bez nástrojov, bez perzistencie relácie a s limitom 0,25 USD na jeden beh.

Ak Copilot alebo Gemini nie sú autorizované, flow sa nezastaví. Ich stav bude `error` v `diagnostics.json` a finálnu odpoveď zostavia úspešní agenti.

## Bezpečnosť

- Predvolený režim agentom nedáva oprávnenie zapisovať do analyzovaného projektu.
- Do úlohy nevkladaj heslá, API kľúče ani osobné údaje.
- Výstupy zostávajú lokálne v `runs/`, ale požiadavky sa odosielajú poskytovateľom jednotlivých modelov.
- Orchestrátor zámerne nevykonáva automaticky odporúčané zmeny. Najprv ich skontroluje človek.
