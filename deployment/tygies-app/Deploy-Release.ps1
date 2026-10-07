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
if ($env:COMPUTERNAME -ine 'TYGIES-APP') { throw 'Run this script on TYGIES-APP.' }
Import-Module WebAdministration
$PackageRoot = (Resolve-Path -LiteralPath $PackageRoot).ProviderPath.TrimEnd('\')
$stateFile = Join-Path (Split-Path -Parent $PackageRoot) 'deployment-state.json'
$apiSite = 'AuroraITDeskAPI'
$apiPool = 'AuroraITDeskAPI'
$portalSite = 'NKRN Portal'
$frontendService = 'AuroraFrontend'
$serviceKey = 'HKLM:\SYSTEM\CurrentControlSet\Services\AuroraFrontend\Parameters'
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Save-State {
    [System.IO.File]::WriteAllText($stateFile, ($script:state | ConvertTo-Json -Depth 6), $utf8)
}
function Copy-Tree {
    param([string]$Source, [string]$Destination, [switch]$PreserveAcl, [switch]$ApiOverlay)
    $options = @('/E', '/DCOPY:DAT', '/R:2', '/W:1', '/XJ', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    if ($PreserveAcl) { $options += '/COPY:DATS' } else { $options += '/COPY:DAT' }
    if ($ApiOverlay) { $options += @('/XF', 'web.config', 'appsettings*.json') }
    & robocopy.exe $Source $Destination @options | Out-Host
    if ($LASTEXITCODE -ge 8) { throw "File copy failed: robocopy exit $LASTEXITCODE." }
}
function Save-Xml {
    param([xml]$Document, [string]$Path)
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = $utf8
    $settings.Indent = $true
    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)
    try { $Document.Save($writer) } finally { $writer.Dispose() }
}
function Stop-Applications {
    if ((Get-Website -Name $portalSite).State -eq 'Started') { Stop-Website -Name $portalSite }
    if ((Get-Website -Name $apiSite).State -eq 'Started') { Stop-Website -Name $apiSite }
    if ((Get-WebAppPoolState -Name $apiPool).Value -ne 'Stopped') { Stop-WebAppPool -Name $apiPool }
    $svc = Get-Service -Name $frontendService
    if ($svc.Status -ne 'Stopped') { Stop-Service -Name $frontendService -ErrorAction Stop }
    $svc.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds(30))
}
function Start-Applications {
    if ((Get-WebAppPoolState -Name $apiPool).Value -ne 'Started') { Start-WebAppPool -Name $apiPool }
    if ((Get-Website -Name $apiSite).State -ne 'Started') { Start-Website -Name $apiSite }
    if ((Get-Service -Name $frontendService).Status -ne 'Running') { Start-Service -Name $frontendService }
    (Get-Service -Name $frontendService).WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(30))
    if ((Get-Website -Name $portalSite).State -ne 'Started') { Start-Website -Name $portalSite }
}
function Move-Directory {
    param([string]$Source, [string]$Destination)
    # A stopped worker can briefly retain handles. Retry the same rename only.
    for ($attempt = 1; $attempt -le 15; $attempt++) {
        try { Move-Item -LiteralPath $Source -Destination $Destination -ErrorAction Stop; return }
        catch {
            if ($attempt -eq 15) { throw }
            Start-Sleep -Milliseconds 500
        }
    }
}
function Restore-ApplicationFolders {
    Stop-Applications
    foreach ($part in @('api', 'frontend')) {
        $root = [string]$script:state.$part.root
        $backup = [string]$script:state.$part.backup
        if (Test-Path -LiteralPath $backup -PathType Container) {
            if (Test-Path -LiteralPath $root) {
                $failed = $root + '.failed-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
                Move-Directory $root $failed
                Write-Host "Kept replaced files at: $failed"
            }
            Move-Directory $backup $root
        }
    }
    Start-Applications
    $script:state.status = 'RolledBack'
    Save-State
}
function Assert-CurrentRelease {
    foreach ($part in @('api', 'frontend')) {
        $markerPath = Join-Path ([string]$script:state.$part.root) 'nkrn-deployment.json'
        if (-not (Test-Path -LiteralPath $markerPath)) { throw 'Active release marker is missing. Review the current installation first.' }
        $marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($marker.release -ne $script:state.release) { throw 'A different release is now active. Do not use this older deployment state.' }
    }
}

