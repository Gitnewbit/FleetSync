# FleetSync Pro

Real-time MFP & Copier Fleet Monitoring for IT Managers.

Single IT Manager login → full visibility across all customers and devices → live toner, drum, fuser, and meter data — every 60 seconds.

---

## How it works

```
[ MFP / Copier ]  ──SNMP──▶  [ fleetsync_collector.py / .exe ]
                                      │ POST /api/snmp-data
                                      ▼
                             [ FleetSync Pro API (Express) ]
                                      │
                                      ▼
                             [ React Dashboard ]  ◀── IT Manager
```

The **Windows collector** runs at each customer site, polls copiers via SNMP, and sends data to your cloud API every 60 seconds (configurable). The **dashboard** auto-refreshes every 60 seconds. You get a live view of toner, drums, fuser life, page counts, and alerts for every device across every customer — all in one place.

---

## Project structure

```
fleetsync-pro/
├── server.js               Express API (SQLite, JWT, SNMP ingestion)
├── package.json            Server deps + scripts
├── .env                    Secrets (not in git)
├── .env.example            Template
├── start-dev.bat/.sh       One-click dev launcher
├── deploy-prod.sh          Production build + start
│
├── client/                 React frontend
│   ├── src/
│   │   ├── App.js          Main dashboard (all views)
│   │   ├── App.css         Styles (dark theme, CSS vars)
│   │   ├── LoginScreen.js  IT Manager login
│   │   └── index.js        React entry point
│   ├── public/
│   │   └── index.html      HTML shell
│   └── package.json        React deps (proxy → :5000 in dev)
│
└── collector/
    ├── fleetsync_collector.py       Python SNMP collector
    ├── fleetsync_config.json.example Config template
    └── build_exe.bat                Builds collector → .exe
```

---

## Prerequisites

- **Node.js** 18+ (`node --version`)
- **npm** 9+
- **Python 3.8+** (for the collector — on client PC only)

---

## Quick start — Development

### Windows

```bat
start-dev.bat
```

### Mac / Linux

```bash
chmod +x start-dev.sh
./start-dev.sh
```

Both launchers:
1. Copy `.env.example` → `.env` if missing
2. Install all dependencies
3. Start Express API on **port 5000**
4. Start React dev server on **port 3000**

Open **http://localhost:3000** in your browser.

**Default login**
```
Email:    admin@fleetsync.pro
Password: FleetSync2024!
```
Change these in `.env` before going live.

---

## Environment variables (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | API server port |
| `JWT_SECRET` | **Yes** | — | Long random string for JWT signing |
| `ADMIN_EMAIL` | No | `admin@fleetsync.pro` | IT Manager login email |
| `ADMIN_PASSWORD` | No | `FleetSync2024!` | IT Manager login password |
| `CORS_ORIGIN` | No | *(all)* | Comma-separated allowed origins |
| `NODE_ENV` | No | `development` | Set to `production` to serve React build |

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Production deployment

### Option A — Single VPS / Azure VM (recommended)

```bash
# 1. Clone/copy files to your server
# 2. Edit .env — set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, NODE_ENV=production

# 3. Build and launch (serves everything on one port)
./deploy-prod.sh

# 4. (Optional) Keep it running with PM2
npm install -g pm2
NODE_ENV=production pm2 start server.js --name fleetsync
pm2 save && pm2 startup
```

Your dashboard: `http://YOUR_SERVER_IP:5000`

### Option B — Separate frontend + backend

1. Deploy Express API to Azure App Service / Railway / Render
2. Set `REACT_APP_API_URL=https://your-api.azurewebsites.net/api` in `client/.env.production`
3. `cd client && npm run build` → deploy `build/` to Azure Static Web Apps / Vercel

### Firewall

Open **TCP port 5000** (or your `PORT`) so:
- Browsers can reach the dashboard
- Windows collectors at customer sites can POST data

---

## Setting up a customer's Windows collector

### Step 1 — Get the API key

1. Log in to FleetSync Pro
2. Go to **Customers** → click **📥 Installer** on the customer
3. Click **⬇ fleetsync_config.json** — download the pre-filled config
4. Click **⬇ fleetsync_collector.py** — download the collector script
5. Click **⬇ build_exe.bat** — download the build script

