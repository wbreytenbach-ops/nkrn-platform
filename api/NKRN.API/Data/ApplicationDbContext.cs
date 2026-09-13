using Microsoft.EntityFrameworkCore;
using NKRN.API.Models;

namespace NKRN.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions options)
            : base(options)
        {
        }

        // ============================================================
        // EXISTING IT DESK TABLES
        // ============================================================

        public DbSet<User> Users { get; set; }

        public DbSet<Request> Requests { get; set; }

        public DbSet<Category> Categories { get; set; }

        public DbSet<Status> Statuses { get; set; }

        public DbSet<RequestComment> RequestComments { get; set; }


        // ============================================================
        // MODULE PERMISSIONS
        // ============================================================

        public DbSet<ModulePermission> ModulePermissions { get; set; }


        // ============================================================
        // LOGISTICS
        // ============================================================

        public DbSet<LogisticsDepartment> LogisticsDepartments { get; set; }

        public DbSet<LogisticsWorker> LogisticsWorkers { get; set; }

        public DbSet<LogisticsTask> LogisticsTasks { get; set; }

        public DbSet<LogisticsWorkPlanItem> LogisticsWorkPlanItems { get; set; }

        public DbSet<LogisticsJobCard> LogisticsJobCards { get; set; }

        public DbSet<LogisticsJobCardItem> LogisticsJobCardItems { get; set; }

        public DbSet<LogisticsSettings> LogisticsSettings { get; set; }
    }
}