#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,

    [Parameter(Mandatory = $true)]
    [System.Management.Automation.Runspaces.PSSession]$Session
)

$ErrorActionPreference = 'Stop'

# One-command frontend-only deployment for portal.tygies.co.za.
# The API, IIS API site, SQL Server, and database are not modified.

if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) {
    throw "Release ZIP not found: $ZipPath"
}
if ($Session.State -ne 'Opened') {
    throw 'The supplied TYGIES-APP PowerShell session is not open.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$ZipPath = (Resolve-Path -LiteralPath $ZipPath).ProviderPath
$releaseHash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash
$archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

try {
    $manifestEntry = $archive.GetEntry('release.json')
    if ($null -eq $manifestEntry) {
        throw 'Release ZIP is missing root-level release.json.'
    }
    $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
    try {
        $manifest = $reader.ReadToEnd() | ConvertFrom-Json
    }
    finally {
        $reader.Dispose()
    }

    # ZipFile.CreateFromDirectory on Windows may store entry names with backslashes.
    # Normalize separators when validating so valid Windows-built ZIPs are accepted.
    $normalizedEntries = @{}
    foreach ($entry in $archive.Entries) {
        $normalizedEntries[$entry.FullName.Replace('\', '/')] = $true
    }
    foreach ($entryName in @('frontend/server.js', 'frontend/.next/BUILD_ID')) {
        if (-not $normalizedEntries.ContainsKey($entryName)) {
            throw "Release ZIP is missing $entryName."
        }
    }
}
finally {
    $archive.Dispose()
}

if ($manifest.publicApiUrl -ne 'https://portal.tygies.co.za') {
    throw "Unexpected release target: $($manifest.publicApiUrl)"
}
if ($manifest.databaseApplied -eq $true) {
    throw 'Release indicates database changes. Deployment stopped.'
}
if ([string]$manifest.commit -notmatch '^[a-f0-9]{40}$') {
    throw 'Release manifest contains an invalid commit SHA.'
}

$release = [string]$manifest.release
$expectedCommit = [string]$manifest.commit
$remoteDrop = 'C:\NKRN-Deploy'
$remoteZip = Join-Path $remoteDrop ([IO.Path]::GetFileName($ZipPath))

Write-Host "Release : $release"
Write-Host "Commit  : $expectedCommit"
Write-Host "SHA256  : $releaseHash"
Write-Host 'Transferring the verified ZIP to TYGIES-APP...'

Invoke-Command -Session $Session -ArgumentList $remoteDrop -ScriptBlock {
    param($path)
    New-Item -ItemType Directory -Path $path -Force | Out-Null
}
Copy-Item -LiteralPath $ZipPath -Destination $remoteZip -ToSession $Session -Force

$result = Invoke-Command -Session $Session -ArgumentList $release, $expectedCommit, $releaseHash -ScriptBlock {
    param($release, $expectedCommit, $expectedHash)

    $ErrorActionPreference = 'Stop'
    $drop = 'C:\NKRN-Deploy'
    $zip = Join-Path $drop "$release.zip"
    $stage = Join-Path $drop $release
    $live = 'C:\inetpub\Aurora-Frontend'
    $backup = Join-Path $drop "Aurora-Frontend.backup-$release"
    $serviceName = 'AuroraFrontend'
    $deploymentStarted = $false
    $backupComplete = $false

    $serverHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
    if ($serverHash -ne $expectedHash) {
        throw "Transferred ZIP checksum mismatch: $serverHash"
    }

    if (-not (Test-Path -LiteralPath $live -PathType Container)) {
        throw "Live frontend directory is missing: $live"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $live '.env.local') -PathType Leaf)) {
        throw 'Live .env.local is missing. Production was not stopped.'
    }
    if ((Get-Service -Name $serviceName -ErrorAction Stop).Status -ne 'Running') {
        throw 'AuroraFrontend is not running. Deployment stopped without changing production.'
    }
    if (Test-Path -LiteralPath $backup) {
        throw "Backup already exists: $backup. Refusing to overwrite it."
    }
    if (Test-Path -LiteralPath $stage) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $stage)

    # Build-Release packages release.json and frontend at ZIP root.
    $manifestPath = Join-Path $stage 'release.json'
    $frontend = Join-Path $stage 'frontend'
    $buildIdPath = Join-Path $frontend '.next\BUILD_ID'
    $serverJs = Join-Path $frontend 'server.js'

    foreach ($path in @($manifestPath, $buildIdPath, $serverJs)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Required release file missing: $path. Live service has not been stopped."
        }
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.commit -ne $expectedCommit -or $manifest.release -ne $release) {
        throw 'Extracted release manifest does not match the verified release.'
    }
    if ($manifest.databaseApplied -eq $true) {
        throw 'Release indicates database changes. Deployment stopped.'
    }

    $newBuildId = (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
    $envFile = Join-Path $live '.env.local'
    $envHashBefore = (Get-FileHash -LiteralPath $envFile -Algorithm SHA256).Hash

    # Back up the live frontend while the service is still running.
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    & robocopy.exe $live $backup /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ
    if ($LASTEXITCODE -ge 8) {
        throw "Frontend backup failed (robocopy exit $LASTEXITCODE). Live service was not stopped."
    }

    foreach ($file in @('server.js', '.next\BUILD_ID', '.env.local')) {
        if (-not (Test-Path -LiteralPath (Join-Path $backup $file) -PathType Leaf)) {
            throw "Backup verification failed: $file. Live service was not stopped."
        }
    }
    if ((Get-FileHash -LiteralPath (Join-Path $backup '.env.local') -Algorithm SHA256).Hash -ne $envHashBefore) {
        throw 'Backup environment file does not match production. Live service was not stopped.'
    }
    $backupComplete = $true

    try {
        $deploymentStarted = $true
        Stop-Service -Name $serviceName -ErrorAction Stop
        (Get-Service -Name $serviceName).WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds(30))

        & robocopy.exe $frontend $live /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ /XF '.env.local'
        if ($LASTEXITCODE -ge 8) {
            throw "Frontend copy failed (robocopy exit $LASTEXITCODE)."
        }

        $envHashAfter = (Get-FileHash -LiteralPath $envFile -Algorithm SHA256).Hash
        if ($envHashAfter -ne $envHashBefore) {
            throw 'Production .env.local changed unexpectedly.'
        }

        $liveBuildId = (Get-Content -LiteralPath (Join-Path $live '.next\BUILD_ID') -Raw).Trim()
        if ($liveBuildId -ne $newBuildId) {
            throw "Deployed build ID mismatch. Expected $newBuildId; got $liveBuildId."
        }

        Start-Service -Name $serviceName -ErrorAction Stop
        (Get-Service -Name $serviceName).WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(30))

        $healthy = $false
        $response = $null
        for ($i = 0; $i -lt 15; $i++) {
            try {
                $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 5
                if ($response.StatusCode -eq 200) {
                    $healthy = $true
                    break
                }
            }
            catch {
                Start-Sleep -Seconds 2
            }
        }
        if (-not $healthy) {
            throw 'New frontend did not return HTTP 200 on port 3000.'
        }

        [PSCustomObject]@{
            Result        = 'DEPLOYMENT SUCCESSFUL'
            Release       = $release
            Commit        = $manifest.commit
            BuildID       = $liveBuildId
            HTTPStatus    = $response.StatusCode
            ServiceStatus = (Get-Service -Name $serviceName).Status
            EnvPreserved  = ($envHashAfter -eq $envHashBefore)
            Backup        = $backup
            API           = 'NOT RESTARTED'
            Database      = 'NOT MODIFIED'
        }
    }
    catch {
        $deployError = $_.Exception.Message
        if (-not $deploymentStarted -or -not $backupComplete) {
            throw "Deployment failed before a recoverable live change: $deployError"
        }

        Write-Host 'Deployment failed; restoring the previous frontend...' -ForegroundColor Yellow
        try {
            $svc = Get-Service -Name $serviceName
            if ($svc.Status -ne 'Stopped') {
                Stop-Service -Name $serviceName -ErrorAction Stop
                $svc.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds(30))
            }

            & robocopy.exe $backup $live /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ /XF '.env.local'
            if ($LASTEXITCODE -ge 8) {
                throw "Rollback copy failed (robocopy exit $LASTEXITCODE)."
            }

            if ((Get-FileHash -LiteralPath $envFile -Algorithm SHA256).Hash -ne $envHashBefore) {
                throw 'Production .env.local hash changed during rollback.'
            }

            Start-Service -Name $serviceName -ErrorAction Stop
            (Get-Service -Name $serviceName).WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(30))
            $rollbackResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 15
            if ($rollbackResponse.StatusCode -ne 200) {
                throw "Restored frontend returned HTTP $($rollbackResponse.StatusCode)."
            }

            return [PSCustomObject]@{
                Result        = 'ROLLED BACK - PREVIOUS FRONTEND HEALTHY'
                FailedRelease = $release
                OriginalError = $deployError
                HTTPStatus    = $rollbackResponse.StatusCode
                ServiceStatus = (Get-Service -Name $serviceName).Status
                Backup        = $backup
                API           = 'NOT RESTARTED'
                Database      = 'NOT MODIFIED'
            }
        }
        catch {
            throw "DEPLOYMENT/ROLLBACK REQUIRES ATTENTION: $($_.Exception.Message)"
        }
    }
}

$result | Format-List
