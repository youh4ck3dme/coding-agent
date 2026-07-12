param(
    [string]$Workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

uv run --project $ProjectDir python (Join-Path $ProjectDir "e2e_test.py") --workspace $Workspace
