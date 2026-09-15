using System.ComponentModel.DataAnnotations;

namespace NKRN.API.Models
{
    // Only editable creation fields are accepted. Ownership, audit fields,
    // status and dates are set by the server, including for older clients.
    public class CreateRequestInput
    {
        [Required, MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Priority { get; set; } = "Medium";

        public int? CategoryID { get; set; }

        // Omit for the authenticated user's own request. Admins only.
        [Range(1, int.MaxValue)]
        public int? RequestedForUserID { get; set; }
    }
}
