# Deploy NKRN through a PowerShell session

Use this guide on your Windows development PC. The target is TYGIES-APP and the source must be the reviewed `logistics-release-candidate-20261009` branch. The builder records the exact full Git commit SHA in `release.json`; it does not use a historical pinned application commit.

Run blocks one at a time in the same **Windows PowerShell 5.1** window. Stop at an error; do not continue with later blocks. The scripts passed PowerShell syntax checks but have not been executed against your Windows servers here. Nothing is deployed merely by downloading this kit.

## 1. Open the local PowerShell window and update your checkout

These files are in the repository under `deployment/tygies-app`. On your development PC, update the existing Q4 branch:

```powershell
$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\WilcoB\Documents\Visual Studio Projects\NKRN'
Set-Location -LiteralPath $projectRoot
$currentBranch = git branch --show-current
if ($LASTEXITCODE -ne 0 -or $currentBranch -ne 'logistics-release-candidate-20261009') { throw 'Open the logistics-release-candidate-20261009 branch before pulling this update' }
git pull --ff-only origin logistics-release-candidate-20261009
if ($LASTEXITCODE -ne 0) { throw 'Git pull failed. Resolve the reported issue before continuing.' }
$kitRoot = Join-Path $projectRoot 'deployment\tygies-app'
```

If your prompt starts with `[TYGIES-APP]:`, type `Exit-PSSession` once to return to your local prompt before running these commands. Operations below use `$session` to send individual commands to the server. `Copy-Item -ToSession` runs on your PC, where the source files exist.

The builder packages the exact committed `HEAD` of `logistics-release-candidate-20261009`. It stops if tracked files have uncommitted changes. The manifest contains the full commit SHA and the release ID starts with that commit's short SHA.

## 2. Connect to TYGIES-APP

If you already have an open `$session` connected to TYGIES-APP, reuse it and skip the two creation commands. Otherwise:

```powershell
$credential = Get-Credential -UserName 'TYGERPOORTLAB\wilcob' -Message 'Enter your TYGIES-APP administrator credentials'
$session = New-PSSession -ComputerName 'TYGIES-APP' -Credential $credential
```

Verify the actual destination:

```powershell
Invoke-Command -Session $session -ScriptBlock {
    if ($env:COMPUTERNAME -ine 'TYGIES-APP') { throw 'Wrong server.' }
    hostname.exe
}
```

Expected output: `TYGIES-APP`. Use an account authorised to manage the existing IIS sites and frontend service. The password is entered into the Windows credential prompt, not pasted into the chat or a script.

If the hostname cannot resolve, connect to the school network/VPN and check DNS. If WinRM is not configured, run `Enable-PSRemoting -Force` once in elevated Windows PowerShell **directly on TYGIES-APP**, then retry the connection. If access is denied, use the appropriate server administrator account; do not change unrelated server permissions.

References: [New-PSSession](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/new-pssession?view=powershell-5.1), [Copy-Item remote transfers](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/copy-item).

## 3. Build the Windows production package on your PC

If the earlier build script already printed **RELEASE PACKAGE READY** for this exact commit, skip rebuilding and select that completed ZIP in the next block.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$kitRoot\Build-Release.ps1" -ProjectRoot $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Do not continue with an incomplete release.' }
```

The build uses your committed source and `https://portal.tygies.co.za` as the frontend API address. It preserves your local `.env.local`. It includes the full standalone frontend, public assets and static chunks, plus the published Windows API. It requires Node 22 and the .NET 10 SDK on your PC. It stops if the API needs a runtime newer than the server's reported 10.0.11.

The execution-policy flag applies only to that process; no saved policy is changed.

When the build finishes, copy the full ZIP path printed after `ZIP:`. Run the following block, then paste that path when prompted, without surrounding quotation marks:

```powershell
$releaseZip = (Read-Host 'Paste the full release ZIP path printed by the build').Trim().Trim('"')
$releaseZip = (Resolve-Path -LiteralPath $releaseZip).ProviderPath
$hashFile = $releaseZip + '.sha256.txt'
if (-not (Test-Path -LiteralPath $hashFile)) { throw 'The completed-build hash file is missing.' }

$expectedHash = (Get-FileHash -LiteralPath $releaseZip -Algorithm SHA256).Hash
$recordedHash = ((Get-Content -LiteralPath $hashFile -Raw) -split '\s+')[0]
if ($expectedHash -ine $recordedHash) { throw 'The release ZIP does not match its build hash.' }

$releaseName = [System.IO.Path]::GetFileNameWithoutExtension($releaseZip)
if ($releaseName -notmatch '^NKRN-[a-f0-9]{7}-[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$') { throw 'Select the release ZIP, not source.zip or the deployment kit ZIP.' }
$remoteRoot = 'C:\NKRN-Deploy\' + $releaseName
$remoteZip = $remoteRoot + '\release.zip'
$remotePackage = $remoteRoot + '\package'
```

