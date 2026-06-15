namespace FleetSyncCollector.Models
{
    public class HeartbeatRequest
    {
        public string CustomerId { get; set; }
        public string CollectorId { get; set; }
        public string MachineName { get; set; }
        public DateTime Timestamp { get; set; }
    }
}