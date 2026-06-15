using FleetSyncCollector.Services;
using Microsoft.Extensions.Configuration;
using FleetSyncCollector.Models;

var config =
    new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile(
        "appsettings.json",
        optional: false,
        reloadOnChange: true)
    .Build();

string apiUrl =
    config["ApiUrl"]!;

string customerId =
    config["CustomerId"]!;

string collectorId =
    config["CollectorId"]!;

int interval =
    int.Parse(
        config["HeartbeatIntervalSeconds"]!);

Console.WriteLine("=================================");
Console.WriteLine(" FleetSync Collector v1");
Console.WriteLine("=================================");

var discovery =
    new DiscoveryService();

var devices =
    await discovery.ScanSubnet(
        "192.168.50");

var registerService =
    new RegisterService();

foreach (var device in devices)
{
    await registerService.RegisterDevice(
        apiUrl,
        customerId,
        collectorId,
        device.Hostname,
        device.IpAddress);

    Console.WriteLine(
        $"Registered: {device.Hostname} ({device.IpAddress})");
}

Console.WriteLine(
    $"Devices Found: {devices.Count}");


var api =
    new ApiService();

while (true)
{
    try
    {
        var heartbeat =
            new HeartbeatRequest
            {
                CustomerId = customerId,
                CollectorId = collectorId,
                MachineName =
                    Environment.MachineName,
                Timestamp =
                    DateTime.UtcNow
            };

        await api.SendHeartbeat(
            apiUrl,
            heartbeat);

        Console.WriteLine(
            $"Heartbeat Sent {DateTime.Now}");
    }
    catch (Exception ex)
    {
        Console.WriteLine(
            $"Error: {ex.Message}");
    }

    await Task.Delay(
        TimeSpan.FromSeconds(interval));
}