## 4. Copy through $session and verify the transfer

```powershell
Invoke-Command -Session $session -ArgumentList $remoteRoot -ScriptBlock {
    param($destination)
    $ErrorActionPreference = 'Stop'
    if ($env:COMPUTERNAME -ine 'TYGIES-APP') { throw 'Wrong server.' }
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
}

Copy-Item -LiteralPath $releaseZip -Destination $remoteZip -ToSession $session -Force

foreach ($file in @('Inspect-Server.ps1', 'Database-Preflight.sql', 'Deploy-Release.ps1')) {
    Copy-Item -LiteralPath (Join-Path $kitRoot $file) -Destination ($remoteRoot + '\' + $file) -ToSession $session -Force
}

Invoke-Command -Session $session -ArgumentList $remoteZip, $remotePackage, $expectedHash -ScriptBlock {
    param($zip, $package, $expected)
    $ErrorActionPreference = 'Stop'
    $actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
    if ($actual -ine $expected) { throw 'The transferred ZIP hash differs. Stop and copy it again.' }
    if (Test-Path -LiteralPath $package) { throw 'This package is already extracted. Inspect its deployment state before repeating this step.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $package)
    Get-Content -LiteralPath (Join-Path $package 'release.json') -Raw
}

$savedPaths = @{ remoteRoot = $remoteRoot; remotePackage = $remotePackage; releaseZip = $releaseZip }
[System.IO.File]::WriteAllText((Join-Path $kitRoot 'session-deploy-paths.json'), ($savedPaths | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
```

Confirm the printed manifest has the exact candidate commit SHA reported by the build and publicApiUrl `https://portal.tygies.co.za`.

## 5. Inspect the existing application setup

```powershell
Invoke-Command -Session $session -ArgumentList $remoteRoot -ScriptBlock {
    param($root)
    $ErrorActionPreference = 'Stop'
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Inspect-Server.ps1') -SkipDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Server inspection failed.' }
}
```

The installer verifies the frontend service configuration but does not replace the frontend in this release.

