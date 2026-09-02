using System.ComponentModel.DataAnnotations;

namespace NKRN.API.Models
{
    public class Request
    {
        [Key]
        public int RequestID { get; set; }

        public int UserID { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Priority { get; set; } = "Medium";

        public int? AssignedTo { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? CompletedDate { get; set; }

        public int? CategoryID { get; set; }

        public int? StatusID { get; set; }

        // Google Calendar scheduling

        public DateTime? ScheduledStart { get; set; }

        public DateTime? ScheduledEnd { get; set; }

        [MaxLength(200)]
        public string? GoogleCalendarEventID { get; set; }
    }
}