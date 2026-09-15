/*
   Run against the NKRN database before deploying the updated API.
   Existing UserID values retain ownership; no historical requester is changed.
   Before this feature, creation always set UserID to the authenticated submitter,
   so that recorded identity can also initialise the audit column.
   Uses the project's existing manual SQL update approach; safe to rerun.
*/
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.Requests', N'U') IS NULL
        THROW 50001, 'The Requests table was not found. Select the NKRN database.', 1;

    IF COL_LENGTH('dbo.Requests', 'CreatedByUserID') IS NULL
        ALTER TABLE dbo.Requests ADD CreatedByUserID int NULL;

    -- Dynamic SQL also works when the column is added in this same batch.
    EXEC sys.sp_executesql N'
        UPDATE dbo.Requests
        SET CreatedByUserID = UserID
        WHERE CreatedByUserID IS NULL;';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
