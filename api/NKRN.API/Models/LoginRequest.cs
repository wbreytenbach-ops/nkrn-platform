using System.ComponentModel.DataAnnotations;

namespace NKRN.API.Models
{
    public class LoginRequest
    {
        [Required]
        public string Email { get; set; } = string.Empty;
    }
}