param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Task,
    [string]$Workspace = "."
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

uv run python orchestrator.py --task $Task --workspace $Workspace

