# Run on TYGIES-APP, normally through Invoke-Command -Session $session.
# Database migrations are a separate, prior step; this script does not run SQL.
#requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Install', 'ResumeAutomation', 'Rollback')]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$PackageRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

if ($env:COMPUTERNAME -ine 'TYGIES-APP') {
    throw 'Run this script on TYGIES-APP.'
}

Import-Module WebAdministration

$PackageRoot = (Resolve-Path -LiteralPath $PackageRoot).ProviderPath.TrimEnd('\')
$stateFile = Join-Path (Split-Path -Parent $PackageRoot) 'deployment-state.json'

$apiSite = 'AuroraITDeskAPI'
$apiPool = 'AuroraITDeskAPI'
$portalSite = 'NKRN Portal'
$frontendService = 'AuroraFrontend'

$utf8 = [System.Text.UTF8Encoding]::new($false)

function Save-State {
    [System.IO.File]::WriteAllText(
        $stateFile,
        ($script:state | ConvertTo-Json -Depth 8),
        $utf8
    )
}

function Copy-Tree {
    param(
        [string]$Source,
        [string]$Destination,
        [switch]$PreserveAcl,
        [switch]$ApiOverlay
    )

    $options = @(
        '/E',
        '/DCOPY:DAT',
        '/R:2',
        '/W:1',
        '/XJ',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/NP'
    )

    if ($PreserveAcl) {
        $options += '/COPY:DATS'
    }
    else {
        $options += '/COPY:DAT'
    }

    if ($ApiOverlay) {
        $options += @(
            '/XF',
            'web.config',
            'appsettings.json',
            'appsettings.Development.json'
        )
    }

    & robocopy.exe $Source $Destination @options | Out-Host

    if ($LASTEXITCODE -ge 8) {
        throw "File copy failed: robocopy exit $LASTEXITCODE."
    }
}

function Save-Xml {
    param(
        [xml]$Document,
        [string]$Path
    )

    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = $utf8
    $settings.Indent = $true

    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)

    try {
        $Document.Save($writer)
    }
    finally {
        $writer.Dispose()
    }
}

function Stop-ApiOnly {
    if ((Get-Website -Name $apiSite).State -eq 'Started') {
        Stop-Website -Name $apiSite
    }

    if ((Get-WebAppPoolState -Name $apiPool).Value -ne 'Stopped') {
        Stop-WebAppPool -Name $apiPool
    }

    $deadline = (Get-Date).AddSeconds(30)

    do {
        $workers = @(
            & "$env:windir\system32\inetsrv\appcmd.exe" list wp |
                Select-String "applicationPool:$apiPool"
        )

        if ($workers.Count -eq 0) {
            Write-Host "AuroraITDeskAPI worker process has stopped." -ForegroundColor Green
            return
        }

        Write-Host "Waiting for AuroraITDeskAPI worker process to exit..." -ForegroundColor Yellow
        Start-Sleep -Seconds 1
    }
    while ((Get-Date) -lt $deadline)

    throw "AuroraITDeskAPI worker process did not stop within 30 seconds."
}
function Start-ApiOnly {
    if ((Get-WebAppPoolState -Name $apiPool).Value -ne 'Started') {
        Start-WebAppPool -Name $apiPool
    }

    if ((Get-Website -Name $apiSite).State -ne 'Started') {
        Start-Website -Name $apiSite
    }
}

function Stop-Applications {
    if ((Get-Website -Name $portalSite).State -eq 'Started') {
        Stop-Website -Name $portalSite
    }

    if ((Get-Website -Name $apiSite).State -eq 'Started') {
        Stop-Website -Name $apiSite
    }

    if ((Get-WebAppPoolState -Name $apiPool).Value -ne 'Stopped') {
        Stop-WebAppPool -Name $apiPool
    }

    $svc = Get-Service -Name $frontendService

    if ($svc.Status -ne 'Stopped') {
        Stop-Service -Name $frontendService -ErrorAction Stop
    }

    $svc.WaitForStatus(
        [System.ServiceProcess.ServiceControllerStatus]::Stopped,
        [TimeSpan]::FromSeconds(30)
    )
}

