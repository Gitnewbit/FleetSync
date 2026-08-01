#!/usr/bin/env python3
"""
FleetSync Pro — SNMP Collector v2.0
Polls MFP / copier SNMP data and sends it to your FleetSync dashboard.

Usage:
  python fleetsync_collector.py            # start (reads fleetsync_config.json)
  python fleetsync_collector.py --setup    # interactive setup wizard

Build silent Windows EXE (no console window):
  pip install pyinstaller
  pyinstaller --onefile --windowed --name FleetSync_Collector fleetsync_collector.py
"""

import json, os, sys, time, uuid, socket, logging, random
from datetime import datetime, timezone

# ── auto-install missing packages ───────────────────────────────────────────
def _pip(pkg, mod=None):
    import importlib, subprocess
    try:
        importlib.import_module(mod or pkg.replace('-', '_'))
    except ImportError:
        subprocess.call([sys.executable, '-m', 'pip', 'install', pkg, '--quiet'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

_pip('requests')
_pip('schedule')
import requests, schedule

try:
    from pysnmp.hlapi import (getCmd, SnmpEngine, CommunityData,
                              UdpTransportTarget, ContextData,
                              ObjectType, ObjectIdentity)
    SNMP_OK = True
except ImportError:
    _pip('pysnmp')
    try:
        from pysnmp.hlapi import (getCmd, SnmpEngine, CommunityData,
                                  UdpTransportTarget, ContextData,
                                  ObjectType, ObjectIdentity)
        SNMP_OK = True
    except ImportError:
        SNMP_OK = False

# ── paths (works both as .py and as frozen .exe) ────────────────────────────
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_FILE = os.path.join(BASE_DIR, 'fleetsync_config.json')
LOG_FILE    = os.path.join(BASE_DIR, 'fleetsync_collector.log')

# ── Printer MIB v2 OIDs ─────────────────────────────────────────────────────
OIDS = {
    'pageCount':  '1.3.6.1.2.1.43.10.2.1.4.1.1',
    'tonerBkCur': '1.3.6.1.2.1.43.11.1.1.9.1.1',
    'tonerBkMax': '1.3.6.1.2.1.43.11.1.1.8.1.1',
    'tonerCyCur': '1.3.6.1.2.1.43.11.1.1.9.1.2',
    'tonerCyMax': '1.3.6.1.2.1.43.11.1.1.8.1.2',
    'tonerMaCur': '1.3.6.1.2.1.43.11.1.1.9.1.3',
    'tonerMaMax': '1.3.6.1.2.1.43.11.1.1.8.1.3',
    'tonerYeCur': '1.3.6.1.2.1.43.11.1.1.9.1.4',
    'tonerYeMax': '1.3.6.1.2.1.43.11.1.1.8.1.4',
    'drumBkCur':  '1.3.6.1.2.1.43.11.1.1.9.1.5',
    'drumBkMax':  '1.3.6.1.2.1.43.11.1.1.8.1.5',
}

def snmp_get(ip, community, oid, timeout=3, retries=1):
    if not SNMP_OK:
        return None
    try:
        ei, es, _, vbs = next(getCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=1),
            UdpTransportTarget((ip, 161), timeout=timeout, retries=retries),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        ))
        if ei or es:
            return None
        for vb in vbs:
            raw = vb[1].prettyPrint()
            if 'No Such' in raw or 'No more' in raw:
                return None
            try:
                return int(raw)
            except (ValueError, TypeError):
                return raw
    except Exception:
        return None

def pct(cur, mx):
    try:
        c, m = int(cur), int(mx)
        return max(0, min(100, round(c / m * 100))) if m > 0 else 0
    except (TypeError, ValueError):
        return 0

