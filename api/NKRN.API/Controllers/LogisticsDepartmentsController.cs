using System.Security.Claims;
using NKRN.API.Data;
using NKRN.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace NKRN.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LogisticsDepartmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LogisticsDepartmentsController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================================
        // GET ALL ACTIVE LOGISTICS DEPARTMENTS
        // ============================================================

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LogisticsDepartment>>>
            GetDepartments()
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var departments = await _context.LogisticsDepartments
                .Where(d => d.IsActive)
                .OrderBy(d => d.SortOrder)
                .ThenBy(d => d.DepartmentName)
                .ToListAsync();

            return Ok(departments);
        }

        // ============================================================
        // GET ONE LOGISTICS DEPARTMENT
        // ============================================================

        [HttpGet("{id}")]
        public async Task<ActionResult<LogisticsDepartment>>
            GetDepartment(int id)
        {
            if (!await CanViewLogistics())
            {
                return Forbid();
            }

            var department =
                await _context.LogisticsDepartments
                    .FirstOrDefaultAsync(
                        d => d.DepartmentID == id
                    );

            if (department == null)
            {
                return NotFound(new
                {
                    message = "Logistics department not found."
                });
            }

            return Ok(department);
        }

        // ============================================================
        // CREATE DEPARTMENT
        // LOGISTICS ADMIN / PLATFORM ADMIN
        // ============================================================

        [HttpPost]
        public async Task<ActionResult<LogisticsDepartment>>
            CreateDepartment(
                [FromBody] LogisticsDepartment department)
        {
            if (!await CanAdminLogistics())
            {
                return Forbid();
            }

            if (department == null ||
                string.IsNullOrWhiteSpace(
                    department.DepartmentName))
            {
                return BadRequest(new
                {
                    message = "Department name is required."
                });
            }

            string departmentName =
                department.DepartmentName.Trim();

            bool alreadyExists =
                await _context.LogisticsDepartments
                    .AnyAsync(d =>
                        d.DepartmentName == departmentName);

            if (alreadyExists)
            {
                return Conflict(new
                {
                    message =
                        "A logistics department with this name already exists."
                });
            }

            var newDepartment =
                new LogisticsDepartment
                {
                    DepartmentName = departmentName,
                    IsActive = true,
                    SortOrder = department.SortOrder,
                    CreatedDate = DateTime.Now
                };

            _context.LogisticsDepartments.Add(
                newDepartment
            );

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetDepartment),
                new
                {
                    id = newDepartment.DepartmentID
                },
                newDepartment
            );
        }

        // ============================================================
        // UPDATE DEPARTMENT
        // ============================================================

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDepartment(
            int id,
            [FromBody] LogisticsDepartment update)
        {
            if (!await CanAdminLogistics())
            {
                return Forbid();
            }

            var department =
                await _context.LogisticsDepartments
                    .FirstOrDefaultAsync(
                        d => d.DepartmentID == id
                    );

            if (department == null)
            {
                return NotFound(new
                {
                    message = "Logistics department not found."
                });
            }

            if (string.IsNullOrWhiteSpace(
                    update.DepartmentName))
            {
                return BadRequest(new
                {
                    message = "Department name is required."
                });
            }

            string departmentName =
                update.DepartmentName.Trim();

            bool duplicate =
                await _context.LogisticsDepartments
                    .AnyAsync(d =>
                        d.DepartmentID != id &&
                        d.DepartmentName ==
                            departmentName);

            if (duplicate)
            {
                return Conflict(new
                {
                    message =
                        "A logistics department with this name already exists."
                });
            }

            department.DepartmentName =
                departmentName;

            department.SortOrder =
                update.SortOrder;

            department.IsActive =
                update.IsActive;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ============================================================
        // DEACTIVATE DEPARTMENT
        //
        // We deliberately do not physically delete departments,
        // because historical Logistics tasks may reference them.
        // ============================================================

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeactivateDepartment(
            int id)
        {
            if (!await CanAdminLogistics())
            {
                return Forbid();
            }

            var department =
                await _context.LogisticsDepartments
                    .FirstOrDefaultAsync(
                        d => d.DepartmentID == id
                    );

            if (department == null)
            {
                return NotFound(new
                {
                    message = "Logistics department not found."
                });
            }

            department.IsActive = false;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ============================================================
        // PERMISSION HELPERS
        //
        // Existing platform administrators automatically receive
        // Logistics access.
        //
        // Other users require a ModulePermissions record with:
        //
        // ModuleKey = "logistics"
        // ============================================================

        private async Task<bool> CanViewLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID = GetLoggedInUserID();

            if (userID == null)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(p =>
                    p.UserID == userID.Value &&
                    p.ModuleKey == "logistics" &&
                    (
                        p.CanView ||
                        p.CanManage ||
                        p.CanAdmin
                    )
                );
        }

        private async Task<bool> CanAdminLogistics()
        {
            if (User.IsInRole("3"))
            {
                return true;
            }

            int? userID = GetLoggedInUserID();

            if (userID == null)
            {
                return false;
            }

            return await _context.ModulePermissions
                .AnyAsync(p =>
                    p.UserID == userID.Value &&
                    p.ModuleKey == "logistics" &&
                    p.CanAdmin
                );
        }

        private int? GetLoggedInUserID()
        {
            string? userIDValue =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    userIDValue,
                    out int userID))
            {
                return null;
            }

            return userID;
        }
    }
}