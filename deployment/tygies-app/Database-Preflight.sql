-- READ ONLY: select the intended database in SSMS before running.
-- Expected production target: TYGIES-SQL / Tygerpoort_ITDesk.
-- Also run against the restored TEST copy before and after the migration scripts.
-- Missing metadata can also mean this login does not have permission to see it.
SET NOCOUNT ON;
SET LOCK_TIMEOUT 5000;

SELECT
    CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS ServerName,
    DB_NAME() AS DatabaseName,
    CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS SqlVersion,
    compatibility_level AS CompatibilityLevel
FROM sys.databases WHERE name = DB_NAME();

DECLARE @Baseline TABLE (TableName sysname NOT NULL);
INSERT INTO @Baseline (TableName) VALUES
('Users'), ('Requests'), ('Categories'), ('Statuses'), ('RequestComments'),
('ModulePermissions'), ('Locations'), ('VenueBookings'),
('LogisticsDepartments'), ('LogisticsWorkers'), ('LogisticsTasks'),
('LogisticsWorkPlanItems'), ('LogisticsJobCards'), ('LogisticsJobCardItems'),
('LogisticsSettings'), ('LogisticsRequests'), ('LogisticsRequestLocations'),
('LogisticsRequestEquipment'), ('LogisticsRequestMaintenanceItems'),
('LogisticsEquipmentTypes'), ('LogisticsMaintenanceTypes');

SELECT TableName AS BaselineTable,
    CASE WHEN OBJECT_ID('dbo.' + TableName, 'U') IS NULL
        THEN 'MISSING OR NOT VISIBLE - investigate before migration'
        ELSE 'PRESENT' END AS Result
FROM @Baseline ORDER BY TableName;

DECLARE @Additions TABLE (TableName sysname, ColumnName sysname, ScriptName nvarchar(100));
INSERT INTO @Additions VALUES
('Users', 'IsActive', '20260811_AddUsersIsActive.sql'),
('Requests', 'CreatedByUserID', '20260915_AddRequestCreatedByUserID.sql'),
('LogisticsWorkPlanItems', 'CalendarEventID', '20260913_LogisticsAutomation.sql'),
('LogisticsWorkPlanItems', 'CalendarSyncStatus', '20260913_LogisticsAutomation.sql'),
('LogisticsWorkPlanItems', 'CalendarSyncError', '20260913_LogisticsAutomation.sql'),
('LogisticsWorkPlanItems', 'CalendarSyncedAt', '20260913_LogisticsAutomation.sql'),
('LogisticsJobCards', 'DeliveryNote', '20260913_LogisticsAutomation.sql'),
('LogisticsJobCardItems', 'PlannedStart', '20260913_LogisticsAutomation.sql'),
('LogisticsJobCardItems', 'PlannedEnd', '20260913_LogisticsAutomation.sql');
SELECT TableName + '.' + ColumnName AS UpgradeField,
    CASE WHEN COL_LENGTH('dbo.' + TableName, ColumnName) IS NULL
        THEN 'MISSING' ELSE 'PRESENT' END AS Result,
    ScriptName
FROM @Additions;

SELECT 'FunksieversorgingRequests' AS UpgradeTable,
    CASE WHEN OBJECT_ID('dbo.FunksieversorgingRequests', 'U') IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS Result
UNION ALL
SELECT 'FunksieversorgingRequestItems',
    CASE WHEN OBJECT_ID('dbo.FunksieversorgingRequestItems', 'U') IS NULL THEN 'MISSING' ELSE 'PRESENT' END;

SELECT 'UX_LogisticsJobCards_JobCardDate' AS UpgradeIndex,
    CASE WHEN EXISTS (SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.LogisticsJobCards')
        AND name = 'UX_LogisticsJobCards_JobCardDate' AND is_unique = 1 AND is_disabled = 0)
        THEN 'PRESENT' ELSE 'MISSING OR NOT ENABLED/UNIQUE' END AS Result;

IF COL_LENGTH('dbo.LogisticsJobCards', 'JobCardDate') IS NOT NULL
    EXEC sys.sp_executesql N'
        SELECT COUNT_BIG(*) AS DuplicateJobCardDates
        FROM (SELECT JobCardDate FROM dbo.LogisticsJobCards
            GROUP BY JobCardDate HAVING COUNT_BIG(*) > 1) D;';

IF COL_LENGTH('dbo.LogisticsSettings', 'SettingsID') IS NOT NULL
AND COL_LENGTH('dbo.LogisticsSettings', 'DailyJobCardEnabled') IS NOT NULL
AND COL_LENGTH('dbo.LogisticsSettings', 'DailyJobCardTime') IS NOT NULL
AND COL_LENGTH('dbo.LogisticsSettings', 'WeekdaysOnly') IS NOT NULL
    EXEC sys.sp_executesql N'
        SELECT SettingsID, DailyJobCardEnabled, DailyJobCardTime, WeekdaysOnly
        FROM dbo.LogisticsSettings WHERE SettingsID = 1;';

IF OBJECT_ID('dbo.Requests', 'U') IS NOT NULL
    EXEC sys.sp_executesql N'SELECT COUNT_BIG(*) AS ExistingITRequests FROM dbo.Requests;';

IF COL_LENGTH('dbo.Requests', 'CreatedByUserID') IS NOT NULL
    EXEC sys.sp_executesql N'
        SELECT COUNT_BIG(*) AS RequestsWithNoCreatedByUserID
        FROM dbo.Requests WHERE CreatedByUserID IS NULL;';

-- These scheduling fields belong to the EXISTING IT schema. The four additive
-- scripts in this release do not create them. Report missing fields for review.
SELECT C.ColumnName AS ExistingITField,
    CASE WHEN COL_LENGTH('dbo.Requests', C.ColumnName) IS NULL
        THEN 'MISSING - baseline migration review needed' ELSE 'PRESENT' END AS Result
FROM (VALUES ('ScheduledStart'), ('ScheduledEnd'), ('GoogleCalendarEventID')) C(ColumnName);
