import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

/* ============================================================
   HELPERS
   ============================================================ */
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const fmt = (n) => (n ?? 0).toLocaleString();
const fmtM = (n) => ((n ?? 0) / 1_000_000).toFixed(2) + 'M';
const fmtTime = (iso) => new Date(iso).toLocaleString();
const fmtAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const tonerColor = {
  Black: '#94a3b8',
  Cyan: '#22d3ee',
  Magenta: '#f472b6',
  Yellow: '#facc15',
};

const severityColor = { critical: '#ef4444', high: '#f59e0b', medium: '#eab308' };

/* api helper – never throws, returns null on failure */
async function apiFetch(path, opts = {}) {
  try {
    const r = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ============================================================
   SEED DATA (used when API is offline / first load)
   ============================================================ */
const SEED_CUSTOMERS = [
  { id: 'cust-001', name: 'Acme Corporation',   email: 'admin@acme.com',   phone: '(555) 123-4567', address: '123 Business Ave', city: 'New York',       state: 'NY', zip: '10001', deviceCount: 4, alertCount: 2 },
  { id: 'cust-002', name: 'Global Services Inc', email: 'info@global.com',  phone: '(555) 234-5678', address: '456 Commerce St',  city: 'Los Angeles',    state: 'CA', zip: '90001', deviceCount: 3, alertCount: 1 },
  { id: 'cust-003', name: 'Tech Solutions Ltd',  email: 'ops@techsol.com',  phone: '(555) 345-6789', address: '789 Innovation Blvd', city: 'San Francisco', state: 'CA', zip: '94105', deviceCount: 5, alertCount: 0 },
];

const SEED_DEVICES = [
  { id: 'dev-001', name: 'Main Lobby Copier',   model: 'Xerox VersaLink C7030',       ip: '192.168.1.50', location: 'Lobby',   serial: 'XRX-2024-001', community: 'public', status: 'online',  pageCount: 1_245_320, bwPages: 980_000, colorPages: 265_320, tonerK: 78, tonerC: 65, tonerM: 52, tonerY: 88, drumK: 92, drumC: 85, drumM: 78, drumY: 95, fuser: 88, temp: 52, errors: [] },
  { id: 'dev-002', name: 'Finance Dept.',        model: 'Canon imageRUNNER 2745',       ip: '192.168.1.51', location: 'Floor 2', serial: 'CAN-2024-002', community: 'public', status: 'online',  pageCount:   892_450, bwPages: 750_000, colorPages: 142_450, tonerK: 34, tonerC: 45, tonerM: 56, tonerY: 23, drumK: 45, drumC: 52, drumM: 48, drumY: 41, fuser: 67, temp: 54, errors: ['W-202: Yellow Toner Low'] },
  { id: 'dev-003', name: 'Operations Floor 3',  model: 'Ricoh MP C3004',               ip: '192.168.1.52', location: 'Floor 3', serial: 'RIC-2024-003', community: 'public', status: 'online',  pageCount:   756_200, bwPages: 620_000, colorPages: 136_200, tonerK: 92, tonerC: 78, tonerM: 65, tonerY: 34, drumK: 78, drumC: 72, drumM: 68, drumY: 55, fuser: 92, temp: 49, errors: [] },
  { id: 'dev-004', name: 'HR Department',        model: 'Konica Minolta bizhub C554',   ip: '192.168.1.53', location: 'Floor 1', serial: 'KON-2024-004', community: 'public', status: 'offline', pageCount:   523_100, bwPages: 420_000, colorPages: 103_100, tonerK: 18, tonerC: 28, tonerM: 35, tonerY: 12, drumK: 32, drumC: 38, drumM: 42, drumY: 28, fuser: 45, temp:  0, errors: ['E-101: Device Offline', 'E-104: Network Timeout'] },
];

const SEED_ALERTS = [
  { id: 'al-001', device: 'Finance Dept.',      deviceId: 'dev-002', severity: 'high',     type: 'toner',       title: 'Yellow Toner Low',      message: 'Yellow toner cartridge below 25%. Order supplies.',        code: 'W-202', ts: new Date(Date.now() - 5   * 60000).toISOString(), ack: false },
  { id: 'al-002', device: 'HR Department',      deviceId: 'dev-004', severity: 'critical', type: 'offline',     title: 'Device Offline',        message: 'Device offline for 20 minutes. Check network connection.', code: 'E-101', ts: new Date(Date.now() - 20  * 60000).toISOString(), ack: false },
  { id: 'al-003', device: 'HR Department',      deviceId: 'dev-004', severity: 'critical', type: 'toner',       title: 'Black Toner Critical',  message: 'Black toner critically low (18%). Replace immediately.',   code: 'W-101', ts: new Date(Date.now() - 25  * 60000).toISOString(), ack: false },
  { id: 'al-004', device: 'Operations Floor 3', deviceId: 'dev-003', severity: 'medium',   type: 'maintenance', title: 'Drum Maintenance Soon',  message: 'Yellow drum approaching replacement threshold (34%).',      code: 'W-301', ts: new Date(Date.now() - 1   * 3600000).toISOString(), ack: false },
];

/* ============================================================
   TONER BAR COMPONENT
   ============================================================ */
function TonerBar({ label, value, color }) {
  const low  = value <= 20;
  const crit = value <= 10;
  return (
    <div className="toner-row">
      <span className="toner-label" style={{ color: color === '#94a3b8' ? '#94a3b8' : color }}>{label[0]}</span>
      <div className="toner-track">
        <div
          className={`toner-fill${crit ? ' crit' : low ? ' low' : ''}`}
          style={{ width: `${value}%`, background: crit ? '#ef4444' : low ? '#f59e0b' : color }}
        />
      </div>
      <span className="toner-pct" style={{ color: crit ? '#ef4444' : low ? '#f59e0b' : undefined }}>
        {value}%
      </span>
    </div>
  );
}

/* ============================================================
   PROGRESS BAR COMPONENT
   ============================================================ */
function BarFill({ value, color }) {
  const low  = value <= 20;
  const crit = value <= 10;
  return (
    <div className="bar-track">
      <div
        className="bar-fill"
        style={{
          width: `${value}%`,
          background: crit ? '#ef4444' : low ? '#f59e0b' : color || 'var(--accent)',
        }}
      />
    </div>
  );
}

/* ============================================================
   STATUS PILL COMPONENT
   ============================================================ */
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
  /* -- navigation -- */
  const [view, setView]               = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* -- data -- */
  const [customers, setCustomers]     = useState(SEED_CUSTOMERS);
  const [devices, setDevices]         = useState(SEED_DEVICES);
  const [alerts, setAlerts]           = useState(SEED_ALERTS);
  const [currentCust, setCurrentCust] = useState('cust-001');

  /* -- ui -- */
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  /* -- modals -- */
  const [addCustOpen,    setAddCustOpen]    = useState(false);
  const [addDevOpen,     setAddDevOpen]     = useState(false);
  const [devDetailOpen,  setDevDetailOpen]  = useState(false);
  const [installerOpen,  setInstallerOpen]  = useState(false);
  const [alertDetailOpen,setAlertDetailOpen]= useState(false);

  /* -- selected -- */
  const [selDevice,   setSelDevice]   = useState(null);
  const [selAlert,    setSelAlert]    = useState(null);
  const [selCustInst, setSelCustInst] = useState(null);
  const [generatedPkg,setGeneratedPkg]= useState(null);

  /* -- forms -- */
  const [custForm, setCustForm] = useState({
    customerId: '', customerName: '', contactEmail: '',
    contactPhone: '', address: '', city: '', state: '', zip: '',
  });
  const [devForm, setDevForm] = useState({
    name: '', model: '', ip: '', location: '',
    serial: '', community: 'public',
  });
  const [instForm, setInstForm] = useState({
    apiUrl: 'http://localhost:5000',
    collectionInterval: '300',
  });

  /* ---- derived data ---- */
  const custData       = customers.find(c => c.id === currentCust) || customers[0];
  const filteredDev    = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.model.toLowerCase().includes(search.toLowerCase()) ||
    d.ip.toLowerCase().includes(search.toLowerCase())
  );
  const activeAlerts   = alerts.filter(a => !a.ack);
  const onlineCount    = devices.filter(d => d.status === 'online').length;
  const offlineCount   = devices.filter(d => d.status === 'offline').length;
  const totalPages     = devices.reduce((s, d) => s + d.pageCount, 0);
  const avgTonerK      = Math.round(devices.reduce((s, d) => s + d.tonerK, 0) / (devices.length || 1));

  /* ---- fetch from API (non-blocking – seeds stay if API down) ---- */
  const refreshData = useCallback(async () => {
    setLoading(true);
    const [devRes, alertRes] = await Promise.all([
      apiFetch(`/devices?customerId=${currentCust}`),
      apiFetch(`/alerts?customerId=${currentCust}&acknowledged=false`),
    ]);
    if (devRes && devRes.length > 0)   setDevices(devRes);
    if (alertRes && alertRes.length > 0) setAlerts(alertRes);
    setLoading(false);
  }, [currentCust]);

  useEffect(() => {
    refreshData();
    const t = setInterval(refreshData, 30_000);
    return () => clearInterval(t);
  }, [refreshData]);

  /* ---- handlers ---- */
  const ackAlert = async (id) => {
    await apiFetch(`/alerts/${id}/acknowledge`, { method: 'PUT', body: JSON.stringify({ acknowledgedBy: 'Admin' }) });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ack: true } : a));
  };

  const submitNewCustomer = async () => {
    if (!custForm.customerId || !custForm.customerName) { setError('Customer ID and Name are required.'); return; }
    const res = await apiFetch('/customers', { method: 'POST', body: JSON.stringify(custForm) });
    const newC = {
      id: custForm.customerId, name: custForm.customerName,
      email: custForm.contactEmail, phone: custForm.contactPhone,
      address: custForm.address, city: custForm.city,
      state: custForm.state, zip: custForm.zip,
      deviceCount: 0, alertCount: 0,
    };
    setCustomers(prev => [...prev, newC]);
    setAddCustOpen(false);
    setCustForm({ customerId: '', customerName: '', contactEmail: '', contactPhone: '', address: '', city: '', state: '', zip: '' });
    setError('');
  };

  const submitNewDevice = async () => {
    if (!devForm.name || !devForm.ip) { setError('Name and IP are required.'); return; }
    const payload = {
      deviceId: `dev-${Date.now()}`, customerId: currentCust,
      name: devForm.name, model: devForm.model, ipAddress: devForm.ip,
      location: devForm.location, serialNumber: devForm.serial,
      snmpCommunity: devForm.community,
    };
    await apiFetch('/devices', { method: 'POST', body: JSON.stringify(payload) });
    const newD = {
      id: payload.deviceId, name: devForm.name, model: devForm.model,
      ip: devForm.ip, location: devForm.location, serial: devForm.serial,
      community: devForm.community, status: 'online',
      pageCount: 0, bwPages: 0, colorPages: 0,
      tonerK: 100, tonerC: 100, tonerM: 100, tonerY: 100,
      drumK: 100, drumC: 100, drumM: 100, drumY: 100,
      fuser: 100, temp: 0, errors: [],
    };
    setDevices(prev => [...prev, newD]);
    setAddDevOpen(false);
    setDevForm({ name: '', model: '', ip: '', location: '', serial: '', community: 'public' });
    setError('');
  };

  const generateInstaller = async (cust) => {
    setSelCustInst(cust);
    const res = await apiFetch('/installer/create', {
      method: 'POST',
      body: JSON.stringify({ customerId: cust.id, apiUrl: instForm.apiUrl }),
    });
    setGeneratedPkg(res || {
      packageId: `pkg-${Date.now()}`,
      packageName: `FleetSync-${cust.id}-${Date.now()}`,
      downloadUrl: `/api/installer/download/demo`,
      expiresIn: '7 days',
      configContent: {
        customerId: cust.id,
        customerName: cust.name,
        apiUrl: instForm.apiUrl,
        collectionInterval: Number(instForm.collectionInterval),
        apiKey: 'auto-generated-on-server',
        createdAt: new Date().toISOString(),
      },
    });
    setInstallerOpen(true);
  };

  const downloadInstaller = () => {
    if (!generatedPkg) return;
    const url = `${API}${generatedPkg.downloadUrl}`;
    window.open(url, '_blank');
  };

  /* ================================================================
     VIEWS
     ================================================================ */

  /* ---- DASHBOARD ---- */
  const DashboardView = () => (
    <>
      {/* KPI row */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-green">
          <div className="kpi-top">
            <div className="kpi-icon">🖨️</div>
            <span className="kpi-trend up">▲ Live</span>
          </div>
          <div className="kpi-value">{onlineCount}</div>
          <div className="kpi-label">Online Devices</div>
        </div>
        <div className="kpi-card kpi-red">
          <div className="kpi-top">
            <div className="kpi-icon">⛔</div>
            <span className="kpi-trend down">▼ Check</span>
          </div>
          <div className="kpi-value">{offlineCount}</div>
          <div className="kpi-label">Offline Devices</div>
        </div>
        <div className="kpi-card kpi-orange">
          <div className="kpi-top">
            <div className="kpi-icon">⚠️</div>
            <span className="kpi-trend down">{activeAlerts.length} open</span>
          </div>
          <div className="kpi-value">{activeAlerts.length}</div>
          <div className="kpi-label">Active Alerts</div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-top">
            <div className="kpi-icon">📄</div>
            <span className="kpi-trend flat">Total</span>
          </div>
          <div className="kpi-value">{fmtM(totalPages)}</div>
          <div className="kpi-label">Pages Printed</div>
        </div>
        <div className="kpi-card kpi-purple">
          <div className="kpi-top">
            <div className="kpi-icon">🎨</div>
            <span className={`kpi-trend ${avgTonerK < 30 ? 'down' : 'up'}`}>{avgTonerK < 30 ? '▼ Low' : '▲ OK'}</span>
          </div>
          <div className="kpi-value">{avgTonerK}%</div>
          <div className="kpi-label">Avg. Black Toner</div>
        </div>
        <div className="kpi-card kpi-cyan">
          <div className="kpi-top">
            <div className="kpi-icon">👥</div>
            <span className="kpi-trend flat">Managed</span>
          </div>
          <div className="kpi-value">{customers.length}</div>
          <div className="kpi-label">Customers</div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🖨️ Devices Overview</span>
          <div className="card-controls">
            <input
              className="search-box"
              placeholder="Search devices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={refreshData}>↺ Refresh</button>
            <button className="btn btn-primary" onClick={() => setAddDevOpen(true)}>+ Add Device</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>IP Address</th>
                <th>Location</th>
                <th>Status</th>
                <th>Total Pages</th>
                <th>Toner KCMY</th>
                <th>Drum / Fuser</th>
                <th>Temp</th>
                <th>Last Seen</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDev.map(d => (
                <tr key={d.id}>
                  <td>
                    <div className="cell-strong">{d.name}</div>
                    <div className="cell-mono">{d.model}</div>
                  </td>
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
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div>Drum K: <strong>{d.drumK}%</strong></div>
                      <div>Fuser:  <strong>{d.fuser}%</strong></div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: d.temp > 70 ? '#ef4444' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {d.temp > 0 ? `${d.temp}°C` : '—'}
                    </span>
                  </td>
                  <td><span className="alert-time">{fmtAgo(d.lastUpdate || new Date().toISOString())}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setSelDevice(d); setDevDetailOpen(true); }}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDev.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state"><span className="empty-icon">🖨️</span><h3>No devices found</h3></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">⚠️ Active Alerts & Error Codes</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeAlerts.length} unacknowledged</span>
        </div>
        <div className="alerts-list">
          {activeAlerts.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">✅</span>
              <h3>No active alerts</h3>
              <p>All devices are running normally.</p>
            </div>
          )}
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
                <button className="btn btn-sm btn-primary"    onClick={() => ackAlert(a.id)}>✓ Ack</button>
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
        <div className="page-header-left">
          <h1>🖨️ Device Management</h1>
          <p>All connected MFPs and printers across the network</p>
        </div>
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
              <div className="meter-item">
                <div className="meter-label">Total Pages</div>
                <div className="meter-value">{fmtM(d.pageCount)}</div>
                <div className="meter-sub">million</div>
              </div>
              <div className="meter-item">
                <div className="meter-label">B&W / Color</div>
                <div className="meter-value">{fmtM(d.bwPages)}</div>
                <div className="meter-sub">{fmtM(d.colorPages)} color</div>
              </div>
              <div className="meter-item">
                <div className="meter-label">Temperature</div>
                <div className="meter-value" style={{ color: d.temp > 70 ? '#ef4444' : 'inherit' }}>
                  {d.temp > 0 ? `${d.temp}°C` : '—'}
                </div>
              </div>
              <div className="meter-item">
                <div className="meter-label">Fuser Unit</div>
                <div className="meter-value">{d.fuser}%</div>
              </div>
            </div>

            <div className="toner-bars">
              {Object.entries({ Black: d.tonerK, Cyan: d.tonerC, Magenta: d.tonerM, Yellow: d.tonerY }).map(([k, v]) => (
                <TonerBar key={k} label={k} value={v} color={tonerColor[k]} />
              ))}
            </div>

            {d.errors.length > 0 && (
              <div className="device-card-errors">
                {d.errors.map((e, i) => <div key={i} className="error-chip">⚠ {e}</div>)}
              </div>
            )}

            <div className="device-card-footer">
              <span className="device-last-seen">Last seen {fmtAgo(d.lastUpdate || new Date().toISOString())}</span>
              <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); setSelDevice(d); setDevDetailOpen(true); }}>Details →</button>
            </div>
          </div>
        ))}
        {filteredDev.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <span className="empty-icon">🔍</span>
            <h3>No devices match</h3>
            <p>Try a different search term</p>
          </div>
        )}
      </div>
    </>
  );

  /* ---- CONSUMABLES ---- */
  const ConsumablesView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>🎨 Consumables & Supplies</h1>
          <p>Toner levels, drum yields and fuser health across all devices</p>
        </div>
      </div>
      <div className="consumables-grid">
        {devices.map(d => (
          <div key={d.id} className="consumable-card">
            <div>
              <div className="consumable-card-title">{d.name}</div>
              <div className="consumable-card-model">{d.model} — <StatusPill status={d.status} /></div>
            </div>
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
                    <span className="consumable-row-value" style={{ color: row.val <= 10 ? '#ef4444' : row.val <= 20 ? '#f59e0b' : 'var(--text-primary)' }}>
                      {row.val}%
                    </span>
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

  /* ---- ALERTS VIEW ---- */
  const AlertsView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>⚠️ Alerts & Error Codes</h1>
          <p>{activeAlerts.length} active alerts require attention</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setAlerts(prev => prev.map(a => ({ ...a, ack: true })))}>
            ✓ Acknowledge All
          </button>
        </div>
      </div>
      <div className="card">
        <div className="alerts-list">
          {alerts.length === 0 && (
            <div className="empty-state"><span className="empty-icon">✅</span><h3>No alerts</h3><p>All systems nominal.</p></div>
          )}
          {alerts.map(a => (
            <div key={a.id} className="alert-row" style={{ opacity: a.ack ? 0.45 : 1 }}>
              <div className={`alert-dot ${a.ack ? 'online' : a.severity}`} />
              <div className="alert-body">
                <div className="alert-title">{a.title} {a.ack && <span style={{ fontSize: 11, color: 'var(--accent-green)', marginLeft: 6 }}>✓ Acknowledged</span>}</div>
                <div className="alert-meta">
                  <span>🖨️ {a.device}</span>
                  {a.code && <span className="alert-code">{a.code}</span>}
                  <span className="alert-time">{fmtTime(a.ts)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.message}</div>
              </div>
              {!a.ack && (
                <button className="btn btn-sm btn-primary" onClick={() => ackAlert(a.id)}>✓ Ack</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ---- CUSTOMERS VIEW ---- */
  const CustomersView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>👥 Customer Management</h1>
          <p>{customers.length} managed customers</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setAddCustOpen(true)}>+ Add Customer</button>
        </div>
      </div>
      <div className="customers-grid">
        {customers.map(c => (
          <div key={c.id} className="customer-card">
            <div className="customer-card-top">
              <div className="customer-logo">
                {c.name.charAt(0)}
              </div>
              <div>
                <div className="customer-card-name">{c.name}</div>
                <div className="customer-card-id">{c.id}</div>
              </div>
            </div>
            <div className="customer-card-details">
              <div className="cust-detail"><span className="cust-detail-icon">📧</span>{c.email}</div>
              <div className="cust-detail"><span className="cust-detail-icon">📞</span>{c.phone}</div>
              <div className="cust-detail"><span className="cust-detail-icon">📍</span>{c.city}, {c.state} {c.zip}</div>
            </div>
            <div className="customer-stats">
              <div className="cust-stat">
                <div className="cust-stat-value">{c.deviceCount}</div>
                <div className="cust-stat-label">Devices</div>
              </div>
              <div className="cust-stat">
                <div className="cust-stat-value" style={{ color: c.alertCount > 0 ? '#f59e0b' : 'var(--accent-green)' }}>{c.alertCount}</div>
                <div className="cust-stat-label">Alerts</div>
              </div>
            </div>
            <div className="customer-card-actions">
              <button className="btn btn-secondary" onClick={() => { setCurrentCust(c.id); setView('dashboard'); }}>View Dashboard</button>
              <button className="btn btn-primary"   onClick={() => generateInstaller(c)}>📥 Installer</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  /* ---- DOWNLOAD VIEW ---- */
  const DownloadView = () => (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>📥 Client Installer</h1>
          <p>Generate and download a customized installer EXE for each customer</p>
        </div>
      </div>

      <div className="installer-banner">
        <div className="installer-icon">💾</div>
        <div className="installer-text">
          <h2>FleetSync Client Collector EXE</h2>
          <p>Each installer is pre-configured with your customer's credentials and API endpoint. The client runs it on Windows as Administrator. The wizard scans the local network for MFPs, collects all metrics, and sends data to your cloud dashboard automatically every 5 minutes.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">⚙️ Installer Configuration</span>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Your API Server URL</label>
              <input className="form-input" placeholder="https://fleetsync-api.azurewebsites.net" value={instForm.apiUrl} onChange={e => setInstForm({ ...instForm, apiUrl: e.target.value })} />
              <div className="form-hint">This is where the client EXE will send data. Use your Azure/cloud URL in production.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Collection Interval (seconds)</label>
              <input className="form-input" type="number" min="60" max="3600" value={instForm.collectionInterval} onChange={e => setInstForm({ ...instForm, collectionInterval: e.target.value })} />
              <div className="form-hint">How often the collector polls devices. 300 = every 5 minutes.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">👥 Select Customer & Generate Installer</span>
        </div>
        <div className="customers-grid" style={{ padding: 20 }}>
          {customers.map(c => (
            <div key={c.id} className="customer-card">
              <div className="customer-card-top">
                <div className="customer-logo">{c.name.charAt(0)}</div>
                <div>
                  <div className="customer-card-name">{c.name}</div>
                  <div className="customer-card-id">{c.id}</div>
                </div>
              </div>
              <div className="customer-card-details">
                <div className="cust-detail"><span className="cust-detail-icon">📧</span>{c.email}</div>
                <div className="cust-detail"><span className="cust-detail-icon">📍</span>{c.city}, {c.state}</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => generateInstaller(c)}>
                📥 Generate & Download EXE
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ================================================================
     MODALS
     ================================================================ */

  const AddCustomerModal = () => (
    <div className="modal-backdrop" onClick={() => setAddCustOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Customer</h2>
          <button className="modal-close" onClick={() => setAddCustOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-banner">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Customer ID *</label>
              <input className="form-input" placeholder="CUST-001" value={custForm.customerId} onChange={e => setCustForm({ ...custForm, customerId: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input className="form-input" placeholder="Acme Corporation" value={custForm.customerName} onChange={e => setCustForm({ ...custForm, customerName: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input className="form-input" type="email" placeholder="admin@company.com" value={custForm.contactEmail} onChange={e => setCustForm({ ...custForm, contactEmail: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input className="form-input" placeholder="(555) 123-4567" value={custForm.contactPhone} onChange={e => setCustForm({ ...custForm, contactPhone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Street Address</label>
            <input className="form-input" placeholder="123 Business Ave" value={custForm.address} onChange={e => setCustForm({ ...custForm, address: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={custForm.city} onChange={e => setCustForm({ ...custForm, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input className="form-input" placeholder="NY" value={custForm.state} onChange={e => setCustForm({ ...custForm, state: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP Code</label>
              <input className="form-input" value={custForm.zip} onChange={e => setCustForm({ ...custForm, zip: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setAddCustOpen(false); setError(''); }}>Cancel</button>
          <button className="btn btn-primary"   onClick={submitNewCustomer}>Create Customer</button>
        </div>
      </div>
    </div>
  );

  const AddDeviceModal = () => (
    <div className="modal-backdrop" onClick={() => setAddDevOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Device / MFP</h2>
          <button className="modal-close" onClick={() => setAddDevOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-banner">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">Device Name *</label>
            <input className="form-input" placeholder="Main Lobby Copier" value={devForm.name} onChange={e => setDevForm({ ...devForm, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Model</label>
              <input className="form-input" placeholder="Xerox VersaLink C7030" value={devForm.model} onChange={e => setDevForm({ ...devForm, model: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">IP Address *</label>
              <input className="form-input" placeholder="192.168.1.100" value={devForm.ip} onChange={e => setDevForm({ ...devForm, ip: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" placeholder="Floor 2, East Wing" value={devForm.location} onChange={e => setDevForm({ ...devForm, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Serial Number</label>
              <input className="form-input" placeholder="XRX-2024-001" value={devForm.serial} onChange={e => setDevForm({ ...devForm, serial: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">SNMP Community String</label>
            <input className="form-input" placeholder="public" value={devForm.community} onChange={e => setDevForm({ ...devForm, community: e.target.value })} />
            <div className="form-hint">Usually "public". Check your MFP's SNMP settings.</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { setAddDevOpen(false); setError(''); }}>Cancel</button>
          <button className="btn btn-primary"   onClick={submitNewDevice}>Add Device</button>
        </div>
      </div>
    </div>
  );

  const DeviceDetailModal = () => selDevice && (
    <div className="modal-backdrop" onClick={() => setDevDetailOpen(false)}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🖨️ {selDevice.name}</h2>
          <button className="modal-close" onClick={() => setDevDetailOpen(false)}>✕</button>
        </div>
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
            <div className="detail-item"><label>Color Pages</label><div className="val">{fmt(selDevice.colorPages)}</div></div>
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>Toner Levels</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries({ Black: selDevice.tonerK, Cyan: selDevice.tonerC, Magenta: selDevice.tonerM, Yellow: selDevice.tonerY }).map(([k, v]) => (
              <TonerBar key={k} label={k} value={v} color={tonerColor[k]} />
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>Consumables Health</div>
          <div className="detail-grid">
            {[
              ['Drum — Black',   selDevice.drumK],
              ['Drum — Cyan',    selDevice.drumC],
              ['Drum — Magenta', selDevice.drumM],
              ['Drum — Yellow',  selDevice.drumY],
              ['Fuser Unit',     selDevice.fuser],
            ].map(([lbl, val]) => (
              <div className="detail-item" key={lbl}>
                <label>{lbl}</label>
                <div className="val" style={{ color: val <= 10 ? '#ef4444' : val <= 20 ? '#f59e0b' : 'inherit' }}>{val}%</div>
                <BarFill value={val} color={val <= 10 ? '#ef4444' : val <= 20 ? '#f59e0b' : 'var(--accent-green)'} />
              </div>
            ))}
          </div>

          {selDevice.errors.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 16 }}>Error Codes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selDevice.errors.map((e, i) => <div key={i} className="error-chip">⚠ {e}</div>)}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setDevDetailOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );

  const InstallerModal = () => selCustInst && generatedPkg && (
    <div className="modal-backdrop" onClick={() => setInstallerOpen(false)}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Installer for {selCustInst.name}</h2>
          <button className="modal-close" onClick={() => setInstallerOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          <div className="installer-banner" style={{ marginBottom: 0 }}>
            <div className="installer-icon">💾</div>
            <div className="installer-text">
              <h2>FleetSync-{selCustInst.id}.exe</h2>
              <p>Custom installer pre-configured for <strong>{selCustInst.name}</strong>. Send this EXE to the client. They run it as Administrator on any Windows PC on their network.</p>
            </div>
          </div>

          <div className="detail-grid" style={{ marginTop: 16 }}>
            <div className="detail-item"><label>Package ID</label><div className="val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{generatedPkg.packageId}</div></div>
            <div className="detail-item"><label>Expires</label><div className="val">{generatedPkg.expiresIn}</div></div>
            <div className="detail-item"><label>API Endpoint</label><div className="val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{instForm.apiUrl}</div></div>
            <div className="detail-item"><label>Collection Interval</label><div className="val">{instForm.collectionInterval}s ({Math.round(Number(instForm.collectionInterval)/60)} min)</div></div>
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>Embedded Client Configuration</div>
          <div className="installer-config">{JSON.stringify(generatedPkg.configContent, null, 2)}</div>

          <div className="section-label" style={{ marginTop: 16 }}>Installation Steps for Client</div>
          <ol style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20 }}>
            <li>Download the EXE using the button below</li>
            <li>Send to client via email, WhatsApp, or USB drive</li>
            <li>Client right-clicks the file → <strong>Run as Administrator</strong></li>
            <li>Wizard auto-fills company name & API settings</li>
            <li>Client enters IP addresses of each copier/MFP</li>
            <li>Collector starts and scans every {instForm.collectionInterval}s</li>
            <li>Data appears on your dashboard within minutes</li>
          </ol>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setInstallerOpen(false)}>Close</button>
          <button className="btn btn-primary"   onClick={downloadInstaller}>⬇️ Download EXE</button>
        </div>
      </div>
    </div>
  );

  const AlertDetailModal = () => selAlert && (
    <div className="modal-backdrop" onClick={() => setAlertDetailOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Alert Details</h2>
          <button className="modal-close" onClick={() => setAlertDetailOpen(false)}>✕</button>
        </div>
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
    { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
    { id: 'devices',      icon: '🖨️', label: 'Devices' },
    { id: 'consumables',  icon: '🎨', label: 'Consumables' },
    { id: 'alerts',       icon: '⚠️', label: 'Alerts',  badge: activeAlerts.length },
    { id: 'customers',    icon: '👥', label: 'Customers' },
    { id: 'download',     icon: '📥', label: 'Download EXE' },
  ];

  return (
    <div className={`app ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      {/* ---- SIDEBAR ---- */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>📊</span> FleetSync Pro
        </div>
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
          <button className="nav-item" onClick={() => alert('Settings coming soon')}>
            <span className="nav-icon">⚙️</span> Settings
          </button>
          <button className="nav-item" onClick={() => alert('Profile coming soon')}>
            <span className="nav-icon">👤</span> Profile
          </button>
        </div>
      </aside>

      {/* ---- HEADER ---- */}
      <header className="header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="brand"><span className="brand-icon">📊</span> FleetSync Pro</div>
        </div>

        <div className="header-center">
          <div className="customer-select-wrap">
            <span className="select-icon">🏢</span>
            <select value={currentCust} onChange={e => setCurrentCust(e.target.value)}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="select-arrow">▾</span>
          </div>
        </div>

        <div className="header-right">
          <button className="hdr-btn" title="Notifications" onClick={() => setView('alerts')}>
            🔔
            {activeAlerts.length > 0 && <span className="badge">{activeAlerts.length}</span>}
          </button>
          <button className="hdr-btn" title="Download Installer" onClick={() => setView('download')}>📥</button>
          <button className="hdr-btn" title="Add Customer"       onClick={() => setAddCustOpen(true)}>➕</button>
          <button className="avatar-btn" title="Admin">A</button>
        </div>
      </header>

      {/* ---- MAIN ---- */}
      <main className="main">
        {loading && <div className="loading-bar">⟳ Refreshing data…</div>}
        {error   && <div className="error-banner">⚠️ {error}</div>}

        {view === 'dashboard'   && <DashboardView />}
        {view === 'devices'     && <DevicesView />}
        {view === 'consumables' && <ConsumablesView />}
        {view === 'alerts'      && <AlertsView />}
        {view === 'customers'   && <CustomersView />}
        {view === 'download'    && <DownloadView />}
      </main>

      {/* ---- MODALS ---- */}
      {addCustOpen     && <AddCustomerModal />}
      {addDevOpen      && <AddDeviceModal />}
      {devDetailOpen   && <DeviceDetailModal />}
      {installerOpen   && <InstallerModal />}
      {alertDetailOpen && <AlertDetailModal />}
    </div>
  );
}