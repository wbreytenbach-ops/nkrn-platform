/*
   Soft-delete support for NKRN IT Desk users.
   Existing users are marked active, and future user removals keep their
   associated request history intact.
*/

IF COL_LENGTH('dbo.Users', 'IsActive') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD IsActive bit NOT NULL
        CONSTRAINT DF_Users_IsActive DEFAULT (1);
END;
