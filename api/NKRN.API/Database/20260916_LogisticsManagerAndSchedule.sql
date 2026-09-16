-- Run with the daily scheduler paused, before enabling the updated API.
-- Email addresses are exact identities supplied by the school.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @ManagerID int;
IF (SELECT COUNT(*) FROM dbo.Users WHERE LOWER(LTRIM(RTRIM(Email))) = 'mcarnie@tygies.co.za' AND IsActive=1) <> 1
    THROW 51001, 'Exactly one active mcarnie@tygies.co.za account is required. Create or correct the portal account first.', 1;
SELECT @ManagerID=UserID FROM dbo.Users WHERE LOWER(LTRIM(RTRIM(Email)))='mcarnie@tygies.co.za' AND IsActive=1;
UPDATE dbo.ModulePermissions SET CanView=1, CanManage=1, UpdatedDate=SYSDATETIME()
WHERE UserID=@ManagerID AND LOWER(ModuleKey)='logistics';
IF @@ROWCOUNT=0
    INSERT dbo.ModulePermissions(UserID,ModuleKey,CanView,CanManage,CanAdmin,CreatedDate)
    VALUES(@ManagerID,'Logistics',1,1,0,SYSDATETIME());
-- Preserve existing managers. Grant the shared account access only if it exists.
UPDATE P SET CanView=1, CanManage=1, UpdatedDate=SYSDATETIME()
FROM dbo.ModulePermissions P JOIN dbo.Users U ON U.UserID=P.UserID
WHERE LOWER(LTRIM(RTRIM(U.Email)))='terreinbestuur@tygies.co.za' AND U.IsActive=1 AND LOWER(P.ModuleKey)='logistics';
INSERT dbo.ModulePermissions(UserID,ModuleKey,CanView,CanManage,CanAdmin,CreatedDate)
SELECT U.UserID,'Logistics',1,1,0,SYSDATETIME() FROM dbo.Users U
WHERE LOWER(LTRIM(RTRIM(U.Email)))='terreinbestuur@tygies.co.za' AND U.IsActive=1
AND NOT EXISTS(SELECT 1 FROM dbo.ModulePermissions P WHERE P.UserID=U.UserID AND LOWER(P.ModuleKey)='logistics');
IF NOT EXISTS(SELECT 1 FROM dbo.LogisticsSettings WHERE SettingsID=1)
    THROW 51002, 'The existing Logistics settings row is missing.', 1;
UPDATE dbo.LogisticsSettings SET ManagerUserID=@ManagerID, DailyJobCardEnabled=1,
    WeekdaysOnly=0, UpdatedDate=SYSDATETIME() WHERE SettingsID=1;
COMMIT;
SELECT DailyJobCardEnabled, DailyJobCardTime, WeekdaysOnly, ManagerUserID FROM dbo.LogisticsSettings WHERE SettingsID=1;
