using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NKRN.API.Models
{
    public class RequestComment
    {
        [Key]
        public int CommentID { get; set; }

        [Required]
        public int RequestID { get; set; }

        [Required]
        public int UserID { get; set; }

        [Required]
        public string CommentText { get; set; } = string.Empty;

        public DateTime? CreatedDate { get; set; }


        // ========================================
        // OPTIONAL NAVIGATION PROPERTIES
        // ========================================

        [ForeignKey(nameof(RequestID))]
        public Request? Request { get; set; }

        [ForeignKey(nameof(UserID))]
        public User? User { get; set; }
    }
}