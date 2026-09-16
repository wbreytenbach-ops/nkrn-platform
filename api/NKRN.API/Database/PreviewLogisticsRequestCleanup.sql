-- Read-only preview. No requests are deleted by this query.
SELECT RequestID, Title, RequestedByUserID, Status, CreatedDate, ConvertedTaskID
FROM dbo.LogisticsRequests
WHERE Status = 'New'
ORDER BY CreatedDate DESC, RequestID DESC;
-- Confirm whether "new" means this status, specific test IDs, or a creation-date cutoff
-- before preparing a bulk deletion. IT and Funksieversorging are separate tables.
