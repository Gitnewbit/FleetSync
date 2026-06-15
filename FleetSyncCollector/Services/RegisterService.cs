using System.Text;
using Newtonsoft.Json;

namespace FleetSyncCollector.Services
{
    public class RegisterService
    {
        private readonly HttpClient _client =
            new HttpClient();

        public async Task RegisterDevice(
            string apiUrl,
            string customerId,
            string collectorId,
            string hostname,
            string ipAddress)
        {
            var payload = new
            {
                customerId,
                collectorId,
                hostname,
                ipAddress
            };

            var json =
                JsonConvert.SerializeObject(payload);

            var content =
                new StringContent(
                    json,
                    Encoding.UTF8,
                    "application/json");

            await _client.PostAsync(
                $"{apiUrl}/devices/register",
                content);
        }
    }
}