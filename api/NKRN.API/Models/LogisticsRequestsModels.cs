using System.ComponentModel.DataAnnotations;

namespace NKRN.API.Models
{
    // ============================================================
    // LOGISTICS REQUEST INPUT MODELS
    // ============================================================

    public class CreateLogisticsRequestRequest
    {
        [Required]
        public string RequestType { get; set; } = string.Empty;

        public string? ActivityCategory { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public DateTime? ActivityDate { get; set; }

        public TimeSpan? StartTime { get; set; }

        public TimeSpan? EndTime { get; set; }

        public bool? CleanupNextDay { get; set; }

        public List<CreateLogisticsRequestLocationRequest> Locations { get; set; } = new();

        public List<CreateLogisticsRequestEquipmentRequest> Equipment { get; set; } = new();

        public List<CreateLogisticsRequestMaintenanceItemRequest> MaintenanceItems { get; set; } = new();
    }

    public class CreateLogisticsRequestLocationRequest
    {
        public int? LocationID { get; set; }

        [MaxLength(150)]
        public string? LocationText { get; set; }

        public bool IsPrimary { get; set; }
    }

    public class CreateLogisticsRequestEquipmentRequest
    {
        public int EquipmentTypeID { get; set; }

        public int? Quantity { get; set; }

        [MaxLength(250)]
        public string? Notes { get; set; }
    }

    public class CreateLogisticsRequestMaintenanceItemRequest
    {
        public int MaintenanceTypeID { get; set; }

        [Required]
        public string ActionType { get; set; } = string.Empty;

        [MaxLength(250)]
        public string? Notes { get; set; }
    }

    public class UpdateLogisticsRequestStatusRequest
    {
        [Required]
        public string Status { get; set; } = string.Empty;

        public string? ManagerNotes { get; set; }
    }

    // ============================================================
    // OUTPUT MODELS
    // ============================================================

    public class LogisticsRequestResponse
    {
        public int RequestID { get; set; }
        public int RequestedByUserID { get; set; }

        public string RequestedByName { get; set; } = string.Empty;
        public string RequestedByEmail { get; set; } = string.Empty;

        public string RequestType { get; set; } = string.Empty;
        public string? ActivityCategory { get; set; }

        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public DateTime? ActivityDate { get; set; }
        public TimeSpan? StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }

        public bool? CleanupNextDay { get; set; }

        public string Priority { get; set; } = "P3";
        public string Status { get; set; } = "New";

        public string? ManagerNotes { get; set; }

        public int? ReviewedByUserID { get; set; }
        public DateTime? ReviewedDate { get; set; }

        public int? ConvertedTaskID { get; set; }

        public DateTime CreatedDate { get; set; }
        public DateTime UpdatedDate { get; set; }

        public List<LogisticsRequestLocationResponse> Locations { get; set; } = new();
        public List<LogisticsRequestEquipmentResponse> Equipment { get; set; } = new();
        public List<LogisticsRequestMaintenanceItemResponse> MaintenanceItems { get; set; } = new();
    }

    public class LogisticsRequestLocationResponse
    {
        public int RequestLocationID { get; set; }
        public int RequestID { get; set; }
        public int? LocationID { get; set; }

        public string? LocationName { get; set; }
        public string? LocationCode { get; set; }
        public string? LocationType { get; set; }

        public string? LocationText { get; set; }

        public bool IsPrimary { get; set; }
    }

    public class LogisticsRequestEquipmentResponse
    {
        public int RequestEquipmentID { get; set; }
        public int RequestID { get; set; }
        public int EquipmentTypeID { get; set; }

        public string EquipmentName { get; set; } = string.Empty;

        public int? Quantity { get; set; }
        public string? Notes { get; set; }
    }

    public class LogisticsRequestMaintenanceItemResponse
    {
        public int RequestMaintenanceItemID { get; set; }
        public int RequestID { get; set; }
        public int MaintenanceTypeID { get; set; }

        public string MaintenanceName { get; set; } = string.Empty;

        public string ActionType { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }

    // ============================================================
    // LOCATION / VENUE MODELS
    // ============================================================

    public class LocationResponse
    {
        public int LocationID { get; set; }
        public string LocationName { get; set; } = string.Empty;
        public string? LocationCode { get; set; }
        public string LocationType { get; set; } = string.Empty;
        public string? Building { get; set; }
        public string? FloorName { get; set; }
        public string? MapShapeKey { get; set; }
        public bool CanBeBooked { get; set; }
        public bool IsActive { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class EquipmentTypeResponse
    {
        public int EquipmentTypeID { get; set; }
        public string EquipmentName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class MaintenanceTypeResponse
    {
        public int MaintenanceTypeID { get; set; }
        public string MaintenanceName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public int DisplayOrder { get; set; }
    }

    // ============================================================
    // VENUE BOOKING MODELS
    // ============================================================

    public class VenueBookingResponse
    {
        public int BookingID { get; set; }
        public int LocationID { get; set; }
        public string LocationName { get; set; } = string.Empty;

        public int? LogisticsRequestID { get; set; }

        public int BookedByUserID { get; set; }
        public string BookedByName { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public DateTime BookingDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }

        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }

        public DateTime CreatedDate { get; set; }
        public DateTime UpdatedDate { get; set; }
    }

    public class CreateVenueBookingRequest
    {
        public int LocationID { get; set; }

        public int? LogisticsRequestID { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        public DateTime BookingDate { get; set; }

        public TimeSpan StartTime { get; set; }

        public TimeSpan EndTime { get; set; }

        public string? Notes { get; set; }
    }
}
