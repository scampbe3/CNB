$ErrorActionPreference = 'Stop'
$templates = Join-Path (Split-Path -Parent $PSScriptRoot) 'cms-templates'
$destination = Join-Path $templates 'portal-starter.zip'
$files = Get-ChildItem -LiteralPath $templates -Filter '*.csv' -File
if ($files.Count -ne 7) { throw 'Expected exactly seven CSV templates.' }
Compress-Archive -LiteralPath $files.FullName -DestinationPath $destination -Force
Write-Output "Workbook starter package: $destination"
Write-Output 'Use C+B Portal > Import starter ZIP in a new private workbook. Never replace live editorial tabs.'