# ── collect one device ───────────────────────────────────────────────────────
def collect_device(device, config):
    ip        = device.get('ip') or device.get('ipAddress', '')
    community = device.get('community', 'public')
    now       = datetime.now(timezone.utc).isoformat()

    out = {
        'deviceId':          device.get('deviceId') or f"dev-{ip.replace('.', '-')}",
        'customerId':        config['customerId'],
        'name':              device.get('name', ip),
        'ipAddress':         ip,
        'model':             device.get('model', 'Unknown'),
        'location':          device.get('location', 'Unknown'),
        'serialNumber':      device.get('serialNumber', ''),
        'snmpCommunity':     community,
        'timestamp':         now,
        'isOnline':          False,
        'pageCount':         0,
        'tonerLevelBlack':   0,
        'tonerLevelCyan':    0,
        'tonerLevelMagenta': 0,
        'tonerLevelYellow':  0,
        'drumYieldBlack':    0,
        'fuserUnitYield':    0,
        'temperature':       0,
    }

    if not SNMP_OK:
        # Demo / simulation mode — values drift gradually
        out['isOnline']          = True
        out['pageCount']         = device.get('_p',  0) + random.randint(0, 8)
        out['tonerLevelBlack']   = max(0, device.get('_bk', random.randint(40, 95)) - random.randint(0, 1))
        out['tonerLevelCyan']    = max(0, device.get('_cy', random.randint(40, 95)) - random.randint(0, 1))
        out['tonerLevelMagenta'] = max(0, device.get('_ma', random.randint(40, 95)) - random.randint(0, 1))
        out['tonerLevelYellow']  = max(0, device.get('_ye', random.randint(40, 95)) - random.randint(0, 1))
        out['drumYieldBlack']    = max(0, device.get('_dr', random.randint(50, 90)) - random.randint(0, 1))
        out['fuserUnitYield']    = max(0, device.get('_fu', random.randint(50, 90)) - random.randint(0, 1))
        out['temperature']       = random.randint(44, 58)
        device.update({'_p': out['pageCount'], '_bk': out['tonerLevelBlack'],
                       '_cy': out['tonerLevelCyan'], '_ma': out['tonerLevelMagenta'],
                       '_ye': out['tonerLevelYellow'], '_dr': out['drumYieldBlack'],
                       '_fu': out['fuserUnitYield']})
        return out

    # Real SNMP
    pc = snmp_get(ip, community, OIDS['pageCount'])
    if pc is not None:
        out['isOnline']  = True
        out['pageCount'] = int(pc)
        out['tonerLevelBlack']   = pct(snmp_get(ip, community, OIDS['tonerBkCur']),
                                        snmp_get(ip, community, OIDS['tonerBkMax']))
        out['tonerLevelCyan']    = pct(snmp_get(ip, community, OIDS['tonerCyCur']),
                                        snmp_get(ip, community, OIDS['tonerCyMax']))
        out['tonerLevelMagenta'] = pct(snmp_get(ip, community, OIDS['tonerMaCur']),
                                        snmp_get(ip, community, OIDS['tonerMaMax']))
        out['tonerLevelYellow']  = pct(snmp_get(ip, community, OIDS['tonerYeCur']),
                                        snmp_get(ip, community, OIDS['tonerYeMax']))
        drum = pct(snmp_get(ip, community, OIDS['drumBkCur']),
                   snmp_get(ip, community, OIDS['drumBkMax']))
        out['drumYieldBlack'] = drum
        out['fuserUnitYield'] = drum
    return out

# ── send + heartbeat ────────────────────────────────────────────────────────
def send_data(results, config, log):
    url     = config['apiUrl'].rstrip('/') + '/api/snmp-data'
    headers = {'Content-Type': 'application/json', 'X-API-Key': config['apiKey']}
    payload = {
        'customerId':  config['customerId'],
        'apiKey':      config['apiKey'],
        'collectorId': config.get('collectorId', 'default'),
        'timestamp':   datetime.now(timezone.utc).isoformat(),
        'devices':     results,
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=20)
        if r.status_code == 200:
            d = r.json()
            log.info(f"  Sent {d.get('processed', len(results))}/{len(results)} device(s) — HTTP 200")
        else:
            log.warning(f"  API returned HTTP {r.status_code}: {r.text[:120]}")
    except requests.exceptions.ConnectionError:
        log.error(f"  Cannot reach {url}")
    except Exception as ex:
        log.error(f"  Send error: {ex}")

    try:
        requests.post(
            config['apiUrl'].rstrip('/') + '/api/collector/heartbeat',
            json={'customerId': config['customerId'],
                  'collectorId': config.get('collectorId', 'default'),
                  'machineName': socket.gethostname(),
                  'timestamp':   datetime.now(timezone.utc).isoformat()},
            headers=headers, timeout=5
        )
    except Exception:
        pass

