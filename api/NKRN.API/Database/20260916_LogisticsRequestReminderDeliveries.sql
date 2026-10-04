USE Tygerpoort_ITDesk;
GO

IF OBJECT_ID('dbo.LogisticsRequestReminderDeliveries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LogisticsRequestReminderDeliveries
    (
        ReminderDeliveryID bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_LogisticsRequestReminderDeliveries
            PRIMARY KEY,

        RequestID int NOT NULL,
        ReminderType nvarchar(10) NOT NULL,
        RecipientEmail nvarchar(320) NOT NULL,

        Status nvarchar(20) NOT NULL,
        AttemptCount int NOT NULL
            CONSTRAINT DF_LogisticsRequestReminderDeliveries_AttemptCount
            DEFAULT 0,

        LastAttemptAt datetime2(0) NULL,
        SentAt datetime2(0) NULL,
        ErrorMessage nvarchar(1000) NULL,

        CreatedAt datetime2(0) NOT NULL
            CONSTRAINT DF_LogisticsRequestReminderDeliveries_CreatedAt
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_LogisticsRequestReminderDeliveries
            UNIQUE (RequestID, ReminderType, RecipientEmail),

        CONSTRAINT CK_LogisticsRequestReminderDeliveries_ReminderType
            CHECK (ReminderType IN ('7D','1D')),

        CONSTRAINT CK_LogisticsRequestReminderDeliveries_Status
            CHECK (Status IN ('Sending','Sent','Failed'))
    );

    CREATE INDEX IX_LogisticsRequestReminderDeliveries_Request
        ON dbo.LogisticsRequestReminderDeliveries
        (
            RequestID,
            ReminderType,
            Status
        );
END;
GO
