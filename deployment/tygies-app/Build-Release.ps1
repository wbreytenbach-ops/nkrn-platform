# Run on Wilco's Windows development PC. This does not contact the live server.
#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\Users\WilcoB\Documents\Visual Studio Projects\NKRN',
    [string]$OutputRoot = (Join-Path $env:USERPROFILE 'NKRN-Releases')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$apiUrl = 'https://portal.tygies.co.za'
$serverRuntime = [version]'10.0.11'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. Release was NOT completed."
    }
}

function Copy-Tree {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Required build directory is missing: $Source"
    }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy.exe $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -ge 8) {
        throw "Copy failed with robocopy exit code $LASTEXITCODE."
    }
}

function New-BrandIcon {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath,
        [Parameter(Mandatory = $true)][int]$Size,
        [double]$Scale = 0.82
    )

    $sourceImage = $null
    $bitmap = $null
    $graphics = $null

    try {
        $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
        $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $fitSize = $Size * $Scale
        $ratio = [Math]::Min(($fitSize / $sourceImage.Width), ($fitSize / $sourceImage.Height))
        $width = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $ratio))
        $height = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $ratio))
        $left = [int][Math]::Floor(($Size - $width) / 2)
        $top = [int][Math]::Floor(($Size - $height) / 2)

        $graphics.DrawImage($sourceImage, $left, $top, $width, $height)
        $bitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        if ($graphics) { $graphics.Dispose() }
        if ($bitmap) { $bitmap.Dispose() }
        if ($sourceImage) { $sourceImage.Dispose() }
    }
}

if ($env:OS -ne 'Windows_NT') { throw 'Build this package on Windows for the Windows server.' }
foreach ($program in @('git.exe', 'node.exe', 'npm.cmd', 'dotnet.exe', 'robocopy.exe')) {
    Get-Command $program -ErrorAction Stop | Out-Null
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
$OutputRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputRoot)
$head = (& git.exe -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -notmatch ('^[a-f0-9]{40}' + '$')) {
    throw 'Cannot read a valid full Git commit SHA.'
}
$branch = (& git.exe -C $ProjectRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'logistics-release-candidate-20261009') {
    throw ("Build only from logistics-release-candidate-20261009; current branch is '" + $branch + "'.")
}
$trackedChanges = & git.exe -C $ProjectRoot status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0 -or $trackedChanges) {
    throw 'Tracked files have uncommitted changes. Commit or revert them before building.'
}
$commit = $head
$shortCommit = $commit.Substring(0, 7)

