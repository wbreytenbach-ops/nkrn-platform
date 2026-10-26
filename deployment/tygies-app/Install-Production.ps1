#requires -Version 5.1
<#
    Tygies One Windows production installer
    Run after extracting the matching GitHub Actions installer ZIP.
    Keeps the existing email-based Tygies One login.
    Does not execute SQL migrations, overwrite live appsettings,
    or delete existing user requests.
#>
[CmdletBinding()]
param(
    [string]$ReleaseZip = '',
    [string]$Server = 'TYGIES-APP'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
if ($env:OS -ne 'Windows_NT') { throw 'Run this installer on a Windows PC.' }

$installerRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ReleaseZip)) {
    $candidates = @(Get-ChildItem -LiteralPath $installerRoot -Filter 'NKRN-*.zip' -File)
    if ($candidates.Count -ne 1) {
        throw 'Place one matching NKRN release ZIP next to Install-TygiesOne.ps1.'
    }
    $ReleaseZip = $candidates[0].FullName
}
$ReleaseZip = (Resolve-Path -LiteralPath $ReleaseZip).ProviderPath
$apiInstaller = Join-Path $installerRoot 'Deploy-Release.ps1'
$webInstaller = Join-Path $installerRoot 'Deploy-FrontendRelease.ps1'
foreach ($scriptPath in @($apiInstaller, $webInstaller)) {
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
        throw "Required installer script missing: $scriptPath"
    }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($ReleaseZip)
try {
    $manifestEntry = $archive.GetEntry('release.json')
    if (-not $manifestEntry) { throw 'Missing release manifest.' }
    $reader = [IO.StreamReader]::new($manifestEntry.Open())
    try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json }
    finally { $reader.Dispose() }
}
finally { $archive.Dispose() }

if ($manifest.publicApiUrl -ne 'https://portal.tygies.co.za' -or
    $manifest.commit -notmatch '^[a-f0-9]{40}$' -or
    $manifest.branch -ne 'fix/it-chat-mentions-jaron-20261026') {
    throw 'The release ZIP is not the expected Tygies One production build.'
}

Write-Host ''
Write-Host '===============================================' -ForegroundColor Cyan
Write-Host ' TYGIES ONE - LOGISTICS / SOUND INSTALLER' -ForegroundColor Cyan
Write-Host '===============================================' -ForegroundColor Cyan
Write-Host "Commit: $($manifest.commit)"
Write-Host "Target: $Server / portal.tygies.co.za"
Write-Host 'No SQL migrations will be run.'
Write-Host ''

$credential = Get-Credential -UserName 'TYGERPOORTLAB\wilcob' -Message "Connect to $Server for Tygies One installation"
$session = New-PSSession -ComputerName $Server -Credential $credential
$release = [string]$manifest.release
$remoteRoot = "C:\NKRN-Deploy\API-$release"
$remoteZip = Join-Path $remoteRoot 'release.zip'
$remotePackage = Join-Path $remoteRoot 'package'
$expectedHash = (Get-FileHash -LiteralPath $ReleaseZip -Algorithm SHA256).Hash
$apiInstalled = $false
$frontendAttempted = $false

