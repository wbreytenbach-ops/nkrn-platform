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
        CreatedAt datetime2(0) NOT NULL
            CONSTRAINT DF_AiRequestAnalyses_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_AiRequestAnalyses_Module_Request
        ON dbo.AiRequestAnalyses(ModuleKey, RequestID, CreatedAt DESC);
END;
GO
