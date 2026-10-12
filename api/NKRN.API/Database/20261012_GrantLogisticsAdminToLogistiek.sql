SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @UserID int;

SELECT @UserID = UserID
FROM dbo.Users
WHERE LOWER(LTRIM(RTRIM(Email))) = 'logistiek@tygies.co.za'
  AND IsActive = 1;

IF @UserID IS NULL
BEGIN
    THROW 51000, 'Active user logistiek@tygies.co.za was not found. No permission was changed.', 1;
END;

IF EXISTS (
    SELECT 1
    FROM dbo.ModulePermissions
    WHERE UserID = @UserID
      AND LOWER(LTRIM(RTRIM(ModuleKey))) = 'logistics'
)
BEGIN
    UPDATE dbo.ModulePermissions
    SET CanView = 1,
        CanManage = 1,
        CanAdmin = 1,
        UpdatedDate = SYSUTCDATETIME()
    WHERE UserID = @UserID
      AND LOWER(LTRIM(RTRIM(ModuleKey))) = 'logistics';
END
ELSE
BEGIN
    INSERT INTO dbo.ModulePermissions
        (UserID, ModuleKey, CanView, CanManage, CanAdmin, CreatedDate, UpdatedDate)
    VALUES
        (@UserID, 'Logistics', 1, 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;

COMMIT TRANSACTION;

SELECT
    u.Email,
    p.ModuleKey,
    p.CanView,
    p.CanManage,
    p.CanAdmin
FROM dbo.Users AS u
INNER JOIN dbo.ModulePermissions AS p ON p.UserID = u.UserID
WHERE u.UserID = @UserID
  AND LOWER(LTRIM(RTRIM(p.ModuleKey))) = 'logistics';
