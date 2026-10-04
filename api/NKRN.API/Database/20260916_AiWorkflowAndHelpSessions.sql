USE Tygerpoort_ITDesk;
GO

IF OBJECT_ID('dbo.AiRequestAnalyses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AiRequestAnalyses
    (
        AnalysisID int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AiRequestAnalyses PRIMARY KEY,
        ModuleKey nvarchar(50) NOT NULL,
        RequestID int NOT NULL,
        Provider nvarchar(80) NOT NULL,
        Model nvarchar(160) NULL,
        Success bit NOT NULL,
        Summary nvarchar(max) NULL,
        SuggestedTitle nvarchar(150) NULL,
        SuggestedCategory nvarchar(150) NULL,
        SuggestedPriority nvarchar(30) NULL,
        NeedsHuman bit NOT NULL,
        Confidence decimal(6,5) NOT NULL,
        RoutingReason nvarchar(1000) NULL,
        UserMessage nvarchar(max) NULL,
        TroubleshootingJson nvarchar(max) NULL,
        RuleTriggered bit NOT NULL CONSTRAINT DF_AiRequestAnalyses_RuleTriggered DEFAULT 0,
        RuleReason nvarchar(1000) NULL,
        CreatedAt datetime2(0) NOT NULL
            CONSTRAINT DF_AiRequestAnalyses_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_AiRequestAnalyses_Module_Request
        ON dbo.AiRequestAnalyses(ModuleKey, RequestID, CreatedAt DESC);
END;
GO

IF COL_LENGTH('dbo.AiRequestAnalyses', 'RuleTriggered') IS NULL
BEGIN
    ALTER TABLE dbo.AiRequestAnalyses
        ADD RuleTriggered bit NOT NULL
            CONSTRAINT DF_AiRequestAnalyses_RuleTriggered_Upgrade DEFAULT 0;
END;
GO

IF COL_LENGTH('dbo.AiRequestAnalyses', 'RuleReason') IS NULL
BEGIN
    ALTER TABLE dbo.AiRequestAnalyses
        ADD RuleReason nvarchar(1000) NULL;
END;
GO

IF OBJECT_ID('dbo.AiHelpSessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AiHelpSessions
    (
        SessionID uniqueidentifier NOT NULL
            CONSTRAINT PK_AiHelpSessions PRIMARY KEY,
        UserID int NOT NULL,
        ModuleKey nvarchar(50) NOT NULL,
        Description nvarchar(max) NOT NULL,
        AdditionalContext nvarchar(2500) NULL,
        Provider nvarchar(80) NULL,
        Model nvarchar(160) NULL,
        SuggestedTitle nvarchar(150) NULL,
        SuggestedCategory nvarchar(150) NULL,
        SuggestedRequestType nvarchar(30) NULL,
        SuggestedPriority nvarchar(30) NULL,
        NeedsHuman bit NOT NULL,
        Confidence decimal(6,5) NOT NULL,
        RuleTriggered bit NOT NULL,
        RuleReason nvarchar(1000) NULL,
        UserMessage nvarchar(max) NULL,
        TroubleshootingJson nvarchar(max) NULL,
        Outcome nvarchar(40) NOT NULL,
        RequestID int NULL,
        StartedAt datetime2(0) NOT NULL
            CONSTRAINT DF_AiHelpSessions_StartedAt DEFAULT SYSUTCDATETIME(),
        CompletedAt datetime2(0) NULL
    );

    CREATE INDEX IX_AiHelpSessions_User_Module_Started
        ON dbo.AiHelpSessions(UserID, ModuleKey, StartedAt DESC);

    CREATE INDEX IX_AiHelpSessions_Outcome
        ON dbo.AiHelpSessions(Outcome, StartedAt DESC);
END;
GO

IF OBJECT_ID('dbo.AiHelpMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AiHelpMessages
    (
        MessageID bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AiHelpMessages PRIMARY KEY,
        SessionID uniqueidentifier NOT NULL,
        Role nvarchar(20) NOT NULL,
        Content nvarchar(max) NOT NULL,
        CreatedAt datetime2(0) NOT NULL
            CONSTRAINT DF_AiHelpMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AiHelpMessages_AiHelpSessions
            FOREIGN KEY (SessionID)
            REFERENCES dbo.AiHelpSessions(SessionID)
    );

    CREATE INDEX IX_AiHelpMessages_Session
        ON dbo.AiHelpMessages(SessionID, MessageID);
END;
GO
