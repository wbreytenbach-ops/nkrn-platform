SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.FunksieversorgingRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FunksieversorgingRequests
    (
        RequestID INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_FunksieversorgingRequests PRIMARY KEY,
        RequestedByUserID INT NOT NULL,
        NeededDate DATE NOT NULL,
        FunctionName NVARCHAR(200) NOT NULL,
        Venue NVARCHAR(100) NOT NULL,
        OtherVenue NVARCHAR(200) NULL,
        Attendance INT NOT NULL,
        Notes NVARCHAR(1000) NULL,
        ReturnAcknowledged BIT NOT NULL
            CONSTRAINT DF_FunksieversorgingRequests_ReturnAcknowledged DEFAULT (0),
        LeadTimeWarning BIT NOT NULL
            CONSTRAINT DF_FunksieversorgingRequests_LeadTimeWarning DEFAULT (0),
        Status NVARCHAR(30) NOT NULL
            CONSTRAINT DF_FunksieversorgingRequests_Status DEFAULT ('Logged'),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_FunksieversorgingRequests_CreatedAt DEFAULT (SYSDATETIME()),
        NotificationSentAt DATETIME2(0) NULL,
        NotificationError NVARCHAR(1000) NULL,

        CONSTRAINT FK_FunksieversorgingRequests_Users
            FOREIGN KEY (RequestedByUserID)
            REFERENCES dbo.Users(UserID),

        CONSTRAINT CK_FunksieversorgingRequests_Attendance
            CHECK (Attendance > 0)
    );

    CREATE INDEX IX_FunksieversorgingRequests_RequestedByUserID
        ON dbo.FunksieversorgingRequests(RequestedByUserID, CreatedAt DESC);

    CREATE INDEX IX_FunksieversorgingRequests_NeededDate
        ON dbo.FunksieversorgingRequests(NeededDate);
END;

IF OBJECT_ID('dbo.FunksieversorgingRequestItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FunksieversorgingRequestItems
    (
        RequestItemID INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_FunksieversorgingRequestItems PRIMARY KEY,
        RequestID INT NOT NULL,
        ItemCode NVARCHAR(80) NOT NULL,
        ItemName NVARCHAR(200) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        RequestedQuantity INT NOT NULL,
        RecordedAvailableQuantity INT NULL,
        IsAttendanceDerived BIT NOT NULL
            CONSTRAINT DF_FunksieversorgingRequestItems_AttendanceDerived DEFAULT (0),

        CONSTRAINT FK_FunksieversorgingRequestItems_Request
            FOREIGN KEY (RequestID)
            REFERENCES dbo.FunksieversorgingRequests(RequestID)
            ON DELETE CASCADE,

        CONSTRAINT CK_FunksieversorgingRequestItems_Quantity
            CHECK (RequestedQuantity > 0)
    );

    CREATE INDEX IX_FunksieversorgingRequestItems_RequestID
        ON dbo.FunksieversorgingRequestItems(RequestID);
END;

COMMIT;
