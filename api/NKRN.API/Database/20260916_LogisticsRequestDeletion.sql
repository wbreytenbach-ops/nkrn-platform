-- Run against the selected NKRN database before deploying the new API.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.LogisticsRequests', 'IsDeleted') IS NULL
    ALTER TABLE dbo.LogisticsRequests ADD IsDeleted bit NOT NULL CONSTRAINT DF_LogisticsRequests_IsDeleted DEFAULT (0);
IF COL_LENGTH('dbo.LogisticsRequests', 'DeletedAt') IS NULL
    ALTER TABLE dbo.LogisticsRequests ADD DeletedAt datetime2 NULL;
IF COL_LENGTH('dbo.LogisticsRequests', 'DeletedByUserID') IS NULL
    ALTER TABLE dbo.LogisticsRequests ADD DeletedByUserID int NULL;
IF OBJECT_ID('dbo.LogisticsRequestComments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LogisticsRequestComments (
        CommentID int IDENTITY(1,1) PRIMARY KEY,
        RequestID int NOT NULL REFERENCES dbo.LogisticsRequests(RequestID),
        UserID int NOT NULL REFERENCES dbo.Users(UserID),
        Body nvarchar(4000) NOT NULL,
        CreatedAt datetime2 NOT NULL CONSTRAINT DF_LogisticsRequestComments_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_LogisticsRequestComments_RequestID ON dbo.LogisticsRequestComments(RequestID, CommentID);
END;
COMMIT;