function Start-Applications {
    if ((Get-WebAppPoolState -Name $apiPool).Value -ne 'Started') {
        Start-WebAppPool -Name $apiPool
    }

    if ((Get-Website -Name $apiSite).State -ne 'Started') {
        Start-Website -Name $apiSite
    }

    if ((Get-Service -Name $frontendService).Status -ne 'Running') {
        Start-Service -Name $frontendService
    }

    (Get-Service -Name $frontendService).WaitForStatus(
        [System.ServiceProcess.ServiceControllerStatus]::Running,
        [TimeSpan]::FromSeconds(30)
    )

    if ((Get-Website -Name $portalSite).State -ne 'Started') {
        Start-Website -Name $portalSite
    }
}

function Restore-ApiInPlace {
    Stop-ApiOnly

    $root = [string]$script:state.api.root
    $backup = [string]$script:state.api.backup

    if (-not (Test-Path -LiteralPath $backup -PathType Container)) {
        throw "API backup does not exist: $backup"
    }

    Write-Host 'Restoring previous API files in place...'

    $options = @(
        '/MIR',
        '/DCOPY:DAT',
        '/COPY:DATS',
        '/R:2',
        '/W:1',
        '/XJ',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/NP'
    )

    & robocopy.exe $backup $root @options | Out-Host

    if ($LASTEXITCODE -ge 8) {
        throw "API rollback copy failed: robocopy exit $LASTEXITCODE."
    }

    Start-ApiOnly

    $script:state.status = 'RolledBack'
    Save-State
}

