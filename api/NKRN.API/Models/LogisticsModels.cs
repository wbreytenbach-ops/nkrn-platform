using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NKRN.API.Models
{
    [Table("ModulePermissions")]
    public class ModulePermission
    {
        [Key]
        public int PermissionID { get; set; }

        public int UserID { get; set; }

        [Required]
        [MaxLength(50)]
        public string ModuleKey { get; set; } = string.Empty;

        public bool CanView { get; set; }

        public bool CanManage { get; set; }

        public bool CanAdmin { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }


    [Table("LogisticsDepartments")]
    public class LogisticsDepartment
    {
        [Key]
        public int DepartmentID { get; set; }

        [Required]
        [MaxLength(150)]
        public string DepartmentName { get; set; } = string.Empty;

        public bool IsActive { get; set; }

        public int SortOrder { get; set; }

        public DateTime CreatedDate { get; set; }
    }


    [Table("LogisticsWorkers")]
    public class LogisticsWorker
    {
        [Key]
        public int WorkerID { get; set; }

        public int? UserID { get; set; }

        [Required]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? LastName { get; set; }

        [MaxLength(50)]
        public string? WorkerType { get; set; }

        [MaxLength(255)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? MobileNumber { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }


    [Table("LogisticsTasks")]
    public class LogisticsTask
    {
        [Key]
        public int TaskID { get; set; }

        public int? DepartmentID { get; set; }

        [Required]
        [MaxLength(250)]
        public string Title { get; set; } = string.Empty;

        public string? Background { get; set; }

        [Column(TypeName = "date")]
        public DateTime? RequestedDate { get; set; }

        public int? RequestedByUserID { get; set; }

        [Required]
        [MaxLength(2)]
        public string Priority { get; set; } = "P3";

        public int? ResponsibleUserID { get; set; }

        public int? ResponsibleWorkerID { get; set; }

        [MaxLength(250)]
        public string? ResponsibleText { get; set; }

        public bool QuoteRequired { get; set; }

        public bool QuoteReceived { get; set; }

        [Column(TypeName = "date")]
        public DateTime? DueDate { get; set; }

        [MaxLength(150)]
        public string? DueDateNote { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Nog nie begin";

        public string? NextAction { get; set; }

        [MaxLength(200)]
        public string? ContractorName { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? BudgetAmount { get; set; }

        [MaxLength(100)]
        public string? ApprovalStatus { get; set; }

        [Column(TypeName = "date")]
        public DateTime? CompletedDate { get; set; }

        [Column(TypeName = "date")]
        public DateTime? LastFollowUp { get; set; }

        [Column(TypeName = "date")]
        public DateTime? NextFollowUp { get; set; }

        public string? Notes { get; set; }

        public bool IncludeOnJobCard { get; set; }

        public bool IsArchived { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }


    [Table("LogisticsWorkPlanItems")]
    public class LogisticsWorkPlanItem
    {
        [Key]
        public int WorkPlanItemID { get; set; }

        [Column(TypeName = "date")]
        public DateTime WorkDate { get; set; }

        public int? TaskID { get; set; }

        public int? WorkerID { get; set; }

        [MaxLength(200)]
        public string? Area { get; set; }

        [Required]
        [MaxLength(500)]
        public string TaskDescription { get; set; } = string.Empty;

        [Required]
        [MaxLength(2)]
        public string Priority { get; set; } = "P3";

        [Column(TypeName = "time")]
        public TimeSpan? PlannedStart { get; set; }

        [Column(TypeName = "time")]
        public TimeSpan? PlannedEnd { get; set; }

        public string? MaterialsRequired { get; set; }

        public string? ManagerNote { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Beplan";

        public DateTime? WorkerSignedOffAt { get; set; }

        public DateTime? ManagerSignedOffAt { get; set; }

        public int? CreatedByUserID { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }


    [Table("LogisticsJobCards")]
    public class LogisticsJobCard
    {
        [Key]
        public int JobCardID { get; set; }

        [Required]
        [MaxLength(50)]
        public string JobCardNumber { get; set; } = string.Empty;

        [Column(TypeName = "date")]
        public DateTime JobCardDate { get; set; }

        public int? RecipientUserID { get; set; }

        [MaxLength(255)]
        public string? RecipientEmail { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft";

        public DateTime GeneratedAt { get; set; }

        public DateTime? SentAt { get; set; }

        public int? GeneratedByUserID { get; set; }

        public string? Notes { get; set; }
    }


    [Table("LogisticsJobCardItems")]
    public class LogisticsJobCardItem
    {
        [Key]
        public int JobCardItemID { get; set; }

        public int JobCardID { get; set; }

        public int? WorkPlanItemID { get; set; }

        public int? TaskID { get; set; }

        public int? WorkerID { get; set; }

        [MaxLength(200)]
        public string? WorkerName { get; set; }

        [MaxLength(200)]
        public string? Area { get; set; }

        [Required]
        [MaxLength(500)]
        public string TaskDescription { get; set; } = string.Empty;

        [Required]
        [MaxLength(2)]
        public string Priority { get; set; } = "P3";

        public string? MaterialsRequired { get; set; }

        public string? ManagerNote { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Beplan";

        public int SortOrder { get; set; }

        public DateTime? CompletedAt { get; set; }

        public string? Notes { get; set; }
    }


    [Table("LogisticsSettings")]
    public class LogisticsSettings
    {
        [Key]
        public int SettingsID { get; set; }

        public int? ManagerUserID { get; set; }

        public bool DailyJobCardEnabled { get; set; }

        [Column(TypeName = "time")]
        public TimeSpan DailyJobCardTime { get; set; }

        public bool WeekdaysOnly { get; set; }

        public bool CarryOverIncompleteWork { get; set; }

        public bool IncludeOverdueTasks { get; set; }

        [MaxLength(255)]
        public string? EmailOverride { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime? UpdatedDate { get; set; }
    }
}