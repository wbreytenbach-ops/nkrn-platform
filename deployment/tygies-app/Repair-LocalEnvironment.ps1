#requires -Version 5.1
[CmdletBinding()]
param([string]$ProjectRoot = 'C:\Users\WilcoB\Documents\Visual Studio Projects\NKRN')

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
$productionApi = 'https://portal.tygies.co.za'
$excluded = @('.git', 'node_modules', '.next', 'bin', 'obj', 'backups', 'backup')
$envFiles = New-Object System.Collections.Generic.List[string]
$pending = New-Object System.Collections.Generic.Stack[string]
$pending.Push($ProjectRoot)

while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop) {
        if ($item.PSIsContainer) {
            if ($excluded -notcontains $item.Name) { $pending.Push($item.FullName) }
        } elseif ($item.Name -eq '.env.local') {
            $envFiles.Add($item.FullName)
        }
    }
}

$webRoot = Join-Path $ProjectRoot 'web'
if (-not (Test-Path -LiteralPath $webRoot -PathType Container)) {
    throw 'web directory not found; no environment files changed.'
}
$webEnv = Join-Path $webRoot '.env.local'
if (-not ($envFiles -contains $webEnv)) { $envFiles.Add($webEnv) }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$updated = 0
foreach ($path in $envFiles) {
    $parent = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Parent directory missing for environment file: $path"
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $content = [System.IO.File]::ReadAllText($path)
    } else {
        $content = "# NKRN local environment" + ([string][char]13) + ([string][char]10)
    }

    $newline = [string][char]10
    if ($content.Contains(([string][char]13) + ([string][char]10))) {
        $newline = ([string][char]13) + ([string][char]10)
    }

    $line = "NEXT_PUBLIC_API_URL=$productionApi"
    if ($content -match '(?m)^\s*(?:export\s+)?NEXT_PUBLIC_API_URL\s*=.*$') {
        $content = [regex]::Replace(
            $content,
            '(?m)^\s*(?:export\s+)?NEXT_PUBLIC_API_URL\s*=.*$',
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line }
        )
    } else {
        if ($content.Length -gt 0 -and -not $content.EndsWith($newline)) {
            $content += $newline
        }
        $content += $line + $newline
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Copy-Item -LiteralPath $path -Destination "$path.bak-production-$stamp"
    }
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
    $updated++
    Write-Host ("Updated: " + $path)
}

Write-Host "Updated $updated environment file(s). API target: $productionApi"
Write-Host 'Backups were created for files that existed before this run.'
