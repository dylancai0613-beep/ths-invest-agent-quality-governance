param([int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$npmShim = 'D:\Codex\envs\npm-shim'
if (Test-Path -LiteralPath $npmShim) { $env:Path = $npmShim + ';' + $env:Path }
$env:npm_config_cache = 'D:\Codex\cache\npm'
if (-not (Test-Path -LiteralPath 'node_modules')) { throw '请先安装依赖。参见 README。' }
node scripts/run-framework.mjs dev --port $Port