# ── collection cycle ─────────────────────────────────────────────────────────
def run_cycle(config, log):
    devices = config.get('devices', [])
    if not devices:
        log.warning("No devices in config — add IP addresses to fleetsync_config.json")
        return
    log.info(f"Collecting {len(devices)} device(s)...")
    results = []
    for dev in devices:
        try:
            data = collect_device(dev, config)
            status = 'ONLINE' if data['isOnline'] else 'OFFLINE'
            log.info(f"  {dev.get('name','?'):<20} [{status}]  "
                     f"K:{data['tonerLevelBlack']:>3}%  C:{data['tonerLevelCyan']:>3}%  "
                     f"M:{data['tonerLevelMagenta']:>3}%  Y:{data['tonerLevelYellow']:>3}%  "
                     f"drum:{data['drumYieldBlack']:>3}%")
            results.append(data)
        except Exception as ex:
            log.error(f"  {dev.get('ip','?')}: {ex}")
    if results:
        send_data(results, config, log)

# ── setup wizard ─────────────────────────────────────────────────────────────
def setup_wizard():
    print('\n' + '='*55 + '\n  FleetSync Pro — Setup Wizard\n' + '='*55 + '\n')
    api_url     = input('  API URL (https://your-server.com): ').strip().rstrip('/')
    customer_id = input('  Customer ID: ').strip()
    api_key     = input('  API Key: ').strip()
    interval    = input('  Interval seconds [60]: ').strip() or '60'
    devices     = []
    print('\n  Enter copier/MFP IP addresses (blank line to finish):')
    n = 1
    while True:
        ip = input(f'    Device {n} IP: ').strip()
        if not ip:
            break
        name = input(f'    Name [Printer {n}]: ').strip() or f'Printer {n}'
        comm = input('    SNMP community [public]: ').strip() or 'public'
        loc  = input('    Location [Office]: ').strip() or 'Office'
        devices.append({'deviceId': f"dev-{ip.replace('.', '-')}",
                        'ip': ip, 'name': name, 'community': comm, 'location': loc})
        n += 1
    cfg = {'apiUrl': api_url, 'customerId': customer_id, 'apiKey': api_key,
           'collectorId': 'collector-' + uuid.uuid4().hex[:8],
           'intervalSeconds': int(interval), 'devices': devices}
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2)
    print(f'\n  [OK] Config saved → {CONFIG_FILE}')
    print(f'  [OK] {len(devices)} device(s) | sends to {api_url} every {interval}s')
    print('\n  Start: run this script again without --setup\n')

# ── main ─────────────────────────────────────────────────────────────────────
def setup_logging():
    """Set up logging — file always, console only when available (not windowed EXE)."""
    handlers = [logging.FileHandler(LOG_FILE, encoding='utf-8')]
    try:
        # In windowed EXE mode sys.stdout is None — skip console handler
        if sys.stdout is not None:
            sys.stdout.write('')   # test it's writable
            handlers.append(logging.StreamHandler(sys.stdout))
    except Exception:
        pass
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s]  %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=handlers
    )
    return logging.getLogger(__name__)

def main():
    if '--setup' in sys.argv or '-s' in sys.argv:
        setup_wizard()
        return

    if not os.path.exists(CONFIG_FILE):
        # If running as windowed EXE with no config, launch wizard in terminal
        try:
            setup_wizard()
        except Exception:
            pass
        return

    with open(CONFIG_FILE, encoding='utf-8') as f:
        config = json.load(f)

    interval = config.get('intervalSeconds', 60)
    log      = setup_logging()

    log.info('=' * 50)
    log.info('  FleetSync Pro Collector v2.0')
    log.info(f'  Customer : {config["customerId"]}')
    log.info(f'  API      : {config["apiUrl"]}')
    log.info(f'  Interval : {interval}s')
    log.info(f'  Devices  : {len(config.get("devices", []))}')
    log.info(f'  SNMP     : {"REAL" if SNMP_OK else "DEMO (simulated)"}')
    log.info(f'  Log file : {LOG_FILE}')
    log.info('=' * 50)

    run_cycle(config, log)
    schedule.every(interval).seconds.do(run_cycle, config, log)

    try:
        while True:
            schedule.run_pending()
            time.sleep(5)
    except KeyboardInterrupt:
        log.info('Collector stopped.')

if __name__ == '__main__':
    main()
