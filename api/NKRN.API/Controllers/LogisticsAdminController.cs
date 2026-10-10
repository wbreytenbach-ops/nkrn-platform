using System.Data;
using System.Data.Common;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NKRN.API.Data;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public sealed class LogisticsAdminController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LogisticsAdminController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost("bulk-hard-delete")]
        public async Task<IActionResult> BulkHardDelete(
            [FromBody] LogisticsBulkHardDeleteRequest request,
            CancellationToken cancellationToken)
        {
            var userIDValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIDValue, out var userID))
                return Unauthorized();

            if (!await _context.Users.AnyAsync(
                    user => user.UserID == userID &&
                            user.IsActive &&
                            user.RoleID == 3,
                    cancellationToken))
            {
                return Forbid();
            }

            var requestIDs = (request.RequestIDs ?? [])
                .Where(id => id > 0).Distinct().ToArray();
            var taskIDs = (request.TaskIDs ?? [])
                .Where(id => id > 0).Distinct().ToArray();

            if (requestIDs.Length + taskIDs.Length == 0)
                return BadRequest(new { message = "Select at least one request or task." });

            if (requestIDs.Length + taskIDs.Length > 500)
                return BadRequest(new { message = "A maximum of 500 records can be deleted in one operation." });

            if (requestIDs.Length != (request.RequestIDs ?? []).Distinct().Count() ||
                taskIDs.Length != (request.TaskIDs ?? []).Distinct().Count())
            {
                return BadRequest(new { message = "All selected IDs must be positive integers." });
            }

            var connection = _context.Database.GetDbConnection();
            var shouldClose = connection.State != ConnectionState.Open;

            if (shouldClose)
                await connection.OpenAsync(cancellationToken);

            await using var transaction = await _context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            var dbTransaction = transaction.GetDbTransaction();

            try
            {
                if (requestIDs.Length > 0)
                {
                    var (requestClause, requestParameters) = BuildInClause(requestIDs, "@request");
                    var existingRequests = await ExecuteScalarIntAsync(
                        connection, dbTransaction,
                        $"SELECT COUNT(*) FROM dbo.LogisticsRequests WHERE IsDeleted = 0 AND RequestID IN ({requestClause});",
                        requestParameters, cancellationToken);

                    if (existingRequests != requestIDs.Length)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return Conflict(new
                        {
                            message = "One or more selected requests no longer exist or are not available in the request inbox. Refresh the list and try again."
                        });
                    }

                    var linkedBookings = await ReadIntListAsync(
                        connection, dbTransaction,
                        $"SELECT DISTINCT LogisticsRequestID FROM dbo.VenueBookings WHERE LogisticsRequestID IN ({requestClause});",
                        requestParameters, cancellationToken);

                    if (linkedBookings.Count > 0)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return Conflict(new
                        {
                            message = "These requests cannot be permanently deleted because venue bookings still reference them: " +
                                      string.Join(", ", linkedBookings.Select(id => "#" + id)) +
                                      ". Resolve the linked bookings first."
                        });
                    }
                }

                if (taskIDs.Length > 0)
                {
                    var (taskClause, taskParameters) = BuildInClause(taskIDs, "@task");
                    var existingTasks = await ExecuteScalarIntAsync(
                        connection, dbTransaction,
                        $"SELECT COUNT(*) FROM dbo.LogisticsTasks WHERE TaskID IN ({taskClause});",
                        taskParameters, cancellationToken);

                    if (existingTasks != taskIDs.Length)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return Conflict(new
                        {
                            message = "One or more selected tasks no longer exist. Refresh the list and try again."
                        });
                    }
                }

                // Comments have NO_ACTION foreign keys. Remove only comments
                // belonging to requests explicitly selected for permanent deletion.
                if (requestIDs.Length > 0)
                {
                    var (requestClause, requestParameters) = BuildInClause(requestIDs, "@request");
                    await ExecuteNonQueryAsync(
                        connection, dbTransaction,
                        $"DELETE FROM dbo.LogisticsRequestComments WHERE RequestID IN ({requestClause});",
                        requestParameters, cancellationToken);

                    // Attachments, equipment, locations and maintenance items
                    // have verified ON DELETE CASCADE foreign keys.
                    await ExecuteNonQueryAsync(
                        connection, dbTransaction,
                        $"DELETE FROM dbo.LogisticsRequests WHERE RequestID IN ({requestClause}) AND IsDeleted = 0;",
                        requestParameters, cancellationToken);
                }

                if (taskIDs.Length > 0)
                {
                    var (taskClause, taskParameters) = BuildInClause(taskIDs, "@task");

                    // Keep request history but remove the FK to a task that is
                    // being permanently deleted.
                    await ExecuteNonQueryAsync(
                        connection, dbTransaction,
                        $"UPDATE dbo.LogisticsRequests SET ConvertedTaskID = NULL WHERE ConvertedTaskID IN ({taskClause});",
                        taskParameters, cancellationToken);

                    // Preserve work-plan entries, calendar-sync fields, job cards
                    // and issued job-card snapshots. Only clear the task FK.
                    await ExecuteNonQueryAsync(
                        connection, dbTransaction,
                        $"UPDATE dbo.LogisticsWorkPlanItems SET TaskID = NULL WHERE TaskID IN ({taskClause});",
                        taskParameters, cancellationToken);

                    var preservedJobCardReferences = await ExecuteNonQueryAsync(
                        connection, dbTransaction,
                        $"UPDATE dbo.LogisticsJobCardItems SET TaskID = NULL WHERE TaskID IN ({taskClause});",
                        taskParameters, cancellationToken);

                    var deletedTasks = await ExecuteNonQueryAsync(
                        connection, dbTransaction,
                        $"DELETE FROM dbo.LogisticsTasks WHERE TaskID IN ({taskClause});",
                        taskParameters, cancellationToken);

                    await transaction.CommitAsync(cancellationToken);

                    return Ok(new
                    {
                        message = "Selected records were permanently deleted. Related work-plan and job-card history was preserved.",
                        deletedRequests = requestIDs.Length,
                        deletedTasks,
                        preservedJobCardReferences
                    });
                }

                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    message = "Selected requests were permanently deleted.",
                    deletedRequests = requestIDs.Length,
                    deletedTasks = 0,
                    preservedJobCardReferences = 0
                });
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
            finally
            {
                if (shouldClose && connection.State == ConnectionState.Open)
                    await connection.CloseAsync();
            }
        }

        private static (string Clause, SqlParameter[] Parameters) BuildInClause(
            IReadOnlyList<int> ids,
            string prefix)
        {
            var names = new string[ids.Count];
            var parameters = new SqlParameter[ids.Count];

            for (var index = 0; index < ids.Count; index++)
            {
                var name = prefix + index;
                names[index] = name;
                parameters[index] = new SqlParameter(name, SqlDbType.Int)
                {
                    Value = ids[index]
                };
            }

            return (string.Join(", ", names), parameters);
        }

        private static async Task<int> ExecuteScalarIntAsync(
            DbConnection connection,
            DbTransaction transaction,
            string sql,
            SqlParameter[] parameters,
            CancellationToken cancellationToken)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            foreach (var parameter in parameters)
                command.Parameters.Add(CloneParameter(parameter));

            var result = await command.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(result);
        }

        private static async Task<List<int>> ReadIntListAsync(
            DbConnection connection,
            DbTransaction transaction,
            string sql,
            SqlParameter[] parameters,
            CancellationToken cancellationToken)
        {
            var output = new List<int>();
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            foreach (var parameter in parameters)
                command.Parameters.Add(CloneParameter(parameter));

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                output.Add(reader.GetInt32(0));

            return output;
        }

        private static async Task<int> ExecuteNonQueryAsync(
            DbConnection connection,
            DbTransaction transaction,
            string sql,
            SqlParameter[] parameters,
            CancellationToken cancellationToken)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            foreach (var parameter in parameters)
                command.Parameters.Add(CloneParameter(parameter));

            return await command.ExecuteNonQueryAsync(cancellationToken);
        }

        private static SqlParameter CloneParameter(SqlParameter source) =>
            new(source.ParameterName, source.SqlDbType) { Value = source.Value };
    }

    public sealed class LogisticsBulkHardDeleteRequest
    {
        public List<int> RequestIDs { get; set; } = [];
        public List<int> TaskIDs { get; set; } = [];
    }
}
