/* Tygies One: persistent mentions/notifications for IT request conversations.
   Idempotent. Apply to Tygerpoort_ITDesk BEFORE deploying the new API.
   Does not alter or delete any existing requests or comments. */
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.Users',N'U') IS NULL OR
       OBJECT_ID(N'dbo.Requests',N'U') IS NULL OR
       OBJECT_ID(N'dbo.RequestComments',N'U') IS NULL
        THROW 50001, 'Required NKRN IT tables missing. Confirm Tygerpoort_ITDesk database.', 1;

    IF OBJECT_ID(N'dbo.ITRequestMentions', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ITRequestMentions
        (
            NotificationID int IDENTITY(1,1) NOT NULL
                CONSTRAINT PK_ITRequestMentions PRIMARY KEY,
            CommentID int NOT NULL,
            RequestID int NOT NULL,
            RecipientUserID int NOT NULL,
            AuthorUserID int NOT NULL,
            CreatedAt datetime2(3) NOT NULL
                CONSTRAINT DF_ITRequestMentions_CreatedAt DEFAULT SYSUTCDATETIME(),
            ReadAt datetime2(3) NULL,

            CONSTRAINT FK_ITRequestMentions_Comment FOREIGN KEY (CommentID)
                REFERENCES dbo.RequestComments(CommentID) ON DELETE CASCADE,
            CONSTRAINT FK_ITRequestMentions_Recipient FOREIGN KEY (RecipientUserID)
                REFERENCES dbo.Users(UserID),
            CONSTRAINT FK_ITRequestMentions_Author FOREIGN KEY (AuthorUserID)
                REFERENCES dbo.Users(UserID),
            CONSTRAINT UQ_ITRequestMentions_Comment_Recipient
                UNIQUE (CommentID, RecipientUserID)
        );

        CREATE INDEX IX_ITRequestMentions_Recipient_Unread
            ON dbo.ITRequestMentions(RecipientUserID, ReadAt, CreatedAt DESC)
            INCLUDE (RequestID, CommentID, AuthorUserID);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