Or use the standalone files from the `collector/` folder in this repo.

### Step 2 — Deploy to client PC

Copy all 3 files to the same folder on the Windows PC, e.g. `C:\FleetSync\`:

```
C:\FleetSync\
    fleetsync_collector.py
    fleetsync_config.json
    build_exe.bat
```

### Step 3 — Configure devices in `fleetsync_config.json`

```json
{
  "apiUrl":          "http://YOUR_PUBLIC_IP:5000",
  "customerId":      "CUST-001",
  "apiKey":          "abc123...",
  "collectorId":     "collector-office1",
  "intervalSeconds": 60,
  "devices": [
    {
      "deviceId":  "dev-192-168-1-50",
      "ip":        "192.168.1.50",
      "name":      "Reception Copier",
      "community": "public",
      "location":  "Reception",
      "model":     "Xerox VersaLink C7030"
    }
  ]
}
```

`apiUrl` must be your **public** server URL — the one accessible over the internet.

### Step 4 — Run the collector

**Option A: Run directly with Python**
```bat
python fleetsync_collector.py
```

**Option B: Interactive setup wizard**
```bat
python fleetsync_collector.py --setup
```

**Option C: Build an EXE (no Python needed on client)**
```bat
build_exe.bat        (run as Administrator)
```
→ Produces `FleetSync_Collector.exe` in the same folder.

Double-click the EXE — or schedule it in Windows Task Scheduler to start at boot.

### Step 5 — Verify in dashboard

Switch to **Devices** or **Dashboard** in FleetSync Pro. Within 1-2 minutes you should see the device appear with live toner/drum data and status.

---

## SNMP on copiers

| Brand | Default community | Enable SNMP via |
|---|---|---|
| Xerox | `public` | CentreWare / Web UI → Network → SNMP |
| Canon | `public` | Remote UI → Network → SNMP Settings |
| Ricoh | `public` | Web Image Monitor → Device Management → Configuration → SNMP |
| Konica Minolta | `public` | Web Connection → Network → SNMP Settings |
| Kyocera | `public` | Embedded Web Server → Management → SNMP |

Make sure **SNMPv2c is enabled** and the community string matches your config (usually `public`).

---

## Alert thresholds (automatic)

| Condition | Severity |
|---|---|
| Any toner colour ≤ 15% | High |
| Black drum ≤ 20% | Medium |
| Fuser life ≤ 15% | Critical |
| Device offline | Critical |

Alerts are generated server-side on each SNMP data submission.

---

## API reference (collector endpoints)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/snmp-data` | `X-API-Key` | Bulk device metrics from collector |
| `POST` | `/api/collector/heartbeat` | `X-API-Key` | Collector keepalive |
| `POST` | `/api/auth/login` | — | IT Manager login → JWT |
| `GET` | `/api/devices` | JWT | All devices |
| `GET` | `/api/customers` | JWT | All customers |
| `GET` | `/api/alerts` | JWT | All alerts |
| `GET` | `/api/metrics/:deviceId/latest` | JWT | Latest metrics for one device |
| `GET` | `/api/health` | — | Server health check |

---

## Troubleshooting

**Collector can't reach the API**
- Check your firewall allows TCP port 5000 inbound
- Test: `curl http://YOUR_SERVER_IP:5000/api/health`
- Make sure `apiUrl` in `fleetsync_config.json` uses your **public** IP, not `localhost`

**No SNMP data from copier**
- Verify SNMP is enabled on the device (SNMPv2c)
- Test from collector PC: `python -c "from pysnmp.hlapi import *; print('ok')"`
- Try pinging the copier IP from the collector PC
- Some copiers only respond on `161/UDP` — check Windows Firewall

**Dashboard shows seed/demo data only**
- The API server is not running or unreachable — check the console for errors
- Check `.env` has `JWT_SECRET` set
- Open browser DevTools → Network tab → look for failing `/api/...` requests

**Login fails**
- Admin account is seeded on first startup — check server console for `[✓] IT Manager seeded`
- Make sure `ADMIN_EMAIL` and `ADMIN_PASSWORD` match what you're typing

---

## License

MIT — built by Rosstech IT, Johannesburg. 🇿🇦