if ($Action -eq 'Install') {
    if (Test-Path -LiteralPath $stateFile) { throw 'This release already has deployment state. Review it; do not repeat Install.' }
    $manifest = Get-Content -LiteralPath (Join-Path $PackageRoot 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.commit -ne 'ac103f2' -or $manifest.publicApiUrl -ne 'https://portal.tygies.co.za') {
        throw 'This package is not the expected commit and production address.'
    }
    if ($manifest.release -notmatch '^NKRN-48db35c-[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$') { throw 'Unexpected release identifier.' }
    $release = [string]$manifest.release
    foreach ($relative in @('api\NKRN.API.dll', 'api\web.config', 'frontend\server.js', 'frontend\.next\BUILD_ID', 'frontend\public\sw.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PackageRoot $relative) -PathType Leaf)) { throw "Package is missing $relative." }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $PackageRoot 'frontend\.next\static') -PathType Container)) { throw 'Frontend static build is missing.' }
    if (@(Get-WebGlobalModule | Where-Object { $_.Name -eq 'AspNetCoreModuleV2' }).Count -eq 0) { throw 'The ASP.NET Core IIS module is missing.' }
    if ((Get-Item "IIS:\AppPools\$apiPool").enable32BitAppOnWin64) { throw 'This package is x64, but the API pool has 32-bit applications enabled.' }
    $apiRoot = [Environment]::ExpandEnvironmentVariables([string](Get-Website -Name $apiSite).physicalPath).TrimEnd('\')
    if ($apiRoot -ine 'C:\inetpub\AuroraITDesk.API') { throw "The API directory changed: $apiRoot. Review before deploying." }
    if ((Get-Website -Name $apiSite).applicationPool -ne $apiPool) { throw 'The API application pool differs from the recorded setup.' }
    $service = Get-ItemProperty -LiteralPath $serviceKey
    $frontendRoot = [Environment]::ExpandEnvironmentVariables([string]$service.AppDirectory).TrimEnd('\')
    if ([System.IO.Path]::GetFileName([string]$service.Application) -ine 'node.exe') { throw 'The frontend service does not directly launch node.exe.' }
    $entry = ([string]$service.AppParameters).Trim().Trim('"')
    if ($entry -ine 'server.js' -and $entry -ine (Join-Path $frontendRoot 'server.js')) { throw 'Frontend service uses a different start command. Review its AppParameters first.' }
    if ($frontendRoot -notmatch '^[A-Za-z]:\\' -or -not (Test-Path -LiteralPath $frontendRoot -PathType Container)) { throw 'Frontend service directory is not a valid local directory.' }
    if ($apiRoot -ieq $frontendRoot -or $apiRoot.StartsWith($frontendRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $frontendRoot.StartsWith($apiRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Application directories overlap.'
    }
    foreach ($root in @($apiRoot, $frontendRoot)) {
        if ((Get-Item -LiteralPath $root).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'An application root is a junction or symbolic link. Review its target before deploying.' }
    }
    if (@(Get-ChildItem -LiteralPath $apiRoot -Force -Recurse | Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint }).Count -gt 0) {
        throw 'The API contains linked files/directories. Review them before copying its token/data storage.'
    }
    if (Test-Path -LiteralPath (Join-Path $apiRoot 'app_offline.htm')) { throw 'The API already has app_offline.htm. Resolve its existing maintenance state first.' }
    if ((Get-Website -Name $portalSite).State -ne 'Started' -or (Get-Website -Name $apiSite).State -ne 'Started' -or (Get-Service -Name $frontendService).Status -ne 'Running') {
        throw 'The current portal, API and frontend must be running before this deployment starts.'
    }
    [xml]$existingConfig = [System.IO.File]::ReadAllText((Join-Path $apiRoot 'web.config'))
    [xml]$publishedConfig = [System.IO.File]::ReadAllText((Join-Path $PackageRoot 'api\web.config'))
    $oldHandler = $existingConfig.SelectSingleNode('//aspNetCore')
    $newHandler = $publishedConfig.SelectSingleNode('//aspNetCore')
    if ($null -eq $oldHandler -or $null -eq $newHandler -or $newHandler.GetAttribute('arguments') -notmatch 'NKRN\.API\.dll') { throw 'Cannot verify the API launch configuration.' }
    $script:state = [pscustomobject]@{
        release = $release
        status = 'Prepared'
        api = [pscustomobject]@{ root = $apiRoot; stage = ($apiRoot + '.stage-' + $release); backup = ($apiRoot + '.backup-' + $release) }
        frontend = [pscustomobject]@{ root = $frontendRoot; stage = ($frontendRoot + '.stage-' + $release); backup = ($frontendRoot + '.backup-' + $release) }
        createdUtc = [DateTime]::UtcNow.ToString('o')
    }
    foreach ($path in @($state.api.stage, $state.api.backup, $state.frontend.stage, $state.frontend.backup)) {
        if (Test-Path -LiteralPath $path) { throw "Staging or backup path already exists: $path" }
    }
    # Prepare the larger frontend before the outage. Do not reuse the old .next output.
    New-Item -ItemType Directory -Path $state.frontend.stage | Out-Null
    Set-Acl -LiteralPath $state.frontend.stage -AclObject (Get-Acl -LiteralPath $frontendRoot)
    Copy-Tree (Join-Path $PackageRoot 'frontend') $state.frontend.stage
    $markerJson = @{ release = $release; commit = $manifest.commit } | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $state.frontend.stage 'nkrn-deployment.json'), $markerJson, $utf8)
    & "$env:windir\System32\inetsrv\appcmd.exe" add backup $release | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'IIS configuration backup failed; the live application has not been stopped.' }
    Save-State
    try {
        Write-Host 'Beginning the maintenance window. Production SQL migrations must already be verified and applied.'
        $state.status = 'Installing'
        Save-State
        Stop-Applications
        New-Item -ItemType Directory -Path $state.api.stage | Out-Null
        Set-Acl -LiteralPath $state.api.stage -AclObject (Get-Acl -LiteralPath $apiRoot)
        # Copy while stopped so OAuth token storage and application data are consistent.
        Copy-Tree $apiRoot $state.api.stage -PreserveAcl
        Copy-Tree (Join-Path $PackageRoot 'api') $state.api.stage -ApiOverlay
        # Keep live settings, handlers and environment variables. Update only the launch target.
        [xml]$config = [System.IO.File]::ReadAllText((Join-Path $state.api.stage 'web.config'))
        $handler = $config.SelectSingleNode('//aspNetCore')
        $handler.SetAttribute('processPath', $newHandler.GetAttribute('processPath'))
        $handler.SetAttribute('arguments', $newHandler.GetAttribute('arguments'))
        $variables = $handler.SelectSingleNode('environmentVariables')
        if ($null -eq $variables) {
            $variables = $config.CreateElement('environmentVariables')
            [void]$handler.AppendChild($variables)
        }
        @($variables.SelectNodes('environmentVariable') | Where-Object { $_.GetAttribute('name') -ieq 'LogisticsAutomation__Enabled' }) |
            ForEach-Object { [void]$variables.RemoveChild($_) }
        $pause = $config.CreateElement('environmentVariable')
        $pause.SetAttribute('name', 'LogisticsAutomation__Enabled')
        $pause.SetAttribute('value', 'false')
        [void]$variables.AppendChild($pause)
        Save-Xml $config (Join-Path $state.api.stage 'web.config')
        [System.IO.File]::WriteAllText((Join-Path $state.api.stage 'nkrn-deployment.json'), $markerJson, $utf8)
        Move-Directory $apiRoot $state.api.backup
        Move-Directory $frontendRoot $state.frontend.backup
        Move-Directory $state.api.stage $apiRoot
        Move-Directory $state.frontend.stage $frontendRoot
        Start-Applications
        $state.status = 'InstalledPendingBrowserCheck'
        Save-State
        Write-Host 'Application files installed and services started. Login and database access still need browser verification.'
        Write-Host 'Scheduled Logistics automation is temporarily paused. Use ResumeAutomation after verification.'
        Write-Host "Deployment state: $stateFile"
        $state | Select-Object release, status, api, frontend
    }
    catch {
        $deploymentError = $_
        Write-Warning 'Deployment did not complete. Attempting to restore the previous application folders.'
        try { Restore-ApplicationFolders; Write-Host 'Previous application folders restored and services started. Verify the portal.' }
        catch {
            Write-Warning "Automatic application rollback also needs attention. State file: $stateFile"
            throw
        }
        throw $deploymentError
    }
}
else {
    $script:state = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Action -eq 'Rollback') {
        if ($state.status -eq 'RolledBack') { throw 'This release has already been rolled back.' }
        if ($state.status -ne 'Installing') { Assert-CurrentRelease }
        Restore-ApplicationFolders
        Write-Host 'Previous application restored. Additive SQL changes were left in place; verify login and request history.'
    }
    else {
        Assert-CurrentRelease
        if ($state.status -eq 'AutomationRestored') { Write-Host 'The original automation override has already been restored.'; return }
        [xml]$previous = [System.IO.File]::ReadAllText((Join-Path $state.api.backup 'web.config'))
        [xml]$current = [System.IO.File]::ReadAllText((Join-Path $state.api.root 'web.config'))
        $variables = $current.SelectSingleNode('//aspNetCore/environmentVariables')
        @($variables.SelectNodes('environmentVariable') | Where-Object { $_.GetAttribute('name') -ieq 'LogisticsAutomation__Enabled' }) |
            ForEach-Object { [void]$variables.RemoveChild($_) }
        $originalOverrides = @($previous.SelectNodes('//aspNetCore/environmentVariables/environmentVariable') |
            Where-Object { $_.GetAttribute('name') -ieq 'LogisticsAutomation__Enabled' })
        foreach ($original in $originalOverrides) { [void]$variables.AppendChild($current.ImportNode($original, $true)) }
        Save-Xml $current (Join-Path $state.api.root 'web.config')
        Restart-WebAppPool -Name $apiPool
        $state.status = 'AutomationRestored'
        Save-State
        Write-Host 'Temporary Logistics automation pause removed; original configuration now applies. Due job cards may send when the API starts.'
    }
}

