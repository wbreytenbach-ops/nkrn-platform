# IT requests logged on behalf of another person

Prepared 15 September 2026 for the NKRN Q4 update.

Admins now have a **Versoek vir / Request for** field on `/requests`. It defaults
to the signed-in admin and offers active staff accounts by surname, name and
email. Teachers and technicians continue to create their own requests.

The selected person owns the request, sees it in My Requests, and receives the
creation and subsequent status emails. Active admins still receive the creation
notification. Addresses are trimmed and deduplicated without regard to case.
The admin who entered the request is recorded separately as **Aangemeld deur /
Logged by**, visible in request details and included in exports.

The API enforces the permission using both the authenticated role and the
current account record. The creation input accepts an optional
`requestedForUserID`; requester IDs must identify an active account with a valid
email address. Client-supplied `userID`, `createdByUserID`, status, assignment,
dates and request ID cannot override the server's creation values. Existing
clients that omit the new field continue to create requests for themselves.
The existing update endpoint preserves requester and submitter IDs.

## Source and integration

- Base repository: `wbreytenbach-ops/nkrn-platform`, `tygerpoort-q4-2026`, commit
  `45dad51fcda84f2d4cb54756a176aec802e0ff29`.
- IT pages and the label dictionary use the newer `IT-MININPUT-SOURCE.txt`
  supplied on 14 September 2026. Its controller and request model matched the
  branch; its Afrikaans page changes are preserved in the replacement files.
- This change is the IT requester feature within the broader language and AI
  update. It uses the existing `itLabel` dictionary for its new labels; the
  platform-wide language selector and AI features are separate work.
- The technician status-update payload now includes the complete selected
  request, as required by the existing PUT endpoint. Its staff dropdown uses
  the existing technician-authorized endpoint. These keep the resulting
  request's assignment and status workflow usable.
- `EmailService.SendEmailAsync` is virtual so tests can capture emails without
  contacting SMTP. Production delivery behavior remains in the existing method.

## Apply and deploy

1. Integrate the supplied files at their matching paths under the NKRN project
   root. These are complete files. If your local IT files changed after the
   supplied 14 September snapshot, merge those changes before replacing them.
2. Run `api/NKRN.API/Database/20260915_AddRequestCreatedByUserID.sql` against the
   correct NKRN SQL Server database **before starting the updated API**. It adds
   one nullable integer column and initializes historical submitter IDs from
   their existing recorded UserID. It does not change any request's UserID.
   The script follows this repository's manual SQL update approach and can be
   rerun safely. It has not been executed against the school's database.
3. From the project root, validate with .NET 10 and the project's Node setup:

   ```powershell
   dotnet build .\api\NKRN.API\NKRN.API.csproj -c Release
   dotnet test .\tests\NKRN.Requests.Tests\NKRN.Requests.Tests.csproj -c Release
   npm --prefix .\web run build
   ```

4. Deploy the API and frontend together through the existing NKRN release
   process, with the normal production API and SMTP configuration. After the
   database change, the old API can still run if an application rollback is
   required; retain the new audit column and its values.

Jimmy's existing requests have not been reassigned. Historical backfill retains
the person already recorded by the old application. The actual people behind
those requests cannot be inferred from their titles.

## Verification completed

- Frontend TypeScript check and lint for all changed IT files passed.
- Frontend production build passed.
- API Release build passed.
- All 17 API integration test cases passed using the real MVC endpoints,
  authorization filters, model binding and controllers, an in-memory database,
  and captured email delivery. Coverage includes admin-only selection, inactive
  or invalid requesters, stale role claims, legacy payloads, protected audit
  fields, owner visibility, status emails, duplicate recipients, and isolated
  email failure.
- The SQL script was reviewed, but SQL Server execution remains unverified.
- The cloud browser blocked access to the local preview. Visual/browser
  interaction testing remains outstanding.
- Tests sent no real email and did not touch production data. Nothing has been
  deployed to `portal.tygies.co.za` by this change.

The Q4 branch's existing validation workflow is separate from these local
results: it currently specifies .NET 8 despite the API targeting .NET 10, and
its known Logistics lint repair is outside this feature's replacement files.
