import LoginScreen from './LoginScreen';
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

/* ============================================================
   CONFIGURATION
   ============================================================ */
// API base — auto-detects environment:
// • Dev (port 3000): talks to localhost:5000
// • Production (same origin): uses /api  
// • Env override: REACT_APP_API_URL
const API = (() => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '') + '/api';
  }
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return 'http://localhost:5000/api';
  }
  return '/api';
})();

/* ============================================================
   HELPERS
   ============================================================ */
const fmt    = (n) => (n ?? 0).toLocaleString();
const fmtM   = (n) => ((n ?? 0) / 1_000_000).toFixed(2) + 'M';
const fmtTime = (iso) => new Date(iso).toLocaleString();
const fmtAgo  = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const tonerColor = {
  Black: '#94a3b8', Cyan: '#22d3ee', Magenta: '#f472b6', Yellow: '#facc15',
};
const severityColor = { critical: '#ef4444', high: '#f59e0b', medium: '#eab308' };

/* Generate a random customer ID — e.g. CUST-A3F7B2 */
function generateCustomerId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let id = 'CUST-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}



/* api helper — includes JWT, never throws, returns null on error */
async function apiFetch(path, opts = {}) {
  try {
    const token = localStorage.getItem('fleetsync_token');
    const r = await fetch(API + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
    // Always parse body — errors also return useful JSON from our server
    let data = null;
    try { data = await r.json(); } catch (_) {}
    if (!r.ok) {
      console.warn(`API ${r.status} ${path}`, data);
      return { _apiError: true, _status: r.status, error: data?.error || `HTTP ${r.status}` };
    }
    return data;
  } catch (err) {
    console.error('apiFetch network error:', err.message);
    return { _apiError: true, _status: 0, error: 'Cannot reach the server. Is the backend running?' };
  }
}

/* ============================================================
   SEED DATA  (shown before API data loads)
   ============================================================ */
const SEED_CUSTOMERS = [
  { id: 'cust-001', name: 'Acme Corporation',    email: 'admin@acme.com',  phone: '(555) 123-4567', address: '123 Business Ave', city: 'Johannesburg', state: 'GP', zip: '2001', deviceCount: 4, alertCount: 2 },
  { id: 'cust-002', name: 'Global Services Inc', email: 'info@global.com', phone: '(555) 234-5678', address: '456 Commerce St',  city: 'Cape Town',    state: 'WC', zip: '8001', deviceCount: 3, alertCount: 1 },
  { id: 'cust-003', name: 'Tech Solutions Ltd',  email: 'ops@techsol.com', phone: '(555) 345-6789', address: '789 Innovation Blvd', city: 'Pretoria', state: 'GP', zip: '0002', deviceCount: 5, alertCount: 0 },
];
const SEED_DEVICES = [
  { id: 'dev-001', name: 'Main Lobby Copier',  model: 'Xerox VersaLink C7030',     ip: '192.168.1.50', location: 'Lobby',   serial: 'XRX-2024-001', community: 'public', status: 'online',  pageCount: 1_245_320, bwPages: 980_000, colorPages: 265_320, tonerK: 78, tonerC: 65, tonerM: 52, tonerY: 88, drumK: 92, drumC: 85, drumM: 78, drumY: 95, fuser: 88, temp: 52, errors: [] },
  { id: 'dev-002', name: 'Finance Dept.',       model: 'Canon imageRUNNER 2745',    ip: '192.168.1.51', location: 'Floor 2', serial: 'CAN-2024-002', community: 'public', status: 'online',  pageCount:   892_450, bwPages: 750_000, colorPages: 142_450, tonerK: 34, tonerC: 45, tonerM: 56, tonerY: 23, drumK: 45, drumC: 52, drumM: 48, drumY: 41, fuser: 67, temp: 54, errors: ['W-202: Yellow Toner Low'] },
  { id: 'dev-003', name: 'Operations Floor 3', model: 'Ricoh MP C3004',             ip: '192.168.1.52', location: 'Floor 3', serial: 'RIC-2024-003', community: 'public', status: 'online',  pageCount:   756_200, bwPages: 620_000, colorPages: 136_200, tonerK: 92, tonerC: 78, tonerM: 65, tonerY: 34, drumK: 78, drumC: 72, drumM: 68, drumY: 55, fuser: 92, temp: 49, errors: [] },
  { id: 'dev-004', name: 'HR Department',       model: 'Konica Minolta bizhub C554', ip: '192.168.1.53', location: 'Floor 1', serial: 'KON-2024-004', community: 'public', status: 'offline', pageCount:   523_100, bwPages: 420_000, colorPages: 103_100, tonerK: 18, tonerC: 28, tonerM: 35, tonerY: 12, drumK: 32, drumC: 38, drumM: 42, drumY: 28, fuser: 45, temp:  0, errors: ['E-101: Device Offline'] },
];
const SEED_ALERTS = [
  { id: 'al-001', device: 'Finance Dept.',      deviceId: 'dev-002', severity: 'high',     type: 'toner',   title: 'Yellow Toner Low',     message: 'Yellow toner below 25%. Order supplies.',              code: 'W-202', ts: new Date(Date.now() - 5  * 60000).toISOString(), ack: false },
  { id: 'al-002', device: 'HR Department',      deviceId: 'dev-004', severity: 'critical', type: 'offline', title: 'Device Offline',       message: 'Device offline for 20 min. Check network.',             code: 'E-101', ts: new Date(Date.now() - 20 * 60000).toISOString(), ack: false },
  { id: 'al-003', device: 'HR Department',      deviceId: 'dev-004', severity: 'critical', type: 'toner',   title: 'Black Toner Critical', message: 'Black toner critically low (18%). Replace immediately.', code: 'W-101', ts: new Date(Date.now() - 25 * 60000).toISOString(), ack: false },
  { id: 'al-004', device: 'Operations Floor 3', deviceId: 'dev-003', severity: 'medium',   type: 'maint',   title: 'Drum Maintenance Soon', message: 'Yellow drum approaching replacement threshold (34%).',   code: 'W-301', ts: new Date(Date.now() - 1  * 3600000).toISOString(), ack: false },
];

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */
function TonerBar({ label, value, color }) {
  const low = value <= 20, crit = value <= 10;
  return (
    <div className="toner-row">
      <span className="toner-label" style={{ color: color === '#94a3b8' ? '#94a3b8' : color }}>{label[0]}</span>
      <div className="toner-track">
        <div className={`toner-fill${crit ? ' crit' : low ? ' low' : ''}`}
          style={{ width: `${value}%`, background: crit ? '#ef4444' : low ? '#f59e0b' : color }} />
      </div>
      <span className="toner-pct" style={{ color: crit ? '#ef4444' : low ? '#f59e0b' : undefined }}>{value}%</span>
    </div>
  );
}
function BarFill({ value, color }) {
  const low = value <= 20, crit = value <= 10;
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${value}%`, background: crit ? '#ef4444' : low ? '#f59e0b' : color || 'var(--accent)' }} />
    </div>
  );
}
function StatusPill({ status }) {
  return (
    <span className={`status-pill ${status}`}>
      <span className={`status-dot ${status}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {

  /* ---- auth ---- */
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('fleetsync_user');
    return saved ? JSON.parse(saved) : null;
  });

  /* ---- nav ---- */
  const [view,        setView]        = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ---- data ---- */
  const [customers, setCustomers] = useState(SEED_CUSTOMERS);
  const [devices,   setDevices]   = useState(SEED_DEVICES);
  const [alerts,    setAlerts]    = useState(SEED_ALERTS);

  /* ---- ui ---- */
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  /* ---- modals ---- */
  const [addCustOpen,     setAddCustOpen]     = useState(false);
  const [addDevOpen,      setAddDevOpen]      = useState(false);
  const [devDetailOpen,   setDevDetailOpen]   = useState(false);
  const [installerOpen,   setInstallerOpen]   = useState(false);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);

  /* ---- selected items ---- */
  const [selDevice,    setSelDevice]    = useState(null);
  const [selAlert,     setSelAlert]     = useState(null);
  const [selCustInst,  setSelCustInst]  = useState(null);
  const [generatedPkg, setGeneratedPkg] = useState(null);

  /* ---- forms ---- */
  const [custForm, setCustForm] = useState(() => ({
    customerId: generateCustomerId(), customerName: '', contactEmail: '',
    contactPhone: '', address: '', city: '', state: '', zip: '',
  }));
  const [devForm, setDevForm] = useState({
    name: '', model: '', ip: '', location: '',
    serial: '', community: 'public', customerId: '',
  });
  const [instForm, setInstForm] = useState({
    apiUrl: typeof window !== 'undefined' && window.location.port !== '3000' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:5000',
    collectionInterval: '60',
  });

  const logout = () => {
    localStorage.removeItem('fleetsync_token');
    localStorage.removeItem('fleetsync_user');
    setUser(null);
  };

  /* ---- derived ---- */
  const filteredDev  = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.model.toLowerCase().includes(search.toLowerCase()) ||
    d.ip.toLowerCase().includes(search.toLowerCase())
  );
  const activeAlerts = alerts.filter(a => !a.ack);
  const onlineCount  = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const totalPages   = devices.reduce((s, d) => s + (d.pageCount || 0), 0);
  const avgTonerK    = Math.round(devices.reduce((s, d) => s + (d.tonerK || 0), 0) / (devices.length || 1));

  /* ================================================================
     DATA REFRESH — every 60 seconds, IT Manager sees ALL data
     ================================================================ */
  const refreshData = useCallback(async () => {
    setLoading(true);

    const [devRes, alertRes, custRes] = await Promise.all([
      apiFetch('/devices'),
      apiFetch('/alerts?acknowledged=false'),
      apiFetch('/customers'),
    ]);

    /* customers */
    if (custRes && !custRes._apiError && custRes.length > 0) {
      setCustomers(custRes.map(c => ({
        id:          c.customerId,
        name:        c.customerName,
        email:       c.contactEmail  || '',
        phone:       c.contactPhone  || '',
        address:     c.address       || '',
        city:        c.city          || '',
        state:       c.state         || '',
        zip:         c.zip           || '',
        apiKey:      c.apiKey        || '',
        deviceCount: 0,
        alertCount:  0,
      })));
    }

    /* devices — enrich with latest metrics */
    if (devRes && !devRes._apiError && devRes.length > 0) {
      const enriched = await Promise.all(
        devRes.map(async (d) => {
          const m = await apiFetch(`/metrics/${d.deviceId}/latest`);
          return {
            id:         d.deviceId,
            name:       d.name || d.hostname || d.ipAddress,
            model:      d.model || 'Unknown',
            ip:         d.ipAddress,
            location:   d.location || 'Customer Site',
            serial:     d.serialNumber || '',
            community:  d.snmpCommunity || 'public',
            customerId: d.customerId,
            status:     m?.isOnline ? 'online' : 'offline',
            pageCount:  m?.pageCount      || 0,
            bwPages:    m?.bwPageCount    || 0,
            colorPages: m?.colorPageCount || 0,
            monoLargePages:  m?.monoLargePageCount  || 0,
            colorLargePages: m?.colorLargePageCount || 0,
            tonerK: m?.tonerLevelBlack   || 0,
            tonerC: m?.tonerLevelCyan    || 0,
            tonerM: m?.tonerLevelMagenta || 0,
            tonerY: m?.tonerLevelYellow  || 0,
            drumK:  m?.drumYieldBlack    || 0,
            drumC:  m?.drumYieldCyan     || 0,
            drumM:  m?.drumYieldMagenta  || 0,
            drumY:  m?.drumYieldYellow   || 0,
            fuser:  m?.fuserUnitYield    || 0,
            temp:   m?.temperature       || 0,
            errors: m?.errorDescription  ? [m.errorDescription] : [],
            lastUpdate: m?.timestamp || d.lastSeen || new Date().toISOString(),
          };
        })
      );
      setDevices(enriched);
    }

    /* alerts */
    if (alertRes && !alertRes._apiError && alertRes.length > 0) {
      setAlerts(alertRes.map(a => ({
        id:       a.alertId || a.id,
        device:   a.deviceId,
        severity: (a.severity || 'medium').toLowerCase(),
        title:    a.alertType || 'FleetSync Alert',
        message:  a.message   || '',
        code:     a.errorCode || a.alertType || '',
        ts:       a.createdAt || a.timestamp || new Date().toISOString(),
        ack:      a.acknowledged === 1 || a.acknowledged === true,
      })));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
    const t = setInterval(refreshData, 60_000);   // refresh every 60 seconds
    return () => clearInterval(t);
  }, [refreshData]);

  /* ================================================================
     HANDLERS
     ================================================================ */
  const ackAlert = async (id) => {
    await apiFetch(`/alerts/${id}/acknowledge`, {
      method: 'PUT',
      body:   JSON.stringify({ acknowledgedBy: user?.email || 'IT Manager' }),
    });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ack: true } : a));
  };

  const submitNewCustomer = async () => {
    if (!custForm.customerName) {
      setError('Customer Name is required.');
      return;
    }
    // Ensure customerId is set (should always be, but safety net)
    if (!custForm.customerId) {
      setCustForm(f => ({ ...f, customerId: generateCustomerId() }));
    }
    setError('');
    const res = await apiFetch('/customers', {
      method: 'POST',
      body:   JSON.stringify(custForm),
    });
    if (res?.success) {
      setCustomers(prev => {
        const exists = prev.find(c => c.id === custForm.customerId);
        const entry = {
          id: custForm.customerId, name: custForm.customerName,
          email: custForm.contactEmail, phone: custForm.contactPhone,
          address: custForm.address, city: custForm.city,
          state: custForm.state, zip: custForm.zip,
          deviceCount: 0, alertCount: 0,
        };
        return exists ? prev.map(c => c.id === entry.id ? entry : c) : [...prev, entry];
      });
      setAddCustOpen(false);
      setCustForm({ customerId: generateCustomerId(), customerName: '', contactEmail: '', contactPhone: '', address: '', city: '', state: '', zip: '' });
      setError('');
    } else if (res?._apiError) {
      setError(`Error: ${res.error}`);
    } else {
      setError('Failed to create customer — unexpected response. Check the console.');
    }
  };

  const submitNewDevice = async () => {
    if (!devForm.name || !devForm.ip) { setError('Name and IP are required.'); return; }
    const targetCustomer = devForm.customerId || (customers[0]?.id || 'cust-001');
    const payload = {
      deviceId:     `dev-${Date.now()}`,
      customerId:   targetCustomer,
      name:         devForm.name,
      model:        devForm.model,
      ipAddress:    devForm.ip,
      location:     devForm.location,
      serialNumber: devForm.serial,
      snmpCommunity: devForm.community,
    };
    const devRes = await apiFetch('/devices', { method: 'POST', body: JSON.stringify(payload) });
    if (devRes?._apiError) { setError(`Device error: ${devRes.error}`); return; }
    setDevices(prev => [...prev, {
      id: payload.deviceId, name: devForm.name, model: devForm.model,
      ip: devForm.ip, location: devForm.location, serial: devForm.serial,
      community: devForm.community, customerId: targetCustomer,
      status: 'online', pageCount: 0, bwPages: 0, colorPages: 0,
      tonerK: 100, tonerC: 100, tonerM: 100, tonerY: 100,
      drumK: 100, drumC: 100, drumM: 100, drumY: 100,
      fuser: 100, temp: 0, errors: [],
    }]);
    setAddDevOpen(false);
    setDevForm({ name: '', model: '', ip: '', location: '', serial: '', community: 'public', customerId: '' });
    setError('');
  };

  /* ── installer generation ───────────────────────────────── */
  const generateInstaller = async (cust) => {
    setSelCustInst(cust);
    const res = await apiFetch('/installer/create', {
      method: 'POST',
      body:   JSON.stringify({ customerId: cust.id, apiUrl: instForm.apiUrl }),
    });
    const pkgData = (res && !res._apiError) ? res : null;
    setGeneratedPkg(pkgData || {
      packageId:    `pkg-${Date.now()}`,
      packageName:  `FleetSync-${cust.id}-${Date.now()}`,
      expiresIn:    '7 days',
      configContent: {
        customerId:      cust.id,
        customerName:    cust.name,
        apiUrl:          instForm.apiUrl,
        apiKey:          res?.configContent?.apiKey || 'see-dashboard',
        intervalSeconds: Number(instForm.collectionInterval),
        createdAt:       new Date().toISOString(),
      },
    });
    setInstallerOpen(true);
  };

  const _triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCollectorPy = () => {
    if (!generatedPkg || !selCustInst) return;
    const c = selCustInst;
    _triggerDownload(
`#!/usr/bin/env python3
"""
FleetSync Pro — SNMP Collector
Customer : ${c.name} (${c.id})
Generated: ${new Date().toISOString()}

Usage:
  1. Place fleetsync_config.json in the same folder
  2. Run:  python fleetsync_collector.py
  Setup:   python fleetsync_collector.py --setup

Build EXE (Windows):
  pip install pyinstaller
  pyinstaller --onefile --name FleetSync_Collector fleetsync_collector.py
"""
import json, os, sys, time, uuid, socket, logging, random
from datetime import datetime, timezone

def _ensure(pkg, mod=None):
    import importlib
    try: importlib.import_module(mod or pkg)
    except ImportError:
        os.system(f'"{sys.executable}" -m pip install {pkg} --quiet')

_ensure('requests'); _ensure('schedule')
import requests, schedule

try:
    from pysnmp.hlapi import getCmd, SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity
    SNMP_OK = True
except Exception:
    _ensure('pysnmp')
    try:
        from pysnmp.hlapi import getCmd, SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity
        SNMP_OK = True
    except Exception:
        SNMP_OK = False
        print("[warn] pysnmp unavailable — running in DEMO mode")

BASE_DIR    = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'fleetsync_config.json')
LOG_FILE    = os.path.join(BASE_DIR, 'fleetsync_collector.log')

OIDS = {
    'pageCount':   '1.3.6.1.2.1.43.10.2.1.4.1.1',
    'tonerBkCur':  '1.3.6.1.2.1.43.11.1.1.9.1.1', 'tonerBkMax': '1.3.6.1.2.1.43.11.1.1.8.1.1',
    'tonerCyCur':  '1.3.6.1.2.1.43.11.1.1.9.1.2', 'tonerCyMax': '1.3.6.1.2.1.43.11.1.1.8.1.2',
    'tonerMaCur':  '1.3.6.1.2.1.43.11.1.1.9.1.3', 'tonerMaMax': '1.3.6.1.2.1.43.11.1.1.8.1.3',
    'tonerYeCur':  '1.3.6.1.2.1.43.11.1.1.9.1.4', 'tonerYeMax': '1.3.6.1.2.1.43.11.1.1.8.1.4',
    'drumBkCur':   '1.3.6.1.2.1.43.11.1.1.9.1.5', 'drumBkMax':  '1.3.6.1.2.1.43.11.1.1.8.1.5',
}

def snmp_get(ip, community, oid):
    if not SNMP_OK: return None
    try:
        ei, es, _, vbs = next(getCmd(SnmpEngine(), CommunityData(community, mpModel=1),
            UdpTransportTarget((ip, 161), timeout=3, retries=1), ContextData(), ObjectType(ObjectIdentity(oid))))
        if ei or es: return None
        for vb in vbs:
            raw = vb[1].prettyPrint()
            if 'No Such' in raw or 'No more' in raw: return None
            try: return int(raw)
            except ValueError: return raw
    except Exception: return None

def pct(cur, mx):
    try: return max(0, min(100, round(int(cur) / int(mx) * 100))) if cur is not None and mx and int(mx) > 0 else 0
    except: return 0

def collect_device(device, config):
    ip, community = device.get('ip') or device.get('ipAddress', ''), device.get('community', 'public')
    now = datetime.now(timezone.utc).isoformat()
    out = {
        'deviceId': device.get('deviceId') or f"dev-{ip.replace('.', '-')}",
        'customerId': config['customerId'], 'name': device.get('name', ip),
        'ipAddress': ip, 'model': device.get('model', 'Unknown'),
        'location': device.get('location', 'Office'), 'serialNumber': device.get('serialNumber', ''),
        'snmpCommunity': community, 'timestamp': now, 'isOnline': False,
        'pageCount': 0, 'tonerLevelBlack': 0, 'tonerLevelCyan': 0, 'tonerLevelMagenta': 0,
        'tonerLevelYellow': 0, 'drumYieldBlack': 0, 'fuserUnitYield': 0, 'temperature': 0,
    }
    if not SNMP_OK:
        out.update({'isOnline': True,
            'pageCount': device.get('_p', 0) + random.randint(0, 8),
            'tonerLevelBlack':   max(0, device.get('_bk', random.randint(40,95)) - random.randint(0,1)),
            'tonerLevelCyan':    max(0, device.get('_cy', random.randint(40,95)) - random.randint(0,1)),
            'tonerLevelMagenta': max(0, device.get('_ma', random.randint(40,95)) - random.randint(0,1)),
            'tonerLevelYellow':  max(0, device.get('_ye', random.randint(40,95)) - random.randint(0,1)),
            'drumYieldBlack':    max(0, device.get('_dr', random.randint(50,90)) - random.randint(0,1)),
            'fuserUnitYield':    max(0, device.get('_fu', random.randint(50,90)) - random.randint(0,1)),
            'temperature': random.randint(44, 58)})
        device.update({'_p': out['pageCount'], '_bk': out['tonerLevelBlack'], '_cy': out['tonerLevelCyan'],
            '_ma': out['tonerLevelMagenta'], '_ye': out['tonerLevelYellow'],
            '_dr': out['drumYieldBlack'], '_fu': out['fuserUnitYield']})
        return out
    pc = snmp_get(ip, community, OIDS['pageCount'])
    if pc is not None:
        out['isOnline'] = True; out['pageCount'] = int(pc)
        out['tonerLevelBlack']   = pct(snmp_get(ip, community, OIDS['tonerBkCur']), snmp_get(ip, community, OIDS['tonerBkMax']))
        out['tonerLevelCyan']    = pct(snmp_get(ip, community, OIDS['tonerCyCur']), snmp_get(ip, community, OIDS['tonerCyMax']))
        out['tonerLevelMagenta'] = pct(snmp_get(ip, community, OIDS['tonerMaCur']), snmp_get(ip, community, OIDS['tonerMaMax']))
        out['tonerLevelYellow']  = pct(snmp_get(ip, community, OIDS['tonerYeCur']), snmp_get(ip, community, OIDS['tonerYeMax']))
        dr = pct(snmp_get(ip, community, OIDS['drumBkCur']), snmp_get(ip, community, OIDS['drumBkMax']))
        out['drumYieldBlack'] = dr; out['fuserUnitYield'] = dr
    return out

def run_cycle(config):
    devices = config.get('devices', [])
    if not devices: log.warning("No devices configured"); return
    log.info(f"Collecting {len(devices)} device(s)...")
    results = []
    for dev in devices:
        try:
            data = collect_device(dev, config)
            log.info(f"  {dev.get('name', dev.get('ip','?'))}  {('ONLINE' if data['isOnline'] else 'OFFLINE')}  K:{data['tonerLevelBlack']}% C:{data['tonerLevelCyan']}% M:{data['tonerLevelMagenta']}% Y:{data['tonerLevelYellow']}%")
            results.append(data)
        except Exception as ex:
            log.error(f"  {dev.get('ip','?')}: {ex}")
    if not results: return
    url = config['apiUrl'].rstrip('/') + '/api/snmp-data'
    hdrs = {'Content-Type': 'application/json', 'X-API-Key': config['apiKey']}
    payload = {'customerId': config['customerId'], 'apiKey': config['apiKey'],
               'collectorId': config.get('collectorId', 'default'),
               'timestamp': datetime.now(timezone.utc).isoformat(), 'devices': results}
    try:
        r = requests.post(url, json=payload, headers=hdrs, timeout=20)
        if r.status_code == 200:
            d = r.json(); log.info(f"  Sent {d.get('processed', len(results))}/{len(results)} — HTTP 200 OK")
        else:
            log.warning(f"  API HTTP {r.status_code}: {r.text[:200]}")
    except requests.exceptions.ConnectionError:
        log.error(f"  Cannot reach {url}")
    except Exception as ex:
        log.error(f"  Send failed: {ex}")
    try:
        requests.post(config['apiUrl'].rstrip('/') + '/api/collector/heartbeat',
            json={'customerId': config['customerId'], 'collectorId': config.get('collectorId', 'default'),
                  'machineName': socket.gethostname(), 'timestamp': datetime.now(timezone.utc).isoformat()},
            headers=hdrs, timeout=5)
    except: pass

def setup_wizard():
    print("\\n" + "="*60 + "\\n  FleetSync Pro — Setup Wizard\\n" + "="*60)
    api_url     = input("\\nAPI URL (https://your-server.com): ").strip().rstrip('/')
    customer_id = input("Customer ID: ").strip()
    api_key     = input("API Key (from FleetSync dashboard): ").strip()
    interval    = input("Interval seconds [60]: ").strip() or '60'
    devices = []
    print("\\nEnter MFP IP addresses (blank to finish):")
    n = 1
    while True:
        ip = input(f"  Device {n} IP: ").strip()
        if not ip: break
        name = input(f"  Name [{f'Printer {n}'}]: ").strip() or f'Printer {n}'
        community = input("  SNMP community [public]: ").strip() or 'public'
        location  = input("  Location [Office]: ").strip() or 'Office'
        model     = input("  Model (optional): ").strip() or 'Unknown'
        devices.append({'deviceId': f"dev-{ip.replace('.', '-')}", 'ip': ip,
                        'name': name, 'community': community, 'location': location, 'model': model})
        n += 1
    cfg = {'apiUrl': api_url, 'customerId': customer_id, 'apiKey': api_key,
           'collectorId': 'collector-' + uuid.uuid4().hex[:8],
           'intervalSeconds': int(interval), 'devices': devices}
    with open(CONFIG_FILE, 'w') as f: json.dump(cfg, f, indent=2)
    print(f"\\n[OK] Config saved → {CONFIG_FILE}  ({len(devices)} device(s))")
    print(f"[OK] Sends to {api_url} every {interval}s\\nRun: python fleetsync_collector.py\\n")

if __name__ == '__main__':
    if '--setup' in sys.argv or '-s' in sys.argv: setup_wizard(); sys.exit(0)
    if not os.path.exists(CONFIG_FILE): print(f"Config not found: {CONFIG_FILE}\\nRun: python fleetsync_collector.py --setup"); sys.exit(1)
    with open(CONFIG_FILE) as f: config = json.load(f)
    interval = config.get('intervalSeconds', 60)
    logging.basicConfig(level=logging.INFO, format='[%(asctime)s]  %(message)s', datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[logging.FileHandler(LOG_FILE, encoding='utf-8'), logging.StreamHandler(sys.stdout)])
    log = logging.getLogger(__name__)
    log.info("="*55)
    log.info(f"  FleetSync Pro Collector | Customer: {config['customerId']}")
    log.info(f"  API: {config['apiUrl']} | Interval: {interval}s")
    log.info(f"  Devices: {len(config.get('devices', []))} | SNMP: {'REAL' if SNMP_OK else 'DEMO'}")
    log.info("="*55)
    run_cycle(config)
    schedule.every(interval).seconds.do(run_cycle, config)
    try:
        while True: schedule.run_pending(); time.sleep(5)
    except KeyboardInterrupt: log.info("[OK] Collector stopped.")
`, `fleetsync_collector_${c.id}.py`, 'text/x-python');
  };

  const downloadConfigJson = () => {
    if (!generatedPkg || !selCustInst) return;
    const cfg = generatedPkg.configContent || {};
    _triggerDownload(
      JSON.stringify({
        apiUrl:          cfg.apiUrl || instForm.apiUrl,
        customerId:      selCustInst.id,
        apiKey:          cfg.apiKey || 'PASTE_API_KEY_HERE',
        collectorId:     `collector-${selCustInst.id.toLowerCase()}`,
        intervalSeconds: Number(instForm.collectionInterval),
        devices: [
          { deviceId: 'dev-192-168-1-50', ip: '192.168.1.50', name: 'Copier 1',    community: 'public', location: 'Reception', model: 'Xerox VersaLink C7030' },
          { deviceId: 'dev-192-168-1-51', ip: '192.168.1.51', name: 'Copier 2',    community: 'public', location: 'Floor 2',   model: 'Canon imageRUNNER 2745' },
        ],
      }, null, 2),
      'fleetsync_config.json', 'application/json'
    );
  };

  const downloadBuildBat = () => {
    if (!selCustInst) return;
    _triggerDownload(
`@echo off
title FleetSync Pro - EXE Builder
echo ================================================
echo  FleetSync Pro Collector - Build EXE
echo ================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found. Install Python 3.8+ from https://python.org
  pause & exit /b 1
)

echo [1/3] Installing dependencies...
pip install pyinstaller pysnmp requests schedule --quiet
if errorlevel 1 ( echo [ERROR] pip install failed & pause & exit /b 1 )

echo [2/3] Building EXE...
pyinstaller --onefile --console --name "FleetSync_Collector" --distpath . fleetsync_collector.py
if errorlevel 1 ( echo [ERROR] PyInstaller failed & pause & exit /b 1 )

echo [3/3] Done!
echo.
echo  FleetSync_Collector.exe is in this folder.
echo  Copy FleetSync_Collector.exe + fleetsync_config.json to the client PC.
echo.
echo  Client instructions:
echo    1. Put both files in C:\\FleetSync\\
echo    2. Double-click FleetSync_Collector.exe  (or run --setup first)
echo    3. Data appears on your dashboard within 1-2 minutes
echo.
pause
`,
      'build_exe.bat', 'application/x-bat'
    );
  };

  const downloadWindowsInstaller = async () => {
    if (!selCustInst) {
      alert('No customer selected. Please close and click Installer again.');
      return;
    }

    // Build the base URL — strip trailing /api if present
    const rawBase = API.replace(/\/api\/?$/, '').replace(/\/$/, '');

    // First verify the API is reachable (no auth needed)
    try {
      const ping = await fetch(`${rawBase}/api/test-connection`, { method: 'GET' });
      if (!ping.ok) throw new Error(`API returned ${ping.status}`);
    } catch (pingErr) {
      alert(
        `Cannot reach the API server.\n\n` +
        `Tried: ${rawBase}/api/test-connection\n` +
        `Error: ${pingErr.message}\n\n` +
        `Make sure the backend is running and the API URL in Settings is correct.`
      );
      return;
    }

    // Build download URL — no auth required on this endpoint
    const params = new URLSearchParams({
      apiUrl:       instForm.apiUrl || rawBase,
      interval:     instForm.collectionInterval || '60',
      customerName: selCustInst.name || selCustInst.id,
      apiKey:       generatedPkg?.configContent?.apiKey || '',
    });

    const downloadUrl = `${rawBase}/api/installer/windows/${encodeURIComponent(selCustInst.id)}?${params}`;

    try {
      const r = await fetch(downloadUrl);   // no Authorization header needed

      if (!r.ok) {
        let errMsg = `Server returned HTTP ${r.status}`;
        try { const j = await r.json(); errMsg = j.error || errMsg; } catch (_) {}
        alert(`Installer generation failed:\n${errMsg}\n\nURL tried:\n${downloadUrl}`);
        return;
      }

      const blob = await r.blob();
      if (blob.size < 200) {
        alert('Generated file is too small — something went wrong on the server. Check backend logs.');
        return;
      }

      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `FleetSync_Setup_${selCustInst.id}.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

    } catch (e) {
      alert(`Network error downloading installer:\n${e.message}\n\nURL: ${downloadUrl}`);
    }
  };


  const DashboardView = () => (
    <>
      <div className="kpi-grid">
        <div className="kpi-card kpi-green">
          <div className="kpi-top"><div className="kpi-icon">🖨️</div><span className="kpi-trend up">▲ Live</span></div>
          <div className="kpi-value">{onlineCount}</div>
          <div className="kpi-label">Online Devices</div>
        </div>
        <div className="kpi-card kpi-red">
          <div className="kpi-top"><div className="kpi-icon">⛔</div><span className="kpi-trend down">▼ Check</span></div>
          <div className="kpi-value">{offlineCount}</div>
          <div className="kpi-label">Offline Devices</div>
        </div>
        <div className="kpi-card kpi-orange">
          <div className="kpi-top"><div className="kpi-icon">⚠️</div><span className="kpi-trend down">{activeAlerts.length} open</span></div>
          <div className="kpi-value">{activeAlerts.length}</div>
          <div className="kpi-label">Active Alerts</div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-top"><div className="kpi-icon">📄</div><span className="kpi-trend flat">Total</span></div>
          <div className="kpi-value">{fmtM(totalPages)}</div>
          <div className="kpi-label">Pages Printed</div>
        </div>
        <div className="kpi-card kpi-purple">
          <div className="kpi-top"><div className="kpi-icon">🎨</div><span className={`kpi-trend ${avgTonerK < 30 ? 'down' : 'up'}`}>{avgTonerK < 30 ? '▼ Low' : '▲ OK'}</span></div>
          <div className="kpi-value">{avgTonerK}%</div>
          <div className="kpi-label">Avg. Black Toner</div>
        </div>
        <div className="kpi-card kpi-cyan">
          <div className="kpi-top"><div className="kpi-icon">👥</div><span className="kpi-trend flat">Managed</span></div>
          <div className="kpi-value">{customers.length}</div>
          <div className="kpi-label">Customers</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">🖨️ Devices Overview</span>
          <div className="card-controls">
            <input className="search-box" placeholder="Search devices…" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-secondary" onClick={refreshData}>↺ Refresh</button>
            <button className="btn btn-primary" onClick={() => setAddDevOpen(true)}>+ Add Device</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Device</th><th>IP Address</th><th>Location</th><th>Status</th>
              <th>Total Pages</th><th>Toner KCMY</th><th>Drum / Fuser</th><th>Temp</th><th>Last Seen</th><th>Action</th>
            </tr></thead>
            <tbody>
              {filteredDev.map(d => (
                <tr key={d.id}>
                  <td><div className="cell-strong">{d.name}</div><div className="cell-mono">{d.model}</div></td>
                  <td><span className="cell-mono">{d.ip}</span></td>
                  <td>{d.location}</td>
                  <td><StatusPill status={d.status} /></td>
                  <td className="cell-strong">{fmt(d.pageCount)}</td>
                  <td>
                    <div className="toner-bars">
                      {Object.entries({ Black: d.tonerK, Cyan: d.tonerC, Magenta: d.tonerM, Yellow: d.tonerY }).map(([k, v]) => (
                        <TonerBar key={k} label={k} value={v} color={tonerColor[k]} />
                      ))}
                    </div>
                  </td>
                  <td><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}><div>Drum K: <strong>{d.drumK}%</strong></div><div>Fuser: <strong>{d.fuser}%</strong></div></div></td>
                  <td><span style={{ color: d.temp > 70 ? '#ef4444' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{d.temp > 0 ? `${d.temp}°C` : '—'}</span></td>
                  <td><span className="alert-time">{fmtAgo(d.lastUpdate || new Date().toISOString())}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setSelDevice(d); setDevDetailOpen(true); }}>Details</button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteDevice(d)}>🗑</button>
                  </td>
                </tr>
              ))}
              {filteredDev.length === 0 && <tr><td colSpan={10}><div className="empty-state"><span className="empty-icon">🖨️</span><h3>No devices found</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">⚠️ Active Alerts</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeAlerts.length} unacknowledged</span>
        </div>
        <div className="alerts-list">
          {activeAlerts.length === 0 && <div className="empty-state"><span className="empty-icon">✅</span><h3>No active alerts</h3><p>All devices running normally.</p></div>}
          {activeAlerts.map(a => (
            <div key={a.id} className="alert-row">
              <div className={`alert-dot ${a.severity}`} />
              <div className="alert-body">
                <div className="alert-title">{a.title}</div>
                <div className="alert-meta">
                  <span>🖨️ {a.device}</span>
                  {a.code && <span className="alert-code">{a.code}</span>}
                  <span className="alert-time">{fmtAgo(a.ts)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{a.message}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => { setSelAlert(a); setAlertDetailOpen(true); }}>View</button>
                <button className="btn btn-sm btn-primary" onClick={() => ackAlert(a.id)}>✓ Ack</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ---- DEVICES ---- */
  const DevicesView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left"><h1>🖨️ Device Management</h1><p>All MFPs and printers across all customers</p></div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={refreshData}>↺ Refresh</button>
          <button className="btn btn-primary" onClick={() => setAddDevOpen(true)}>+ Add Device</button>
        </div>
      </div>
      <input className="search-box" style={{ width: '100%', marginBottom: 4 }} placeholder="Search by name, model or IP…" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="devices-grid">
        {filteredDev.map(d => (
          <div key={d.id} className={`device-card ${d.status}`} onClick={() => { setSelDevice(d); setDevDetailOpen(true); }}>
            <div className="device-card-top">
              <div className="device-card-info">
                <div className="device-card-name">{d.name}</div>
                <div className="device-card-model">{d.model}</div>
              </div>
              <StatusPill status={d.status} />
            </div>
            <div className="device-card-meta">
              <span className="meta-chip">📍 {d.location}</span>
              <span className="meta-chip">🌐 {d.ip}</span>
              <span className="meta-chip">🔑 {d.serial || 'N/A'}</span>
            </div>
            <div className="device-card-meters">
              <div className="meter-item"><div className="meter-label">Total Pages</div><div className="meter-value">{fmtM(d.pageCount)}</div><div className="meter-sub">million</div></div>
              <div className="meter-item"><div className="meter-label">B&W / Color</div><div className="meter-value">{fmtM(d.bwPages)}</div><div className="meter-sub">{fmtM(d.colorPages)} color</div></div>
              <div className="meter-item"><div className="meter-label">Temperature</div><div className="meter-value" style={{ color: d.temp > 70 ? '#ef4444' : 'inherit' }}>{d.temp > 0 ? `${d.temp}°C` : '—'}</div></div>
              <div className="meter-item"><div className="meter-label">Fuser Unit</div><div className="meter-value">{d.fuser}%</div></div>
            </div>
            <div className="toner-bars">
              {Object.entries({ Black: d.tonerK, Cyan: d.tonerC, Magenta: d.tonerM, Yellow: d.tonerY }).map(([k, v]) => (
                <TonerBar key={k} label={k} value={v} color={tonerColor[k]} />
              ))}
            </div>
            {d.errors.length > 0 && <div className="device-card-errors">{d.errors.map((e, i) => <div key={i} className="error-chip">⚠ {e}</div>)}</div>}
            <div className="device-card-footer">
              <span className="alert-time">Updated {fmtAgo(d.lastUpdate || new Date().toISOString())}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-secondary" onClick={ev => { ev.stopPropagation(); setSelDevice(d); setDevDetailOpen(true); }}>Details</button>
                <button className="btn btn-sm btn-danger" onClick={ev => { ev.stopPropagation(); deleteDevice(d); }}>🗑</button>
              </div>
            </div>
          </div>
        ))}
        {filteredDev.length === 0 && <div className="empty-state" style={{ gridColumn: '1/-1' }}><span className="empty-icon">🖨️</span><h3>No devices found</h3><p>Add a device or check your API connection.</p></div>}
      </div>
    </>
  );

  /* ---- CONSUMABLES ---- */
  const ConsumablesView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left"><h1>🎨 Consumables & Supplies</h1><p>Toner, drums, and fuser health across all devices</p></div>
      </div>
      <div className="consumables-grid">
        {devices.map(d => (
          <div key={d.id} className="consumable-card">
            <div><div className="consumable-card-title">{d.name}</div><div className="consumable-card-model">{d.model} — <StatusPill status={d.status} /></div></div>
            <div className="consumable-rows">
              {[
                { label: 'Black Toner',   val: d.tonerK, color: tonerColor.Black },
                { label: 'Cyan Toner',    val: d.tonerC, color: tonerColor.Cyan },
                { label: 'Magenta Toner', val: d.tonerM, color: tonerColor.Magenta },
                { label: 'Yellow Toner',  val: d.tonerY, color: tonerColor.Yellow },
                { label: 'Drum (K)',      val: d.drumK,  color: '#60a5fa' },
                { label: 'Drum (C)',      val: d.drumC,  color: '#22d3ee' },
                { label: 'Drum (M)',      val: d.drumM,  color: '#f472b6' },
                { label: 'Drum (Y)',      val: d.drumY,  color: '#facc15' },
                { label: 'Fuser Unit',    val: d.fuser,  color: '#a78bfa' },
              ].map(row => (
                <div key={row.label} className="consumable-row">
                  <div className="consumable-row-top">
                    <span className="consumable-row-label">{row.label}</span>
                    <span className="consumable-row-value" style={{ color: row.val <= 10 ? '#ef4444' : row.val <= 20 ? '#f59e0b' : 'var(--text-primary)' }}>{row.val}%</span>
                  </div>
                  <BarFill value={row.val} color={row.val <= 10 ? '#ef4444' : row.val <= 20 ? '#f59e0b' : row.color} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  /* ---- ALERTS ---- */
  const AlertsView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left"><h1>⚠️ Alerts & Error Codes</h1><p>{activeAlerts.length} active alerts require attention</p></div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setAlerts(prev => prev.map(a => ({ ...a, ack: true })))}>✓ Acknowledge All</button>
        </div>
      </div>
      <div className="card">
        <div className="alerts-list">
          {alerts.length === 0 && <div className="empty-state"><span className="empty-icon">✅</span><h3>No alerts</h3><p>All systems nominal.</p></div>}
          {alerts.map(a => (
            <div key={a.id} className="alert-row" style={{ opacity: a.ack ? 0.45 : 1 }}>
              <div className={`alert-dot ${a.ack ? 'online' : a.severity}`} />
              <div className="alert-body">
                <div className="alert-title">{a.title}{a.ack && <span style={{ fontSize: 11, color: 'var(--accent-green)', marginLeft: 6 }}>✓ Acknowledged</span>}</div>
                <div className="alert-meta">
                  <span>🖨️ {a.device}</span>
                  {a.code && <span className="alert-code">{a.code}</span>}
                  <span className="alert-time">{fmtTime(a.ts)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.message}</div>
              </div>
              {!a.ack && <button className="btn btn-sm btn-primary" onClick={() => ackAlert(a.id)}>✓ Ack</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ---- CUSTOMERS ---- */
  const CustomersView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left"><h1>👥 Customer Management</h1><p>{customers.length} managed customers</p></div>
        <div className="page-header-actions"><button className="btn btn-primary" onClick={() => setAddCustOpen(true)}>+ Add Customer</button></div>
      </div>
      <div className="customers-grid">
        {customers.map(c => (
          <div key={c.id} className="customer-card">
            <div className="customer-card-top">
              <div className="customer-logo">{c.name.charAt(0)}</div>
              <div><div className="customer-card-name">{c.name}</div><div className="customer-card-id">{c.id}</div></div>
            </div>
            <div className="customer-card-details">
              <div className="cust-detail"><span className="cust-detail-icon">📧</span>{c.email}</div>
              <div className="cust-detail"><span className="cust-detail-icon">📞</span>{c.phone}</div>
              {c.city && <div className="cust-detail"><span className="cust-detail-icon">📍</span>{c.city}{c.state ? `, ${c.state}` : ''}</div>}
            </div>
            <div className="customer-stats">
              <div className="cust-stat"><div className="cust-stat-value">{devices.filter(d => d.customerId === c.id).length || c.deviceCount}</div><div className="cust-stat-label">Devices</div></div>
              <div className="cust-stat"><div className="cust-stat-value" style={{ color: (alerts.filter(a => !a.ack).length) > 0 ? '#f59e0b' : 'var(--accent-green)' }}>{alerts.filter(a => !a.ack && devices.find(d => d.id === a.deviceId)?.customerId === c.id).length || c.alertCount}</div><div className="cust-stat-label">Alerts</div></div>
            </div>
            <div className="customer-card-actions">
              <div className="cust-action-row">
                <button className="btn btn-secondary" onClick={() => { setView('devices'); setSearch(c.id); }}>View Devices</button>
                <button className="btn btn-primary" onClick={() => generateInstaller(c)}>📥 Installer</button>
              </div>
              <button className="btn btn-danger-soft" onClick={() => deleteCustomer(c)}>🗑 Delete Customer</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  /* ---- DOWNLOAD / INSTALLER ---- */
  const DownloadView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left"><h1>📥 Client Installer</h1><p>Generate a customised Python collector for each customer</p></div>
      </div>
      <div className="installer-banner">
        <div className="installer-icon">💾</div>
        <div className="installer-text">
          <h2>FleetSync Collector — How it works</h2>
          <p>The collector runs on a Windows PC at the customer site. It polls all copiers/MFPs via SNMP and sends real-time toner, drum, fuser, and meter data to your FleetSync dashboard every {instForm.collectionInterval} seconds over the internet.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">⚙️ API & Interval Settings</span></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Your FleetSync API URL</label>
              <input className="form-input" placeholder="https://your-server.com or http://your-ip:5000" value={instForm.apiUrl} onChange={e => setInstForm({ ...instForm, apiUrl: e.target.value })} />
              <div className="form-hint">Clients will POST data to this URL. Use your public IP or domain in production.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Collection Interval (seconds)</label>
              <input className="form-input" type="number" min="30" max="3600" value={instForm.collectionInterval} onChange={e => setInstForm({ ...instForm, collectionInterval: e.target.value })} />
              <div className="form-hint">60 = every minute, 300 = every 5 minutes.</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">👥 Select Customer & Download Collector</span></div>
        <div className="customers-grid" style={{ padding: 20 }}>
          {customers.map(c => (
            <div key={c.id} className="customer-card">
              <div className="customer-card-top">
                <div className="customer-logo">{c.name.charAt(0)}</div>
                <div><div className="customer-card-name">{c.name}</div><div className="customer-card-id">{c.id}</div></div>
              </div>
              <div className="customer-card-details">
                <div className="cust-detail"><span className="cust-detail-icon">📧</span>{c.email}</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => generateInstaller(c)}>
                📥 Generate Package
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );


  /* ── DELETE CUSTOMER ──────────────────────────────────────────────────── */
  const deleteCustomer = async (cust) => {
    if (!window.confirm(
      `Delete customer "${cust.name}" (${cust.id})?\n\n` +
      `This will also remove all their devices, metrics, and alerts.\n\n` +
      `This cannot be undone.`
    )) return;

    const res = await apiFetch(`/customers/${encodeURIComponent(cust.id)}`, { method: 'DELETE' });

    if (res?._apiError) {
      alert(`Could not delete customer:\n${res.error}`);
      return;
    }
    if (res?.success) {
      setCustomers(prev => prev.filter(c => c.id !== cust.id));
      setDevices(prev => prev.filter(d => d.customerId !== cust.id));
      setAlerts(prev => prev.filter(a => {
        const devIds = devices.filter(d => d.customerId === cust.id).map(d => d.id);
        return !devIds.includes(a.deviceId);
      }));
    }
  };

  /* ── DELETE DEVICE ─────────────────────────────────────────────────────── */
  const deleteDevice = async (device) => {
    if (!window.confirm(
      `Delete device "${device.name}"?\n` +
      `IP: ${device.ip}\n\n` +
      `All metrics and alerts for this device will also be removed.\n\n` +
      `This cannot be undone.`
    )) return;

    const res = await apiFetch(`/devices/${encodeURIComponent(device.id)}`, { method: 'DELETE' });

    if (res?._apiError) {
      alert(`Could not delete device:\n${res.error}`);
      return;
    }
    if (res?.success) {
      setDevices(prev => prev.filter(d => d.id !== device.id));
      setAlerts(prev => prev.filter(a => a.deviceId !== device.id));
      if (selDevice?.id === device.id) { setDevDetailOpen(false); setSelDevice(null); }
    }
  };

  /* ---- SETTINGS ---- */
  const SettingsView = () => (
    <div className="settings-view">
      <div className="page-header"><div className="page-header-left"><h1>⚙️ Settings</h1><p>FleetSync Pro configuration</p></div></div>
      <div className="settings-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">🔌 API Connection</span></div>
          <div className="modal-body" style={{ paddingTop: 16 }}>
            <div className="form-group">
              <label className="form-label">API Base URL</label>
              <input className="form-input" value={instForm.apiUrl} onChange={e => setInstForm(f => ({ ...f, apiUrl: e.target.value }))} placeholder="http://localhost:5000" />
            </div>
            <div className="form-group">
              <label className="form-label">Default Collection Interval (s)</label>
              <input className="form-input" type="number" min="30" value={instForm.collectionInterval} onChange={e => setInstForm(f => ({ ...f, collectionInterval: e.target.value }))} />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={refreshData}>↺ Test Connection & Refresh</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">⚠️ Alert Thresholds</span></div>
          <div className="modal-body" style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>Alerts are fired automatically by the backend:</p>
            <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 18, marginTop: 8 }}>
              <li>Toner ≤ 15% → <strong>High</strong> alert</li>
              <li>Drum ≤ 20% → <strong>Medium</strong> alert</li>
              <li>Fuser ≤ 15% → <strong>Critical</strong> alert</li>
              <li>Device offline → <strong>Critical</strong> alert</li>
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔄 Auto-Refresh</span></div>
          <div className="modal-body" style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Dashboard refreshes every <strong>60 seconds</strong> automatically. The Windows collector sends data on its own interval (default: {instForm.collectionInterval}s).
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  /* ---- PROFILE ---- */
  const ProfileView = () => (
    <div className="settings-view">
      <div className="page-header"><div className="page-header-left"><h1>👤 Profile</h1><p>IT Manager account</p></div></div>
      <div className="settings-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Account</span></div>
          <div className="modal-body" style={{ paddingTop: 16 }}>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" readOnly value={user?.email || '—'} /></div>
            <div className="form-group"><label className="form-label">Role</label><input className="form-input" readOnly value={user?.role || '—'} /></div>
            <div className="form-group"><label className="form-label">Access Level</label><input className="form-input" readOnly value="All customers (IT Manager)" /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Session</span></div>
          <div className="modal-body" style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Signed in as <strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong>. Session stored locally, expires in 7 days.
            </p>
            <button className="btn btn-danger" style={{ marginTop: 16 }} onClick={logout}>🚪 Sign Out</button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ================================================================
     MODALS
     ================================================================ */
  const renderAddCustomerModal = () => (
    <div className="modal-backdrop" onClick={() => setAddCustOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add New Customer</h2><button className="modal-close" onClick={() => setAddCustOpen(false)}>✕</button></div>
        <div className="modal-body">
          {error && <div className="error-banner">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group"><label className="form-label">Customer ID</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: 1 }}
                  value={custForm.customerId}
                  readOnly
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  title="Generate new ID"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => setCustForm(f => ({ ...f, customerId: generateCustomerId() }))}
                >
                  🔀 New ID
                </button>
              </div>
              <div className="form-hint">Auto-generated — click 🔀 to get a different one.</div>
            </div>
            <div className="form-group"><label className="form-label">Customer Name *</label><input className="form-input" placeholder="Acme Corporation" value={custForm.customerName} onChange={e => setCustForm(f => ({ ...f, customerName: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Contact Email</label><input className="form-input" type="email" placeholder="admin@company.com" value={custForm.contactEmail} onChange={e => setCustForm(f => ({ ...f, contactEmail: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Contact Phone</label><input className="form-input" placeholder="+27 11 000 0000" value={custForm.contactPhone} onChange={e => setCustForm(f => ({ ...f, contactPhone: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Street Address</label><input className="form-input" placeholder="123 Business Ave" value={custForm.address} onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">City</label><input className="form-input" value={custForm.city} onChange={e => setCustForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Province</label><input className="form-input" placeholder="GP" value={custForm.state} onChange={e => setCustForm(f => ({ ...f, state: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Postal Code</label><input className="form-input" value={custForm.zip} onChange={e => setCustForm(f => ({ ...f, zip: e.target.value }))} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setAddCustOpen(false); setError(''); }}>Cancel</button>
          <button className="btn btn-primary" onClick={submitNewCustomer}>Create Customer</button>
        </div>
      </div>
    </div>
  );

  const renderAddDeviceModal = () => (
    <div className="modal-backdrop" onClick={() => setAddDevOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add Device / MFP</h2><button className="modal-close" onClick={() => setAddDevOpen(false)}>✕</button></div>
        <div className="modal-body">
          {error && <div className="error-banner">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select className="form-input form-select" value={devForm.customerId || (customers[0]?.id || '')} onChange={e => setDevForm(f => ({ ...f, customerId: e.target.value }))}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Device Name *</label><input className="form-input" placeholder="Main Lobby Copier" value={devForm.name} onChange={e => setDevForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Model</label><input className="form-input" placeholder="Xerox VersaLink C7030" value={devForm.model} onChange={e => setDevForm(f => ({ ...f, model: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">IP Address *</label><input className="form-input" placeholder="192.168.1.100" value={devForm.ip} onChange={e => setDevForm(f => ({ ...f, ip: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Location</label><input className="form-input" placeholder="Floor 2, East Wing" value={devForm.location} onChange={e => setDevForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Serial Number</label><input className="form-input" placeholder="XRX-2024-001" value={devForm.serial} onChange={e => setDevForm(f => ({ ...f, serial: e.target.value }))} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">SNMP Community String</label>
            <input className="form-input" placeholder="public" value={devForm.community} onChange={e => setDevForm(f => ({ ...f, community: e.target.value }))} />
            <div className="form-hint">Usually "public". Check your MFP's network/SNMP settings.</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setAddDevOpen(false); setError(''); }}>Cancel</button>
          <button className="btn btn-primary" onClick={submitNewDevice}>Add Device</button>
        </div>
      </div>
    </div>
  );

  const DeviceDetailModal = () => selDevice && (
    <div className="modal-backdrop" onClick={() => setDevDetailOpen(false)}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>🖨️ {selDevice.name}</h2><button className="modal-close" onClick={() => setDevDetailOpen(false)}>✕</button></div>
        <div className="modal-body">
          <div className="section-label">Device Information</div>
          <div className="detail-grid">
            <div className="detail-item"><label>Model</label><div className="val">{selDevice.model}</div></div>
            <div className="detail-item"><label>IP Address</label><div className="val" style={{ fontFamily: 'var(--font-mono)' }}>{selDevice.ip}</div></div>
            <div className="detail-item"><label>Serial Number</label><div className="val">{selDevice.serial || '—'}</div></div>
            <div className="detail-item"><label>Location</label><div className="val">{selDevice.location}</div></div>
            <div className="detail-item"><label>SNMP Community</label><div className="val">{selDevice.community}</div></div>
            <div className="detail-item"><label>Status</label><div className="val"><StatusPill status={selDevice.status} /></div></div>
            <div className="detail-item"><label>Temperature</label><div className="val" style={{ color: selDevice.temp > 70 ? '#ef4444' : 'inherit' }}>{selDevice.temp > 0 ? `${selDevice.temp}°C` : '—'}</div></div>
          </div>
          <div className="section-label" style={{ marginTop: 16 }}>Meter Readings</div>
          <div className="detail-grid">
            <div className="detail-item"><label>Total Pages</label><div className="val">{fmt(selDevice.pageCount)}</div></div>
            <div className="detail-item"><label>B&W Pages</label><div className="val">{fmt(selDevice.bwPages)}</div></div>
            <div className="detail-item"><label>Colour Pages</label><div className="val">{fmt(selDevice.colorPages)}</div></div>
            <div className="detail-item"><label>Mono Large</label><div className="val">{fmt(selDevice.monoLargePages || 0)}</div></div>
            <div className="detail-item"><label>Colour Large</label><div className="val">{fmt(selDevice.colorLargePages || 0)}</div></div>
          </div>
          <div className="section-label" style={{ marginTop: 16 }}>Toner Levels</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries({ Black: selDevice.tonerK, Cyan: selDevice.tonerC, Magenta: selDevice.tonerM, Yellow: selDevice.tonerY }).map(([k, v]) => (
              <TonerBar key={k} label={k} value={v} color={tonerColor[k]} />
            ))}
          </div>
          <div className="section-label" style={{ marginTop: 16 }}>Consumables Health</div>
          <div className="detail-grid">
            {[['Drum — Black', selDevice.drumK], ['Drum — Cyan', selDevice.drumC], ['Drum — Magenta', selDevice.drumM], ['Drum — Yellow', selDevice.drumY], ['Fuser Unit', selDevice.fuser]].map(([lbl, val]) => (
              <div className="detail-item" key={lbl}>
                <label>{lbl}</label>
                <div className="val" style={{ color: val <= 10 ? '#ef4444' : val <= 20 ? '#f59e0b' : 'inherit' }}>{val}%</div>
                <BarFill value={val} color={val <= 10 ? '#ef4444' : val <= 20 ? '#f59e0b' : 'var(--accent-green)'} />
              </div>
            ))}
          </div>
          {selDevice.errors.length > 0 && (
            <><div className="section-label" style={{ marginTop: 16 }}>Error Codes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selDevice.errors.map((e, i) => <div key={i} className="error-chip">⚠ {e}</div>)}
            </div></>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={() => { deleteDevice(selDevice); }}>🗑 Delete Device</button>
          <button className="btn btn-secondary" onClick={() => setDevDetailOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );

  const InstallerModal = () => selCustInst && generatedPkg && (
    <div className="modal-backdrop" onClick={() => setInstallerOpen(false)}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Collector — {selCustInst.name}</h2>
          <button className="modal-close" onClick={() => setInstallerOpen(false)}>✕</button>
        </div>
        <div className="modal-body">

          {/* ONE-CLICK INSTALLER */}
          <div className="installer-highlight">
            <div className="installer-highlight-icon">🪟</div>
            <div>
              <div className="installer-highlight-title">One-click Windows Installer</div>
              <div className="installer-highlight-sub">
                Downloads a <code>.bat</code> file. Run it on the client's PC — Python, the collector script,
                the config, and the EXE are all set up automatically.
              </div>
            </div>
            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={downloadWindowsInstaller}>
              ⬇ Download Setup.bat
            </button>
          </div>

          {/* PACKAGE DETAILS */}
          <div className="detail-grid" style={{ marginTop: 16 }}>
            <div className="detail-item"><label>Customer</label><div className="val">{selCustInst.name} ({selCustInst.id})</div></div>
            <div className="detail-item"><label>API URL</label><div className="val cell-mono" style={{ fontSize: 12 }}>{instForm.apiUrl}</div></div>
            <div className="detail-item"><label>Interval</label><div className="val">{instForm.collectionInterval}s</div></div>
            <div className="detail-item"><label>Expires</label><div className="val">{generatedPkg.expiresIn || '7 days'}</div></div>
          </div>

          {/* MANUAL STEPS */}
          <div className="section-label" style={{ marginTop: 16 }}>What the installer does (automatically)</div>
          <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2.2, paddingLeft: 20 }}>
            <li>Checks Python 3 is installed on the client PC</li>
            <li>Downloads the latest collector script from your server</li>
            <li>Writes a pre-filled <strong>fleetsync_config.json</strong> with this customer's API key</li>
            <li>Installs Python packages (<code>pysnmp requests schedule pyinstaller</code>)</li>
            <li>Builds <strong>FleetSync_Collector.exe</strong> — no Python needed after this</li>
          </ol>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            After setup: open <code>C:\FleetSync\{selCustInst.id}
leetsync_config.json</code> and add copier IP addresses under <code>devices</code>, then double-click the EXE.
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>Individual files (manual setup)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={downloadCollectorPy}>⬇ fleetsync_collector.py</button>
            <button className="btn btn-secondary btn-sm" onClick={downloadConfigJson}>⬇ fleetsync_config.json</button>
            <button className="btn btn-secondary btn-sm" onClick={downloadBuildBat}>⬇ build_exe.bat</button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setInstallerOpen(false)}>Close</button>
          <button className="btn btn-primary" onClick={downloadWindowsInstaller}>⬇ Download Windows Installer</button>
        </div>
      </div>
    </div>
  );

  const AlertDetailModal = () => selAlert && (
    <div className="modal-backdrop" onClick={() => setAlertDetailOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Alert Details</h2><button className="modal-close" onClick={() => setAlertDetailOpen(false)}>✕</button></div>
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item"><label>Device</label><div className="val">{selAlert.device}</div></div>
            <div className="detail-item"><label>Severity</label><div className="val" style={{ color: severityColor[selAlert.severity], fontWeight: 700, textTransform: 'capitalize' }}>{selAlert.severity}</div></div>
            <div className="detail-item"><label>Error Code</label><div className="val" style={{ fontFamily: 'var(--font-mono)' }}>{selAlert.code}</div></div>
            <div className="detail-item"><label>Time</label><div className="val">{fmtTime(selAlert.ts)}</div></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="form-label" style={{ marginBottom: 6 }}>Message</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{selAlert.message}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setAlertDetailOpen(false)}>Close</button>
          {!selAlert.ack && <button className="btn btn-primary" onClick={() => { ackAlert(selAlert.id); setAlertDetailOpen(false); }}>✓ Acknowledge</button>}
        </div>
      </div>
    </div>
  );

  /* ================================================================
     RENDER
     ================================================================ */
  const navItems = [
    { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { id: 'devices',     icon: '🖨️', label: 'Devices' },
    { id: 'consumables', icon: '🎨', label: 'Consumables' },
    { id: 'alerts',      icon: '⚠️', label: 'Alerts', badge: activeAlerts.length },
    { id: 'customers',   icon: '👥', label: 'Customers' },
    { id: 'download',    icon: '📥', label: 'Download EXE' },
  ];

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className={`app ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo"><span>📊</span> FleetSync Pro</div>
        <div className="sidebar-content">
          <div className="nav-group-label">Main Navigation</div>
          {navItems.map(n => (
            <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
              {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="nav-group-label">Account</div>
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><span className="nav-icon">⚙️</span> Settings</button>
          <button className={`nav-item ${view === 'profile'  ? 'active' : ''}`} onClick={() => setView('profile')} ><span className="nav-icon">👤</span> Profile</button>
        </div>
      </aside>

      {/* HEADER — no customer selector, IT Manager sees everything */}
      <header className="header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="brand"><span className="brand-icon">📊</span> FleetSync Pro</div>
        </div>
        <div className="header-center">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            IT Manager · {devices.length} devices · {customers.length} customers
          </span>
        </div>
        <div className="header-right">
          <button className="hdr-btn" title="Notifications" onClick={() => setView('alerts')}>
            🔔{activeAlerts.length > 0 && <span className="badge">{activeAlerts.length}</span>}
          </button>
          <button className="hdr-btn" title="Download Installer" onClick={() => setView('download')}>📥</button>
          <button className="hdr-btn" title="Add Customer" onClick={() => setAddCustOpen(true)}>➕</button>
          <button className="avatar-btn" title="Logout" onClick={logout}>{user.email[0].toUpperCase()}</button>
        </div>
      </header>

      {/* MAIN */}
      <main className="main">
        {loading && <div className="loading-bar">⟳ Refreshing data…</div>}
        {error   && <div className="error-banner">⚠️ {error}</div>}
        {view === 'dashboard'   && <DashboardView />}
        {view === 'devices'     && <DevicesView />}
        {view === 'consumables' && <ConsumablesView />}
        {view === 'alerts'      && <AlertsView />}
        {view === 'customers'   && <CustomersView />}
        {view === 'download'    && <DownloadView />}
        {view === 'settings'    && <SettingsView />}
        {view === 'profile'     && <ProfileView />}
      </main>

      {/* MODALS */}
      {addCustOpen     && renderAddCustomerModal()}
      {addDevOpen      && renderAddDeviceModal()}
      {devDetailOpen   && <DeviceDetailModal />}
      {installerOpen   && <InstallerModal />}
      {alertDetailOpen && <AlertDetailModal />}
    </div>
  );
}
