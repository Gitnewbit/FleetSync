using System.Net;
using System.Net.NetworkInformation;
using FleetSyncCollector.Models;

namespace FleetSyncCollector.Services
{
    public class DiscoveryService
    {
        public async Task<List<DeviceInfo>> ScanSubnet(string subnet)
        {
            var devices = new List<DeviceInfo>();

            var tasks = new List<Task>();

            for (int i = 1; i <= 254; i++)
            {
                string ip = $"{subnet}.{i}";

                tasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        using var ping = new Ping();

                        var reply =
                            await ping.SendPingAsync(
                                ip,
                                500);

                        if (reply.Status ==
                            IPStatus.Success)
                        {
                            string hostname = "Unknown";

                            try
                            {
                                hostname =
                                    Dns.GetHostEntry(ip)
                                       .HostName;
                            }
                            catch
                            {
                            }

                            lock (devices)
                            {
                                devices.Add(
                                    new DeviceInfo
                                {
                                    IpAddress = ip,
                                    Hostname = hostname
                                });
                            }

                            Console.WriteLine(
                                $"Found: {ip} ({hostname})");
                        }
                    }
                    catch
                    {
                    }
                }));
            }

            await Task.WhenAll(tasks);

            return devices;
        }
    }
}