$nodeVersionText = & node.exe --version
if ($LASTEXITCODE -ne 0) { throw 'Node could not start.' }
$nodeVersion = [version]($nodeVersionText.Trim().TrimStart('v'))
if (@(22,24) -notcontains $nodeVersion.Major) { throw 'Use Node 22 or 24 on this PC.' }
$sdkVersion = & dotnet.exe --version
if ($LASTEXITCODE -ne 0 -or $sdkVersion -notmatch '^10\.') {
    throw 'The .NET 10 SDK is required on the build PC.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$releaseId = 'NKRN-' + $shortCommit + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
$workRoot = Join-Path $OutputRoot $releaseId
$sourceRoot = Join-Path $workRoot 'source'
$packageRoot = Join-Path $workRoot 'package'
$sourceZip = Join-Path $workRoot 'source.zip'
$releaseZip = Join-Path $workRoot ($releaseId + '.zip')
New-Item -ItemType Directory -Path $sourceRoot, $packageRoot -Force | Out-Null

Write-Host 'Exporting the committed source. Local .env files and untracked helpers are not used.'
Invoke-Checked 'git.exe' @('-C', $ProjectRoot, 'archive', '--format=zip', ('--output=' + $sourceZip), $commit, 'api', 'web', 'tests', 'docs')
[System.IO.Compression.ZipFile]::ExtractToDirectory($sourceZip, $sourceRoot)

$webRoot = Join-Path $sourceRoot 'web'
$apiProject = Join-Path $sourceRoot 'api\NKRN.API\NKRN.API.csproj'
$apiOutput = Join-Path $packageRoot 'api'
$frontendOutput = Join-Path $packageRoot 'frontend'
$oldApiUrl = [Environment]::GetEnvironmentVariable('NEXT_PUBLIC_API_URL', 'Process')
$oldNodeEnv = [Environment]::GetEnvironmentVariable('NODE_ENV', 'Process')
$oldTelemetry = [Environment]::GetEnvironmentVariable('NEXT_TELEMETRY_DISABLED', 'Process')

try {
    # Create correctly sized Tygerpoort PWA/browser icons from the repository logo.
    Add-Type -AssemblyName System.Drawing
    $brandLogo = Join-Path $webRoot 'public\tygie-logo.png'
    if (-not (Test-Path -LiteralPath $brandLogo -PathType Leaf)) {
        throw "Tygerpoort logo source is missing: $brandLogo"
    }
    New-BrandIcon -SourcePath $brandLogo -DestinationPath (Join-Path $webRoot 'public\icon-32x32.png') -Size 32
    New-BrandIcon -SourcePath $brandLogo -DestinationPath (Join-Path $webRoot 'public\icon-192x192.png') -Size 192
    New-BrandIcon -SourcePath $brandLogo -DestinationPath (Join-Path $webRoot 'public\icon-512x512.png') -Size 512
    New-BrandIcon -SourcePath $brandLogo -DestinationPath (Join-Path $webRoot 'public\icon-maskable-512x512.png') -Size 512 -Scale 0.68
    New-BrandIcon -SourcePath $brandLogo -DestinationPath (Join-Path $webRoot 'public\apple-touch-icon.png') -Size 180

    $env:NEXT_PUBLIC_API_URL = $apiUrl
    $env:NEXT_TELEMETRY_DISABLED = '1'
    [Environment]::SetEnvironmentVariable('NODE_ENV', $null, 'Process')
    Push-Location -LiteralPath $webRoot
    try {
        Invoke-Checked 'npm.cmd' @('ci', '--include=dev')
        Invoke-Checked 'npm.cmd' @('run', 'lint')
        $env:NODE_ENV = 'production'
        Invoke-Checked 'npm.cmd' @('run', 'build')
    }
    finally { Pop-Location }

    Copy-Tree (Join-Path $webRoot '.next\standalone') $frontendOutput
    Copy-Tree (Join-Path $webRoot '.next\static') (Join-Path $frontendOutput '.next\static')
    Copy-Tree (Join-Path $webRoot 'public') (Join-Path $frontendOutput 'public')
    foreach ($relative in @('server.js', '.next\BUILD_ID', 'public\sw.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $frontendOutput $relative) -PathType Leaf)) {
            throw "Incomplete standalone frontend: $relative is missing."
        }
    }
    $urlEvidence = Get-ChildItem -LiteralPath (Join-Path $frontendOutput '.next\static') -Recurse -File -Filter '*.js' |
        Select-String -SimpleMatch -Pattern $apiUrl -List | Select-Object -First 1
    if ($null -eq $urlEvidence) { throw 'The expected production API address was not found in the browser build.' }

    Invoke-Checked 'dotnet.exe' @('publish', $apiProject, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'false', '-p:UseAppHost=false', '-o', $apiOutput)
    $runtimeFile = Join-Path $apiOutput 'NKRN.API.runtimeconfig.json'
    $runtime = Get-Content -LiteralPath $runtimeFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($runtime.runtimeOptions.PSObject.Properties.Name -contains 'frameworks') {
        $frameworks = @($runtime.runtimeOptions.frameworks)
    }
    else { $frameworks = @($runtime.runtimeOptions.framework) }
    foreach ($framework in $frameworks) {
        $minimum = [version]$framework.version
        if ($minimum.Major -ne 10 -or $minimum -gt $serverRuntime) {
            throw "Build needs $($framework.name) $minimum; server reported $serverRuntime. Check the Hosting Bundle before deployment."
        }
    }
    [xml]$apiConfig = [System.IO.File]::ReadAllText((Join-Path $apiOutput 'web.config'))
    $handler = $apiConfig.SelectSingleNode('//aspNetCore')
    if ($null -eq $handler -or $handler.GetAttribute('arguments') -notmatch 'NKRN\.API\.dll') {
        throw 'The published API web.config does not launch NKRN.API.dll.'
    }
    if (@(Get-ChildItem -LiteralPath $apiOutput -File -Filter 'appsettings*.json').Count -gt 0) {
        throw 'Unexpected appsettings files in the build. Review them before creating a release containing configuration.'
    }
    Copy-Tree (Join-Path $sourceRoot 'api\NKRN.API\Database') (Join-Path $packageRoot 'database')

    # This historical script reassigns Logistics management to mcarnie and changes
    # daily job-card scheduling. It is deliberately excluded from release packages.
    $excludedManagerScheduleScript = Join-Path $packageRoot 'database\20260916_LogisticsManagerAndSchedule.sql'
    if (Test-Path -LiteralPath $excludedManagerScheduleScript -PathType Leaf) {
        Remove-Item -LiteralPath $excludedManagerScheduleScript -Force
    }
    if (Test-Path -LiteralPath $excludedManagerScheduleScript) {
        throw 'Unsafe historical manager/schedule SQL must not be included in a release package.'
    }

    $manifest = [ordered]@{
        release = $releaseId
        commit = $commit
        branch = $branch
        publicApiUrl = $apiUrl
        createdUtc = [DateTime]::UtcNow.ToString('o')
        buildPlatform = 'Windows'
        nodeVersion = $nodeVersionText.Trim()
        dotnetSdk = $sdkVersion.Trim()
        frameworkDependent = $true
        expectedServerRuntime = $serverRuntime.ToString()
        databaseApplied = $false
        excludedDatabaseScripts = @('20260916_LogisticsManagerAndSchedule.sql')
        deployed = $false
    }
    $json = $manifest | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $packageRoot 'release.json'), $json, [System.Text.UTF8Encoding]::new($false))
    # ZipFile includes .next and all runtime files. No source/config overlays from the live server.
    [System.IO.Compression.ZipFile]::CreateFromDirectory($packageRoot, $releaseZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    $hash = (Get-FileHash -LiteralPath $releaseZip -Algorithm SHA256).Hash
    [System.IO.File]::WriteAllText(($releaseZip + '.sha256.txt'), ($hash + '  ' + [System.IO.Path]::GetFileName($releaseZip)), [System.Text.UTF8Encoding]::new($false))
    Write-Host ''
    Write-Host 'RELEASE PACKAGE READY' -ForegroundColor Green
    Write-Host "ZIP: $releaseZip"
    Write-Host "SHA256: $hash"
    Write-Host 'Next: copy the ZIP and its .sha256.txt file to C:\NKRN-Deploy on TYGIES-APP.'
    Write-Host 'No files on the live server or database have been changed by this script.'
}
finally {
    [Environment]::SetEnvironmentVariable('NEXT_PUBLIC_API_URL', $oldApiUrl, 'Process')
    [Environment]::SetEnvironmentVariable('NODE_ENV', $oldNodeEnv, 'Process')
    [Environment]::SetEnvironmentVariable('NEXT_TELEMETRY_DISABLED', $oldTelemetry, 'Process')
}
