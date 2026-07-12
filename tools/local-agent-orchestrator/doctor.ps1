$ErrorActionPreference = "Continue"

Write-Output "=== Local AI Orchestrator Doctor ==="
foreach ($name in @("uv", "codex", "copilot", "grok", "gemini", "claude")) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
        Write-Output ("[OK] {0}" -f $name)
    } else {
        Write-Output ("[CHYBA] Chýba {0}" -f $name)
    }
}

$projectEnv = Join-Path $PSScriptRoot ".env"
$oldEnv = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "workflow\.env"
if ((Test-Path $projectEnv) -or (Test-Path $oldEnv) -or $env:MISTRAL_API_KEY) {
    Write-Output "[OK] Zdroj Mistral API kľúča existuje (hodnota je skrytá)"
} else {
    Write-Output "[CHYBA] Chýba MISTRAL_API_KEY"
}

Write-Output ""
Write-Output "Verzie:"
codex --version 2>&1
copilot --version 2>&1
grok --version 2>&1
gemini --version 2>&1
claude --version 2>&1

Write-Output ""
Write-Output "Ak Copilot hlási neprihlásenie, spusti: copilot login"
Write-Output "Ak Gemini hlási IneligibleTierError, použi GEMINI_API_KEY alebo podporovaný Google účet."
Write-Output "Ak Claude hlási neprihlásenie, spusti: claude auth login"
