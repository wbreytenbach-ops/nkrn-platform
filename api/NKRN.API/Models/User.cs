using System.ComponentModel.DataAnnotations;

namespace NKRN.API.Models
{
    public class User
    {
        [Key]
        public int UserID { get; set; }

        [Required]
        [MaxLength(50)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        public DateTime? CreatedDate { get; set; }

        public int? RoleID { get; set; }

        // Users are deactivated instead of deleted so their request history
        // remains linked to the original account.
        public bool IsActive { get; set; } = true;
    }
}
