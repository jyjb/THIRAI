#Requires -Version 5
<#
.SYNOPSIS
  Vendors the published LOCALSERVER tools (self-contained local host + browser test
  runner) into studio/build_test/localserver/<version>/. Re-runnable: wipes and refreshes.

.DESCRIPTION
  Studio consumes LOCALSERVER as a BINARY, never as a source/project reference. Build the
  binary once in the LOCALSERVER repo (build_test/publish.ps1), then run this to copy it in.
  The vendored folder is git-ignored.

.EXAMPLE
  ./pull-localserver.ps1
  ./pull-localserver.ps1 -Source D:\builds\localserver\release\v1
#>
[CmdletBinding()]
param(
    # Default: sibling checkout at ..\..\..\LOCALSERVER\release\v1 (i.e. _repos\LOCALSERVER).
    [string]$Source = (Join-Path $PSScriptRoot '..\..\..\LOCALSERVER\release\v1'),
    [string]$Version = 'v1'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Source)) {
    throw "LOCALSERVER publish not found at '$Source'. Run LOCALSERVER/build_test/publish.ps1 first, or pass -Source."
}
$src = (Resolve-Path $Source).Path

$dest = Join-Path (Join-Path $PSScriptRoot 'localserver') $Version
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host "Vendoring $src -> $dest" -ForegroundColor Cyan
Copy-Item -Path (Join-Path $src '*') -Destination $dest -Recurse -Force

$srvExe = Join-Path $dest 'server\genericHost.exe'
$runExe = Join-Path $dest 'testrunner\WebTestRunner.exe'
if (-not (Test-Path $srvExe)) { throw "missing after copy: $srvExe" }
if (-not (Test-Path $runExe)) { throw "missing after copy: $runExe" }

Write-Host "Vendored LOCALSERVER ${Version}:" -ForegroundColor Green
Write-Host "  host   : $srvExe"
Write-Host "  runner : $runExe"
