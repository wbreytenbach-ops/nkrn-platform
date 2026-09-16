# Logistics request workflow update

This update is source code, not a live deployment. Keep using the existing Windows build, Copy-Item -ToSession, staging, backup and service cutover process. No ZIP is needed.

## Behaviour

- Requests use Logged → Busy → Done in the interface. Priorities are Low, Medium, High and Critical. Existing storage codes are retained to preserve compatibility with the production schema and historical cards; this is not a destructive status migration.
- Managers can change status directly without creating a task. Optional work assignment links a task for scheduling and worker cards. Changes to a linked task's status update its request and notify the requester; request status changes update the linked task.
- Active admins can delete Logistics requests after confirmation. Deletion removes them from request views and prevents edits/conversion/comments. The record retains who deleted it and when. Existing linked tasks and job-card snapshots are retained; deletion is not cancellation of assigned work.
- Managers can edit title, description, dates, times, category, locations, equipment and maintenance items at any status. Edits are recorded in the comment history. Existing task allocations and previously generated job cards must be reviewed separately when the work specification changes.
- Owners and Logistics managers can read and add comments. Comments are shared with both; they are not private manager notes.
- Request creation, status changes, edits and comments notify the requester, active role-3 administrators and mcarnie@tygies.co.za. Duplicate addresses are removed. A delivery failure does not undo a saved request. The manager address is configurable under Logistics:ManagerEmail.
- Every email sent by the shared email service has an Open NKRN Portal / Maak NKRN-portaal oop button linking to https://portal.tygies.co.za. Links do not contain login tokens.
- Daily master job cards go to terreinbestuur@tygies.co.za and mcarnie@tygies.co.za in one SMTP submission. New plural configuration LogisticsAutomation:MasterRecipientEmails replaces the old single MasterRecipientEmail setting for this purpose. A sent card is not automatically resent when recipients change.
- Cards retain their generated snapshot. Managers use Job-card history → View / Print → select a worker → Print worker card, or Save as PDF in the print dialog. Workers are not emailed automatically.
- Empty daily cards state that no work is currently scheduled. Delivery failures or ambiguous outcomes remain marked for manager review, preventing silent repeat sends.

## Update sequence

1. Obtain this revision in the existing repository. Build the API and web locally and run the tests below.
2. Keep the Logistics scheduler paused during migration and smoke checks. Take a fresh production database backup and application backup using the same process as the previous release.
3. In SSMS, first test `api/NKRN.API/Database/20260916_LogisticsRequestDeletion.sql` against the restored test database. It adds deletion audit fields and the comment table. Then apply it to Tygerpoort_ITDesk before deploying the new API.
4. Ensure mcarnie@tygies.co.za has exactly one active portal account. Run `20260916_LogisticsManagerAndSchedule.sql`. It grants Logistics management without granting system-admin deletion rights, preserves other managers, enables daily cards including weekends, and preserves the existing scheduled time. No account password is changed.
5. Publish the new API, build the standalone frontend using NEXT_PUBLIC_API_URL=https://portal.tygies.co.za, and copy to a new C:\NKRN-Deploy staging folder through $session. Include frontend public and .next/static as before. Do not overwrite live appsettings, GoogleAuth, portal proxy configuration or service configuration.
6. Use the same backed-up API/frontend cutover process as the preceding deployment. Keep the temporary LogisticsAutomation__Enabled=false override until the portal checks pass.
7. Verify the login, both languages, Logged/Busy/Done filters, editing, comments as owner/manager, admin-only deletion, and printing a worker card. Verify deletion against a test request that is explicitly identified as disposable. Do not bulk-delete production requests merely because their status is New.
8. Configure production LogisticsAutomation:MasterRecipientEmails to the two addresses above if there is an existing override. The new defaults already contain both. Ensure Logistics:ManagerEmail is mcarnie@tygies.co.za if overridden.
9. Enable LogisticsAutomation:Enabled after checks. Check both appsettings and the temporary web.config environment override: the override takes precedence. IIS must keep the API application active for its in-process scheduler to run daily: application pool AlwaysRunning, idle timeout disabled, site/application preload enabled with Application Initialization installed. Verify these settings on TYGIES-APP rather than assuming them. Preserve the API identity and HTTPS/proxy configuration.
10. The scheduler checks every minute and uses the existing configured DailyJobCardTime (or explicit DailyRunTime override), in Africa/Johannesburg. If enabled after today's due time it can send today's unsent card immediately. Check each intended inbox before resolving any uncertain delivery record.

## Local checks

Run from the project directory in PowerShell:

```powershell
dotnet build .\api\NKRN.API\NKRN.API.csproj -c Release
dotnet test .\tests\NKRN.Requests.Tests\NKRN.Requests.Tests.csproj -c Release
npm --prefix .\web run lint
npm --prefix .\web run build
```

The automated tests cover recipient deduplication, delivery failure isolation, development email suppression, deletion authorization and the portal button, alongside existing IT tests. SQL Server integration, IIS scheduler uptime and actual SMTP delivery need environment checks; the in-memory tests do not prove these.

## Bulk cleanup

`PreviewLogisticsRequestCleanup.sql` is read-only and lists Logistics rows with stored status New (displayed as Logged). Before a deletion query is prepared, identify whether the intended scope is these rows, recent test request IDs, or a date cutoff, and whether IT/Funksieversorging are also included. No records have been deleted by this update.

IIS scheduler setup reference: [Microsoft: Application Initialization and idle timeout](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/advanced?view=aspnetcore-10.0#application-initialization-module-and-idle-timeout).
