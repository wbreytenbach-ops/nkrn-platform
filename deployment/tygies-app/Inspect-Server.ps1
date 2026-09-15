# Run in Windows PowerShell on TYGIES-APP. Reads configuration and database metadata.
# Does not stop services, modify IIS, write to SQL, or send notification emails.
#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$SqlServer = 'TYGIES-SQL',
    [string]$Database = 'Tygerpoort_ITDesk',
    [switch]$SkipDatabase
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$apiRoot = 'C:\inetpub\AuroraITDesk.API'
$portalRoot = 'C:\inetpub\NKRN-Portal'
$serviceKey = 'HKLM:\SYSTEM\CurrentControlSet\Services\AuroraFrontend\Parameters'

Write-Host "SERVER: $env:COMPUTERNAME"
if ($env:COMPUTERNAME -ine 'TYGIES-APP') {
    throw 'Run this inspection on TYGIES-APP. Use Build-Release.ps1 on your development PC.'
}

Import-Module WebAdministration -ErrorAction Stop
$aspNetModules = @(Get-WebGlobalModule | Where-Object { $_.Name -eq 'AspNetCoreModuleV2' })
Write-Host "AspNetCoreModuleV2 present: $($aspNetModules.Count -gt 0)"
$aspNetModules | Select-Object Name, Image | Format-List | Out-Host
Get-Item 'IIS:\AppPools\AuroraITDeskAPI' |
    Select-Object Name, State, managedRuntimeVersion, enable32BitAppOnWin64 | Format-List | Out-Host

Write-Host 'FRONTEND SERVICE'
Get-CimInstance Win32_Service -Filter "Name='AuroraFrontend'" |
    Select-Object Name, State, PathName | Format-List | Out-Host
if (Test-Path -LiteralPath $serviceKey) {
    $serviceSettings = Get-ItemProperty -LiteralPath $serviceKey
    # Do not output AppEnvironment / AppEnvironmentExtra: they may contain secrets.
    $serviceSettings | Select-Object Application, AppDirectory, AppParameters | Format-List | Out-Host
    if ($serviceSettings.PSObject.Properties.Name -contains 'AppDirectory') {
        $frontendRoot = [Environment]::ExpandEnvironmentVariables([string]$serviceSettings.AppDirectory)
        foreach ($relative in @('server.js', '.next\BUILD_ID', '.next\static', 'public')) {
            [pscustomobject]@{
                FrontendFile = $relative
                Present = (Test-Path -LiteralPath (Join-Path $frontendRoot $relative))
            } | Format-Table -AutoSize | Out-Host
        }
    }
}
else { Write-Host 'NSSM Parameters key not found. The service command above will identify its host.' }

Write-Host 'API HANDLER (configuration secrets omitted)'
$apiWebConfig = Join-Path $apiRoot 'web.config'
if (Test-Path -LiteralPath $apiWebConfig) {
    [xml]$config = [System.IO.File]::ReadAllText($apiWebConfig)
    $handler = $config.SelectSingleNode('//aspNetCore')
    if ($null -ne $handler) {
        $dllMatches = [regex]::Matches($handler.GetAttribute('arguments'), '(?i)[A-Za-z0-9_.-]+\.dll\b')
        [pscustomobject]@{
            ProcessPath = $handler.GetAttribute('processPath')
            EntryDll = (($dllMatches | ForEach-Object { $_.Value }) -join ', ')
            HostingModel = $handler.GetAttribute('hostingModel')
            EnvironmentVariableNames = (($handler.SelectNodes('environmentVariables/environmentVariable') |
                ForEach-Object { $_.GetAttribute('name') }) -join ', ')
        } | Format-List | Out-Host
    }
}
Get-ChildItem -LiteralPath $apiRoot -File -Filter 'appsettings*.json' |
    Select-Object Name | Format-Table -AutoSize | Out-Host

Write-Host 'PORTAL PROXY RULE TARGETS'
$portalWebConfig = Join-Path $portalRoot 'web.config'
if (Test-Path -LiteralPath $portalWebConfig) {
    [xml]$proxy = [System.IO.File]::ReadAllText($portalWebConfig)
    $proxy.SelectNodes('//rewrite/rules/rule') | ForEach-Object {
        $action = $_.SelectSingleNode('action')
        if ($null -ne $action) {
            [pscustomobject]@{ Rule = $_.GetAttribute('name'); Type = $action.GetAttribute('type'); Target = $action.GetAttribute('url') }
        }
    } | Format-Table -AutoSize | Out-Host
}

if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    Write-Host 'CURRENT HTTP RESPONSES (before deployment)'
    foreach ($url in @('http://127.0.0.1:3000/login', 'http://127.0.0.1:5000/api/Auth/login', 'https://portal.tygies.co.za/login', 'https://portal.tygies.co.za/api/Auth/login')) {
        try {
            $code = & curl.exe --silent --show-error --max-time 10 --output NUL --write-out '%{http_code}' $url
            $exitCode = $LASTEXITCODE
            Write-Host "$url -> HTTP $code; curl exit $exitCode"
        }
        catch { Write-Warning "HTTP probe could not complete: $url" }
    }
    Write-Host 'An API login GET returning 405 is expected: actual login uses POST.'
}

if (-not $SkipDatabase) {
    Write-Host "DATABASE READ CHECK: $SqlServer / $Database, using your current Windows login."
    Write-Host 'This target comes from the recorded setup; it does not read or print the live connection string.'
    Add-Type -AssemblyName System.Data
    $connection = [System.Data.SqlClient.SqlConnection]::new()
    $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
    $builder.DataSource = $SqlServer
    $builder.InitialCatalog = $Database
    $builder.IntegratedSecurity = $true
    $builder.Encrypt = $true
    $builder.TrustServerCertificate = $true
    $builder.ConnectTimeout = 10
    $builder.ApplicationName = 'NKRN read-only deployment check'
    $connection.ConnectionString = $builder.ConnectionString
    $command = $null
    $adapter = $null
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandText = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Database-Preflight.sql'))
        $command.CommandTimeout = 30
        $adapter = [System.Data.SqlClient.SqlDataAdapter]::new($command)
        $data = [System.Data.DataSet]::new()
        [void]$adapter.Fill($data)
        foreach ($table in $data.Tables) {
            if ($table.Rows.Count -gt 0) { $table | Format-Table -AutoSize | Out-Host }
        }
        Write-Host 'Database inspection finished. PRESENT fields do not replace a migration test on a restored backup.'
    }
    catch {
        Write-Warning 'Database inspection did not complete. Open Database-Preflight.sql in SSMS on TYGIES-SQL, select Tygerpoort_ITDesk, and run it there.'
        if ($_.Exception.PSObject.Properties.Name -contains 'Number') {
            Write-Host "SQL error number: $($_.Exception.Number)"
        }
        # Do not dump a connection string or credentials into a shareable report.
    }
    finally {
        if ($null -ne $adapter) { $adapter.Dispose() }
        if ($null -ne $command) { $command.Dispose() }
        $connection.Dispose()
    }
}

Write-Host ''
Write-Host 'INSPECTION FINISHED. Share this console output with Codex.' -ForegroundColor Green
Write-Host 'No application files, service settings or database records were changed.'
