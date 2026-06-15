using System.Text;
using Newtonsoft.Json;
using FleetSyncCollector.Models;

namespace FleetSyncCollector.Services
{
    public class ApiService
    {
        private readonly HttpClient _httpClient;

        public ApiService()
        {
            _httpClient = new HttpClient();
        }

        public async Task SendHeartbeat(
            string apiUrl,
            HeartbeatRequest request)
        {
            var json =
                JsonConvert.SerializeObject(request);

            var content =
                new StringContent(
                    json,
                    Encoding.UTF8,
                    "application/json");

            var response =
                await _httpClient.PostAsync(
                    $"{apiUrl}/collector/heartbeat",
                    content);

            Console.WriteLine(
                $"Heartbeat => {response.StatusCode}");
        }
    }
}