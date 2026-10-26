using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NKRN.API.Models;

/// <summary>Per-recipient in-portal mention notification for an IT comment.</summary>
[Table("ITRequestMentions")]
public sealed class ITRequestMention
{
    [Key]
    public int NotificationID { get; set; }
    public int CommentID { get; set; }
    public int RequestID { get; set; }
    public int RecipientUserID { get; set; }
    public int AuthorUserID { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}