try {
    Invoke-Command -Session $session -ArgumentList $remoteRoot -ScriptBlock {
        param($root)
        $ErrorActionPreference = 'Stop'
        if ($env:COMPUTERNAME -ine 'TYGIES-APP') { throw 'Wrong server.' }
        if (Test-Path (Join-Path $root 'deployment-state.json')) {
            throw 'Existing deployment state found. Inspect it instead of reinstalling.'
        }
        if (Test-Path (Join-Path $root 'package')) {
            throw 'Package already extracted. Stop to avoid duplicate installation.'
        }
        New-Item -ItemType Directory -Path $root -Force | Out-Null
    }

    Write-Host 'Transferring and verifying the release package...' -ForegroundColor Cyan
    Copy-Item -LiteralPath $ReleaseZip -Destination $remoteZip -ToSession $session -Force
    Copy-Item -LiteralPath $apiInstaller -Destination (Join-Path $remoteRoot 'Deploy-Release.ps1') -ToSession $session -Force

    Invoke-Command -Session $session -ArgumentList $remoteZip, $remotePackage, $expectedHash, ([string]$manifest.commit) -ScriptBlock {
        param($zip, $package, $hash, $commit)
        $ErrorActionPreference = 'Stop'
        if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $hash) {
            throw 'Transferred ZIP checksum mismatch.'
        }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($zip, $package)
        $releaseInfo = Get-Content -LiteralPath (Join-Path $package 'release.json') -Raw | ConvertFrom-Json
        if ($releaseInfo.commit -ne $commit) { throw 'Extracted commit mismatch.' }
        foreach ($path in @('api\NKRN.API.dll','frontend\server.js','frontend\.next\BUILD_ID')) {
            if (-not (Test-Path -LiteralPath (Join-Path $package $path) -PathType Leaf)) {
                throw "Release component missing: $path"
            }
        }
    }

    Write-Host 'Updating the API...' -ForegroundColor Cyan
    Invoke-Command -Session $session -ArgumentList $remoteRoot, $remotePackage -ScriptBlock {
        param($root, $package)
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Deploy-Release.ps1') -Action Install -PackageRoot $package
        if ($LASTEXITCODE -ne 0) { throw 'API installation failed.' }
    }
    $apiInstalled = $true

    # Keep existing email login working before deploying the new frontend.
    $authRoute = Invoke-Command -Session $session -ScriptBlock {
        $ErrorActionPreference = 'Stop'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        try {
            Invoke-WebRequest -Uri 'https://portal.tygies.co.za/api/Auth/login' -UseBasicParsing -TimeoutSec 20 | Out-Null
            return 200
        }
        catch {
            if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
            throw
        }
    }
    if ($authRoute -ne 405) {
        throw "Existing email login endpoint was not found after API install (HTTP $authRoute)."
    }

    Write-Host 'Updating the frontend...' -ForegroundColor Cyan
    $frontendAttempted = $true
    & $webInstaller -ZipPath $ReleaseZip -Session $session
    if (-not $?) { throw 'Frontend installer failed.' }

    $httpStatus = Invoke-Command -Session $session -ScriptBlock {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        (Invoke-WebRequest -Uri 'https://portal.tygies.co.za/login' -UseBasicParsing -TimeoutSec 20).StatusCode
    }
    if ($httpStatus -ne 200) { throw "Public login HTTP $httpStatus." }

    Write-Host 'Restoring the original Logistics automation configuration...' -ForegroundColor Cyan
    Invoke-Command -Session $session -ArgumentList $remoteRoot, $remotePackage -ScriptBlock {
        param($root, $package)
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Deploy-Release.ps1') -Action ResumeAutomation -PackageRoot $package
        if ($LASTEXITCODE -ne 0) { throw 'Unable to restore Logistics automation.' }
    }

    Write-Host ''
    Write-Host 'INSTALLATION SUCCESSFUL - API + FRONTEND + AUTOMATION' -ForegroundColor Green
    Write-Host 'Confirm email sign-in and Logistics sound notifications in the live portal.' -ForegroundColor Yellow
    Start-Process 'https://portal.tygies.co.za/login'
}
catch {
    $failure = $_.Exception.Message
    Write-Warning "Installer stopped: $failure"
    if ($apiInstalled -and -not $frontendAttempted) {
        Write-Warning 'Attempting to roll back API because frontend was not updated.'
        try {
            Invoke-Command -Session $session -ArgumentList $remoteRoot, $remotePackage -ScriptBlock {
                param($root, $package)
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Deploy-Release.ps1') -Action Rollback -PackageRoot $package
                if ($LASTEXITCODE -ne 0) { throw 'API rollback failed.' }
            }
        }
        catch { Write-Warning ("API rollback needs attention: " + $_.Exception.Message) }
    }
    if ($frontendAttempted) {
        Write-Warning 'Review both API and frontend deployment states before retrying or rolling back.'
    }
    throw
}
finally {
    if ($session -and $session.State -eq 'Opened') { Remove-PSSession -Session $session }
}
