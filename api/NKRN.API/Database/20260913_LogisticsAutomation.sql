-- NKRN Q4 2026 additive upgrade. SQL Server 2016. Review and apply separately.
-- No databases or tables are created/dropped. Existing Logistics schema is required.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.LogisticsWorkPlanItems', 'CalendarEventID') IS NULL
    ALTER TABLE dbo.LogisticsWorkPlanItems ADD CalendarEventID nvarchar(1024) NULL;
IF COL_LENGTH('dbo.LogisticsWorkPlanItems', 'CalendarSyncStatus') IS NULL
    ALTER TABLE dbo.LogisticsWorkPlanItems ADD CalendarSyncStatus nvarchar(40) NULL;
IF COL_LENGTH('dbo.LogisticsWorkPlanItems', 'CalendarSyncError') IS NULL
    ALTER TABLE dbo.LogisticsWorkPlanItems ADD CalendarSyncError nvarchar(max) NULL;
IF COL_LENGTH('dbo.LogisticsWorkPlanItems', 'CalendarSyncedAt') IS NULL
    ALTER TABLE dbo.LogisticsWorkPlanItems ADD CalendarSyncedAt datetime2 NULL;
IF COL_LENGTH('dbo.LogisticsJobCards', 'DeliveryNote') IS NULL
    ALTER TABLE dbo.LogisticsJobCards ADD DeliveryNote nvarchar(max) NULL;
IF COL_LENGTH('dbo.LogisticsJobCardItems', 'PlannedStart') IS NULL
    ALTER TABLE dbo.LogisticsJobCardItems ADD PlannedStart time NULL;
IF COL_LENGTH('dbo.LogisticsJobCardItems', 'PlannedEnd') IS NULL
    ALTER TABLE dbo.LogisticsJobCardItems ADD PlannedEnd time NULL;
IF EXISTS (SELECT JobCardDate FROM dbo.LogisticsJobCards GROUP BY JobCardDate HAVING COUNT(*) > 1)
    THROW 51001, 'Existing duplicate daily cards require manual review; no data was removed.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.LogisticsJobCards') AND name = 'UX_LogisticsJobCards_JobCardDate')
    CREATE UNIQUE INDEX UX_LogisticsJobCards_JobCardDate ON dbo.LogisticsJobCards(JobCardDate);
COMMIT;
