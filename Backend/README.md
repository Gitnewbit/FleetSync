# FleetSync Pro 📊

Real-time MFP & copier fleet monitoring. One login, all customers, live toner/drum/fuser data every 60 seconds.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## Quick Architecture

```
[Copier SNMP] → [FleetSync_Collector.exe] → [Internet] → [FleetSync API on Render] → [IT Manager Dashboard]
```

The Windows EXE runs silently at the customer site, polls every copier via SNMP, and sends data to your cloud API every 60 seconds. You see everything live in the dashboard.

---

## Folder Structure (GitHub Repo)

```
fleetsync-pro/               ← GitHub repo root
├── server.js                ← Express API
├── package.json
├── render.yaml              ← Render.com auto-deploy config
├── .env.example
├── .gitignore
├── client/                  ← React dashboard (built by Render)
│   ├── package.json
│   ├── .env
│   ├── .env.production
│   ├── public/index.html
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── LoginScreen.js
│       └── index.js
└── collector/               ← Windows collector files
    ├── fleetsync_collector.py
    ├── fleetsync_config.json.example
    └── build_exe.bat
```

---

## Deploy to Render.com (Step by Step)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "FleetSync Pro v2"
git remote add origin https://github.com/YOUR_USERNAME/fleetsync-pro.git
git push -u origin main
```

### Step 2 — Create Render Web Service

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect your GitHub account → select `fleetsync-pro`
3. Render detects `render.yaml` — click **Apply**
4. Click **Create Web Service**

### Step 3 — Set Environment Variables on Render

In Render → your service → **Environment**:

| Key | Value |
|---|---|
| `JWT_SECRET` | Any long random string (Render auto-generates one) |
| `ADMIN_EMAIL` | Your email |
| `ADMIN_PASSWORD` | A strong password |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/var/data/fleetsync.db` |
| `PORT` | `10000` |

### Step 4 — Deploy

Click **Manual Deploy** → **Deploy latest commit**

After 3-5 minutes your app is live at:
```
https://fleetsync-pro.onrender.com
```

### Step 5 — First Login

Go to your Render URL → login:
```
Email:    (what you set as ADMIN_EMAIL)
Password: (what you set as ADMIN_PASSWORD)
```

---

## Local Development

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/fleetsync-pro.git
cd fleetsync-pro

# Setup env
cp .env.example .env
# Edit .env — set JWT_SECRET

# Install & run (two terminals)
npm install          # Terminal 1: installs server deps
node server.js       # Terminal 1: starts API on :5000

cd client
npm install          # Terminal 2 (first time only)
npm start            # Terminal 2: opens http://localhost:3000
```

---

## Setting Up the Windows Collector (Client Side)

### Option A — One-Click Installer from Dashboard (Recommended)

1. Log in to your live FleetSync dashboard
2. Go to **Customers** → create or select a customer
3. Click **📥 Installer** → set your **Render URL** as the API URL
4. Click **⬇ Download Windows Installer (.bat)**
5. Send the `.bat` file to the client
6. Client: **Right-click → Run as Administrator**

The installer automatically:
- Installs Python silently (via Windows built-in winget)
- Downloads the collector script from your server
- Writes the pre-filled config with their API key
- Installs required packages (pysnmp, requests, etc.)
- Builds `FleetSync_Collector.exe` (silent, no console window)
- Registers a Windows Scheduled Task — auto-starts on every logon
- Starts the collector immediately in the background

After running, the client edits `C:\FleetSync\CUSTID\fleetsync_config.json` to add their copier IP addresses, then the data flows automatically.

### Option B — Manual Setup

1. Copy `collector/` folder to the client PC
2. Copy `fleetsync_config.json.example` → `fleetsync_config.json`
3. Fill in: `apiUrl`, `customerId`, `apiKey`, and add device IPs
4. Run `build_exe.bat` to build the EXE
5. Double-click `FleetSync_Collector.exe`

---

## SNMP Setup on Copiers

Enable SNMPv2c on each device:

| Brand | Path |
|---|---|
| Xerox | CentreWare → Network → SNMP |
| Canon | Remote UI → Network → SNMP |
| Ricoh | Web Image Monitor → SNMP |
| Konica Minolta | Web Connection → Network → SNMP |
| Kyocera | Embedded Web Server → SNMP |

Community string is usually `public`. Must be SNMPv2c.

---

## Troubleshooting

**Render deploy fails with "JWT_SECRET not set"**
→ Set `JWT_SECRET` in Render Environment before deploying

**Dashboard shows demo data, no live devices**
→ Check API is running: `https://your-app.onrender.com/api/health`
→ Collector log: `C:\FleetSync\CUSTID\fleetsync_collector.log`

**Collector can't reach API**
→ Check Render service is running (green dot on dashboard)
→ Test: open `https://your-app.onrender.com/api/health` in browser

**No SNMP data from copier**
→ Verify SNMPv2c enabled on device
→ Ping copier IP from collector PC
→ Check community string matches config

**allowedHosts error in React**
→ Check `client/.env` has `SKIP_PREFLIGHT_CHECK=true`