SQL is deliberately omitted from this remote check. A PC -> TYGIES-APP -> TYGIES-SQL connection can fail because your Windows credentials are not automatically delegated to the second server. Connect directly from your PC to TYGIES-SQL using SSMS for the next step. [Microsoft explanation of the second hop](https://learn.microsoft.com/en-us/powershell/scripting/security/remoting/ps-remoting-second-hop?view=powershell-7.5).

## 6. Back up and verify the SQL update before installation

The project's `docs/Q4-2026-implementation-plan.md` requires migration verification on a restored backup. Existing build/unit-test successes do not establish the production schema. This is a technical deployment prerequisite, not a new approval request.

In SSMS on your PC, connect directly to **TYGIES-SQL**, using your authorised Windows account. Select **Tygerpoort_ITDesk**, and privately confirm this is the database used by the live API. Do not share its connection string/password.

1. Open the kit's `Database-Preflight.sql`, check the selected database, and execute it. Existing baseline tables must be present, and `DuplicateJobCardDates` must be zero. Missing upgrade columns/tables identify updates that still need applying; missing baseline tables or IT scheduling fields need investigation before proceeding.
2. Right-click Tygerpoort_ITDesk -> Tasks -> Back Up. Select **Full**, enable **Copy-only backup**, choose a new backup file in the SQL server's backup directory, and enable checksum/verification as available. Record the successful result. The destination belongs to TYGIES-SQL and must be writable by the SQL service.
3. Restore this backup to a **new test database name**, for example `Tygerpoort_ITDesk_Q4Check_20260915` if that name is unused. In the restore dialog, ensure both the destination database and physical data/log file paths are different from production. Leave the existing production database intact.
4. The release build also has its extracted package on your PC, beside the release ZIP, under `package\database`. Apply the following four scripts individually and in order to the restored **test** database first. Stop on the first error:

   - `20260811_AddUsersIsActive.sql`
   - `20260913_LogisticsAutomation.sql`
   - `20260914_Funksieversorging.sql`
   - `20260915_AddRequestCreatedByUserID.sql`

5. Run the preflight again. Verify all upgrade fields/tables exist, the daily-card unique index is present, and duplicate daily-card dates remain zero. Compare request counts and original requester ownership with the pre-migration test copy. The requester migration fills CreatedByUserID without changing UserID.
6. After successful test-copy verification, take a fresh copy-only production backup. Select **Tygerpoort_ITDesk** explicitly in SSMS and apply the same four scripts, individually, in the same order. Run the preflight again. Proceed to the application switch only after successful SQL results.

These scripts extend the existing schema. They do not create the original Logistics system or import Google Form history. Do not recreate the live database or run older EF baseline migrations as a substitute. A full database restore is not the normal application rollback, since it can discard requests submitted after the backup.

## 7. Install through the same $session

This is the live application switch and creates a short outage. The database step above must already be complete. Run it during the intended update window and keep this local PowerShell window open.

```powershell
Invoke-Command -Session $session -ArgumentList $remoteRoot, $remotePackage -ScriptBlock {
    param($root, $package)
    $ErrorActionPreference = 'Stop'
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Deploy-Release.ps1') -Action Install -PackageRoot $package
    if ($LASTEXITCODE -ne 0) { throw 'Application installation failed. Review the rollback message and deployment state.' }
}
```

The current installer updates the API in place only. It saves an IIS configuration backup and verifies a complete API backup before overlaying files. The frontend service and NKRN Portal site are deliberately left running and untouched.

The API stage retains the existing production `web.config`, appsettings, token storage and application data with their existing permissions. Published API files are overlaid, and the API launch target is updated to `NKRN.API.dll` while existing environment variables and IIS custom configuration remain.

An installation error triggers an attempted application rollback. If rollback also errors, keep the output and inspect the saved deployment state before further changes. No database rollback is attempted automatically.

## 8. Check the live release

```powershell
Invoke-Command -Session $session -ScriptBlock {
    foreach ($url in @('http://127.0.0.1:3000/login', 'http://127.0.0.1:5000/api/Auth/login', 'https://portal.tygies.co.za/login', 'https://portal.tygies.co.za/api/Auth/login')) {
        $status = & curl.exe --silent --show-error --max-time 15 --output NUL --write-out '%{http_code}' $url
        Write-Host "$url -> HTTP $status; curl exit $LASTEXITCODE"
    }
}

Start-Process 'https://portal.tygies.co.za/login'
```

Expected: login pages return 200; GET requests to the API login route return 405 because real login uses POST. Redirects need interpretation in the context of the HTTPS proxy. HTTP 000, 500 or 502 is not a successful check.

Sign in through the HTTPS portal. Verify the new homepage, English/Afrikaans selection, accents, refresh/navigation, existing request history, and the admin requester selector. Open Logistics and Funksieversorging with appropriate permissions, including existing work-plan/job-card/venue-booking views. Browser login POSTs must use the HTTPS portal API, not localhost.

405 alone proves neither successful login nor database access. If an old homepage appears, first verify the new release is active, then compare in a private browser window. Do not overwrite the release with an older source patch ZIP.

## 9. Restore the existing automation configuration after verification

Run this after the browser checks succeed. It removes the temporary pause and restores the original API environment override, if one existed. Daily job cards may send once the API starts if their configured schedule is already due.

```powershell
Invoke-Command -Session $session -ArgumentList $remoteRoot, $remotePackage -ScriptBlock {
    param($root, $package)
    $ErrorActionPreference = 'Stop'
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Deploy-Release.ps1') -Action ResumeAutomation -PackageRoot $package
    if ($LASTEXITCODE -ne 0) { throw 'Automation configuration restore failed.' }
}
```

Recheck login after the API pool recycles. Confirm the intended Logistics schedule/calendar settings and Funksieversorging notification recipient are configured. This deployment preserves existing settings; it does not invent new recipient addresses or send a test request to staff.

## 10. Roll back if the application checks fail

Use this instead of accepting a broken release:

```powershell
Invoke-Command -Session $session -ArgumentList $remoteRoot, $remotePackage -ScriptBlock {
    param($root, $package)
    $ErrorActionPreference = 'Stop'
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'Deploy-Release.ps1') -Action Rollback -PackageRoot $package
    if ($LASTEXITCODE -ne 0) { throw 'Rollback needs attention. Keep the error output and deployment-state.json.' }
}
```

Rollback stops only the API, restores the verified API backup in place, and restarts the API. It does not replace or restart the frontend, and it leaves additive SQL changes and database request records intact. Confirm login and request history after rollback. Do not delete the backup until the portal has been verified.

This script does not restore the entire server's IIS configuration, which could affect unrelated sites. The IIS backup remains available for a targeted review if needed.

## 11. Recover variables after closing PowerShell

Create a fresh `$session` as in step 2. Then:

```powershell
$projectRoot = 'C:\Users\WilcoB\Documents\Visual Studio Projects\NKRN'
$kitRoot = Join-Path $projectRoot 'deployment\tygies-app'
$paths = Get-Content -LiteralPath (Join-Path $kitRoot 'session-deploy-paths.json') -Raw | ConvertFrom-Json
$remoteRoot = $paths.remoteRoot
$remotePackage = $paths.remotePackage

Invoke-Command -Session $session -ArgumentList $remoteRoot -ScriptBlock {
    param($root)
    Get-Content -LiteralPath (Join-Path $root 'deployment-state.json') -Raw
}
```

If the remoting connection dropped during installation, inspect this state and the service status first. Do not launch a second Install command against a deployment that may still be running. A stale `Installing` state after the original operation has ended can be recovered using the Rollback action.

When the release is verified, keep the backups and then close the session:

```powershell
Remove-PSSession -Session $session
```

AI implementation remains on hold. The Afrikaans NKRN-versus-Google-Forms presentation follows the portal deployment.