function Assert-CurrentRelease {
    $markerPath = Join-Path ([string]$script:state.api.root) 'nkrn-deployment.json'

    if (-not (Test-Path -LiteralPath $markerPath)) {
        throw 'Active API release marker is missing.'
    }

    $marker = Get-Content `
        -LiteralPath $markerPath `
        -Raw `
        -Encoding UTF8 |
        ConvertFrom-Json

    if ($marker.release -ne $script:state.release) {
        throw 'A different release is now active. Do not use this deployment state.'
    }
}

if ($Action -eq 'Install') {

    if (Test-Path -LiteralPath $stateFile) {
        throw 'This release already has deployment state. Review it; do not repeat Install.'
    }

    $manifest = Get-Content `
        -LiteralPath (Join-Path $PackageRoot 'release.json') `
        -Raw `
        -Encoding UTF8 |
        ConvertFrom-Json

    if (
        $manifest.commit -notmatch ('^[a-f0-9]{40}' + '$') -or
        $manifest.publicApiUrl -ne 'https://portal.tygies.co.za'
    ) {
        throw 'This package has an invalid commit SHA or production address.'
    }

    $shortCommit = ([string]$manifest.commit).Substring(0, 7)
    if ($manifest.release -notmatch ('^NKRN-' + [regex]::Escape($shortCommit) + '-[0-9]{8}-[0-9]{6}-[a-f0-9]{6}' + '$')) {
        throw 'Release identifier does not match the source commit.'
    }

    $release = [string]$manifest.release
    $release = [string]$manifest.release

    foreach ($relative in @(
        'api\NKRN.API.dll',
        'api\web.config',
        'frontend\server.js',
        'frontend\.next\BUILD_ID',
        'frontend\public\sw.js'
    )) {
        if (
            -not (
                Test-Path `
                    -LiteralPath (Join-Path $PackageRoot $relative) `
                    -PathType Leaf
            )
        ) {
            throw "Package is missing $relative."
        }
    }

    if (
        -not (
            Test-Path `
                -LiteralPath (Join-Path $PackageRoot 'frontend\.next\static') `
                -PathType Container
        )
    ) {
        throw 'Frontend static build is missing.'
    }

    if (
        @(Get-WebGlobalModule |
            Where-Object { $_.Name -eq 'AspNetCoreModuleV2' }).Count -eq 0
    ) {
        throw 'The ASP.NET Core IIS module is missing.'
    }

    if ((Get-Item "IIS:\AppPools\$apiPool").enable32BitAppOnWin64) {
        throw 'This package is x64, but the API pool has 32-bit applications enabled.'
    }

    $apiRoot = [Environment]::ExpandEnvironmentVariables(
        [string](Get-Website -Name $apiSite).physicalPath
    ).TrimEnd('\')

    if (-not (Test-Path -LiteralPath $apiRoot -PathType Container)) {
        throw "The API directory does not exist: $apiRoot."
    }

    if (
        (Get-Website -Name $apiSite).applicationPool -ne $apiPool
    ) {
        throw 'The API application pool differs from the recorded setup.'
    }

    if (
        (Get-Website -Name $portalSite).State -ne 'Started' -or
        (Get-Website -Name $apiSite).State -ne 'Started' -or
        (Get-Service -Name $frontendService).Status -ne 'Running'
    ) {
        throw 'The current portal, API and frontend must be running before this deployment starts.'
    }

    $service = Get-ItemProperty `
        -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Services\AuroraFrontend\Parameters'

    $frontendRoot = [Environment]::ExpandEnvironmentVariables(
        [string]$service.AppDirectory
    ).TrimEnd('\')

    if (
        [System.IO.Path]::GetFileName(
            [string]$service.Application
        ) -ine 'node.exe'
    ) {
        throw 'The frontend service does not directly launch node.exe.'
    }

    if (
        $frontendRoot -notmatch '^[A-Za-z]:\\' -or
        -not (Test-Path -LiteralPath $frontendRoot -PathType Container)
    ) {
        throw 'Frontend service directory is not a valid local directory.'
    }

    if (
        $apiRoot -ieq $frontendRoot -or
        $apiRoot.StartsWith(
            $frontendRoot + '\',
            [StringComparison]::OrdinalIgnoreCase
        ) -or
        $frontendRoot.StartsWith(
            $apiRoot + '\',
            [StringComparison]::OrdinalIgnoreCase
        )
    ) {
        throw 'Application directories overlap.'
    }

    if (
        (Get-Item -LiteralPath $apiRoot).Attributes -band
        [System.IO.FileAttributes]::ReparsePoint
    ) {
        throw 'The API root is a junction or symbolic link.'
    }

    if (
        Test-Path -LiteralPath (Join-Path $apiRoot 'app_offline.htm')
    ) {
        throw 'The API already has app_offline.htm. Resolve its existing maintenance state first.'
    }

    [xml]$existingConfig =
        [System.IO.File]::ReadAllText(
            (Join-Path $apiRoot 'web.config')
        )

    [xml]$publishedConfig =
        [System.IO.File]::ReadAllText(
            (Join-Path $PackageRoot 'api\web.config')
        )

    $oldHandler = $existingConfig.SelectSingleNode('//aspNetCore')
    $newHandler = $publishedConfig.SelectSingleNode('//aspNetCore')

    if (
        $null -eq $oldHandler -or
        $null -eq $newHandler -or
        $newHandler.GetAttribute('arguments') -notmatch 'NKRN\.API\.dll'
    ) {
        throw 'Cannot verify the API launch configuration.'
    }

    $script:state = [pscustomobject]@{
        release = $release
        status = 'Prepared'
        api = [pscustomobject]@{
            root = $apiRoot
            backup = ($apiRoot + '.backup-' + $release)
        }
        frontend = [pscustomobject]@{
            root = $frontendRoot
        }
        createdUtc = [DateTime]::UtcNow.ToString('o')
    }

    if (Test-Path -LiteralPath $state.api.backup) {
        throw "API backup path already exists: $($state.api.backup)"
    }

    & "$env:windir\System32\inetsrv\appcmd.exe" add backup $release |
        Out-Host

    if ($LASTEXITCODE -ne 0) {
        throw 'IIS configuration backup failed; the live application has not been changed.'
    }

    Save-State

    $script:backupVerified = $false

    try {

        Write-Host ''
        Write-Host '========================================' -ForegroundColor Cyan
        Write-Host ' NKRN IN-PLACE API DEPLOYMENT' -ForegroundColor Cyan
        Write-Host '========================================' -ForegroundColor Cyan
        Write-Host ''
        Write-Host 'The frontend will remain untouched.'
        Write-Host 'Only the API will enter a brief maintenance window.'
        Write-Host ''

        $state.status = 'Installing'
        Save-State

        #
        # Stop only the API.
        #
        Stop-ApiOnly

        #
        # Create a complete backup WITHOUT renaming the live root.
        #
        Write-Host 'Creating API backup...' -ForegroundColor Yellow

        New-Item `
            -ItemType Directory `
            -Path $state.api.backup |
            Out-Null

        Set-Acl `
            -LiteralPath $state.api.backup `
            -AclObject (Get-Acl -LiteralPath $apiRoot)

        Copy-Tree `
            $apiRoot `
            $state.api.backup `
            -PreserveAcl

        Write-Host 'API backup completed.' -ForegroundColor Green

        foreach ($requiredBackupFile in @('web.config', 'NKRN.API.dll')) {
            $backupFile = Join-Path $state.api.backup $requiredBackupFile
            if (-not (Test-Path -LiteralPath $backupFile -PathType Leaf)) {
                throw ("API backup is incomplete; missing " + $requiredBackupFile + ".")
            }
        }
        $liveDllHash = (Get-FileHash -LiteralPath (Join-Path $apiRoot 'NKRN.API.dll') -Algorithm SHA256).Hash
        $backupDllHash = (Get-FileHash -LiteralPath (Join-Path $state.api.backup 'NKRN.API.dll') -Algorithm SHA256).Hash
        if ($liveDllHash -ine $backupDllHash) { throw 'API backup DLL hash does not match the live DLL.' }
        $script:backupVerified = $true
        Write-Host 'API backup files and DLL hash verified.' -ForegroundColor Green

        #
        # Overlay the new API release into the existing root.
        #
        Write-Host 'Installing new API files...' -ForegroundColor Yellow

        Copy-Tree `
            (Join-Path $PackageRoot 'api') `
            $apiRoot `
            -ApiOverlay

        #
        # Keep production web.config and environment configuration,
        # but update the API launch target from the published package.
        #
        [xml]$config =
            [System.IO.File]::ReadAllText(
                (Join-Path $apiRoot 'web.config')
            )

        $handler = $config.SelectSingleNode('//aspNetCore')

        $handler.SetAttribute(
            'processPath',
            $newHandler.GetAttribute('processPath')
        )

        $handler.SetAttribute(
            'arguments',
            $newHandler.GetAttribute('arguments')
        )

        $variables = $handler.SelectSingleNode('environmentVariables')

        if ($null -eq $variables) {
            $variables = $config.CreateElement('environmentVariables')
            [void]$handler.AppendChild($variables)
        }

        @(
            $variables.SelectNodes('environmentVariable') |
            Where-Object {
                $_.GetAttribute('name') -ieq
                'LogisticsAutomation__Enabled'
            }
        ) |
        ForEach-Object {
            [void]$variables.RemoveChild($_)
        }

        $pause = $config.CreateElement('environmentVariable')

        $pause.SetAttribute(
            'name',
            'LogisticsAutomation__Enabled'
        )

        $pause.SetAttribute(
            'value',
            'false'
        )

        [void]$variables.AppendChild($pause)

        Save-Xml `
            $config `
            (Join-Path $apiRoot 'web.config')

        #
        # Write the deployment marker.
        #
        $markerJson = @{
            release = $release
            commit = $manifest.commit
        } | ConvertTo-Json

        [System.IO.File]::WriteAllText(
            (Join-Path $apiRoot 'nkrn-deployment.json'),
            $markerJson,
            $utf8
        )

        #
        # Start API.
        #
        Start-ApiOnly

        Start-Sleep -Seconds 5

        #
        # Verify marker.
        #
        $activeMarker =
            Get-Content `
                -LiteralPath (Join-Path $apiRoot 'nkrn-deployment.json') `
                -Raw `
                -Encoding UTF8 |
            ConvertFrom-Json

        if ($activeMarker.commit -ne $manifest.commit) {
            throw "Deployment marker verification failed. Active commit: $($activeMarker.commit)"
        }

        #
        # Verify API process is actually running.
        #
        if (
            (Get-WebAppPoolState -Name $apiPool).Value -ne 'Started'
        ) {
            throw 'API application pool did not start.'
        }

        if (
            (Get-Website -Name $apiSite).State -ne 'Started'
        ) {
            throw 'API website did not start.'
        }

        $state.status = 'InstalledPendingBrowserCheck'
        Save-State

        Write-Host ''
        Write-Host '========================================' -ForegroundColor Green
        Write-Host ' API DEPLOYMENT COMPLETE' -ForegroundColor Green
        Write-Host '========================================' -ForegroundColor Green
        Write-Host ''
        Write-Host "Release : $release"
        Write-Host ("Commit  : " + $manifest.commit)
        Write-Host 'API     : RUNNING'
        Write-Host ''
        Write-Host 'Logistics automation is temporarily paused.'
        Write-Host 'Run ResumeAutomation only AFTER browser/API verification.'
        Write-Host ''

    }
    catch {

        $deploymentError = $_

        if ($script:backupVerified) {
            Write-Warning 'Deployment failed. Restoring the API from the verified backup in place.'
        }
        else {
            Write-Warning 'Deployment failed before a verified backup existed. No API files were overlaid; attempting to restart the unchanged API.'
            try {
                Start-ApiOnly
                $state.status = 'BackupFailedNoChanges'
                Save-State
            }
            catch {
                Write-Error 'The API backup was not verified and the unchanged API could not be restarted. Inspect IIS immediately.'
                Write-Error ("Deployment state: " + $stateFile)
                throw
            }
            throw $deploymentError
        }
        try {

            Restore-ApiInPlace

            Write-Host ''
            Write-Host 'Previous API restored successfully.' -ForegroundColor Green
            Write-Host 'Frontend was never changed.' -ForegroundColor Green
            Write-Host ''

        }
        catch {

            Write-Error 'Automatic API rollback also failed.'
            Write-Error "Deployment state: $stateFile"
            throw
        }

        throw $deploymentError
    }
}
else {

    if (-not (Test-Path -LiteralPath $stateFile)) {
        throw "Deployment state file does not exist: $stateFile"
    }

    $script:state =
        Get-Content `
            -LiteralPath $stateFile `
            -Raw `
            -Encoding UTF8 |
        ConvertFrom-Json

    if ($Action -eq 'Rollback') {

        if ($state.status -eq 'RolledBack') {
            throw 'This release has already been rolled back.'
        }

        if ($state.status -ne 'Installing') {
            Assert-CurrentRelease
        }

        Restore-ApiInPlace

        Write-Host ''
        Write-Host 'Previous API restored in place.' -ForegroundColor Green
        Write-Host 'Frontend was not changed.' -ForegroundColor Green
        Write-Host 'Additive SQL changes were left in place.' -ForegroundColor Yellow
        Write-Host ''

    }
    else {

        Assert-CurrentRelease

        if ($state.status -eq 'AutomationRestored') {
            Write-Host 'The original automation override has already been restored.'
            return
        }

        $backupConfigPath =
            Join-Path ([string]$state.api.backup) 'web.config'

        if (-not (Test-Path -LiteralPath $backupConfigPath)) {
            throw "Original API web.config backup is missing: $backupConfigPath"
        }

        [xml]$previous =
            [System.IO.File]::ReadAllText($backupConfigPath)

        [xml]$current =
            [System.IO.File]::ReadAllText(
                (Join-Path ([string]$state.api.root) 'web.config')
            )

        $variables =
            $current.SelectSingleNode('//aspNetCore/environmentVariables')

        if ($null -eq $variables) {
            $handler = $current.SelectSingleNode('//aspNetCore')
            $variables = $current.CreateElement('environmentVariables')
            [void]$handler.AppendChild($variables)
        }

        @(
            $variables.SelectNodes('environmentVariable') |
            Where-Object {
                $_.GetAttribute('name') -ieq
                'LogisticsAutomation__Enabled'
            }
        ) |
        ForEach-Object {
            [void]$variables.RemoveChild($_)
        }

        $originalOverrides =
            @(
                $previous.SelectNodes(
                    '//aspNetCore/environmentVariables/environmentVariable'
                ) |
                Where-Object {
                    $_.GetAttribute('name') -ieq
                    'LogisticsAutomation__Enabled'
                }
            )

        foreach ($original in $originalOverrides) {
            [void]$variables.AppendChild(
                $current.ImportNode($original, $true)
            )
        }

        Save-Xml `
            $current `
            (Join-Path ([string]$state.api.root) 'web.config')

        Restart-WebAppPool -Name $apiPool

        $state.status = 'AutomationRestored'
        Save-State

        Write-Host ''
        Write-Host 'Logistics automation restored.' -ForegroundColor Green
        Write-Host 'The original production automation configuration now applies.'
        Write-Host ''
    }
}
