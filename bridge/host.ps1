$ErrorActionPreference = "Stop"
$assemblies = @(
  "System.Core", "Microsoft.CSharp", "System.Drawing", "System.Windows.Forms", "System.Management",
  "System.Web.Extensions", "WindowsBase", "UIAutomationClient", "UIAutomationTypes"
)
$references = foreach ($name in $assemblies) { [System.Reflection.Assembly]::LoadWithPartialName($name).Location }
$sources = @(Get-ChildItem -Path $PSScriptRoot -Filter "*.cs" | Sort-Object Name)

$sha = [System.Security.Cryptography.SHA256]::Create()
$text = ($sources | ForEach-Object { [System.IO.File]::ReadAllText($_.FullName) }) -join "|"
$hash = -join ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text))[0..7] | ForEach-Object { $_.ToString("x2") })
$cacheDir = Join-Path $env:LOCALAPPDATA "pc-mcp"
$assembly = Join-Path $cacheDir "bridge-$hash.dll"

if (Test-Path -LiteralPath $assembly) {
  Add-Type -Path $assembly
} else {
  [void](New-Item -ItemType Directory -Force -Path $cacheDir)
  Get-ChildItem -Path $cacheDir -Filter "bridge-*.dll" | Remove-Item -Force -ErrorAction SilentlyContinue
  Add-Type -Path $sources.FullName -ReferencedAssemblies $references -OutputAssembly $assembly
  Add-Type -Path $assembly
}
[PcBridge]::Run()
