import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // State Management
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentCustomer, setCurrentCustomer] = useState('cust-001');
  const [customers, setCustomers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showDeviceDetail, setShowDeviceDetail] = useState(false);
  const [showInstallerModal, setShowInstallerModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlertDetails, setShowAlertDetails] = useState(false);

  // Selected Items
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedCustomerForInstaller, setSelectedCustomerForInstaller] = useState(null);

  // Form Data
  const [newCustomer, setNewCustomer] = useState({
    customerId: '',
    customerName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const [newDevice, setNewDevice] = useState({
    name: '',
    model: '',
    ipAddress: '',
    location: '',
    snmpCommunity: 'public',
    serialNumber: ''
  });

  const [installerSettings, setInstallerSettings] = useState({
    apiUrl: 'http://localhost:5000',
    collectionInterval: 300
  });

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Initialize Customers
  useEffect(() => {
    initializeCustomers();
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [currentCustomer]);

  const initializeCustomers = () => {
    const defaultCustomers = [
      {
        id: 'cust-001',
        name: 'Acme Corporation',
        email: 'admin@acme.com',
        phone: '(555) 123-4567',
        address: '123 Business Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        logo: '🏢',
        devices: 12,
        status: 'active'
      },
      {
        id: 'cust-002',
        name: 'Global Services Inc',
        email: 'info@global.com',
        phone: '(555) 234-5678',
        address: '456 Commerce St',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        logo: '🌍',
        devices: 8,
        status: 'active'
      },
      {
        id: 'cust-003',
        name: 'Tech Solutions Ltd',
        email: 'support@tech.com',
        phone: '(555) 345-6789',
        address: '789 Innovation Blvd',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105',
        logo: '💻',
        devices: 15,
        status: 'active'
      }
    ];
    setCustomers(defaultCustomers);
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch devices
      const devicesData = [
        {
          id: 'dev-001',
          name: 'Main Lobby Copier',
          model: 'Xerox VersaLink C7030',
          ipAddress: '192.168.1.50',
          location: 'Lobby',
          status: 'online',
          pageCount: 1245320,
          bwPages: 980000,
          colorPages: 265320,
          tonerBlack: 78,
          tonerCyan: 65,
          tonerMagenta: 52,
          tonerYellow: 88,
          drumBlack: 92,
          drumCyan: 85,
          drumMagenta: 78,
          drumYellow: 95,
          fuserUnit: 88,
          temperature: 52,
          errorCodes: [],
          lastUpdate: new Date().toISOString(),
          serialNumber: 'XRX-2024-001',
          snmpCommunity: 'public'
        },
        {
          id: 'dev-002',
          name: 'Finance Department',
          model: 'Canon imageRUNNER 2745',
          ipAddress: '192.168.1.51',
          location: 'Floor 2',
          status: 'online',
          pageCount: 892450,
          bwPages: 750000,
          colorPages: 142450,
          tonerBlack: 34,
          tonerCyan: 45,
          tonerMagenta: 56,
          tonerYellow: 23,
          drumBlack: 45,
          drumCyan: 52,
          drumMagenta: 48,
          drumYellow: 41,
          fuserUnit: 67,
          temperature: 54,
          errorCodes: ['W-202: Yellow Toner Low'],
          lastUpdate: new Date().toISOString(),
          serialNumber: 'CAN-2024-002',
          snmpCommunity: 'public'
        },
        {
          id: 'dev-003',
          name: 'Operations',
          model: 'Ricoh MP C3004',
          ipAddress: '192.168.1.52',
          location: 'Floor 3',
          status: 'online',
          pageCount: 756200,
          bwPages: 620000,
          colorPages: 136200,
          tonerBlack: 92,
          tonerCyan: 78,
          tonerMagenta: 65,
          tonerYellow: 34,
          drumBlack: 78,
          drumCyan: 72,
          drumMagenta: 68,
          drumYellow: 55,
          fuserUnit: 92,
          temperature: 49,
          errorCodes: [],
          lastUpdate: new Date().toISOString(),
          serialNumber: 'RIC-2024-003',
          snmpCommunity: 'public'
        },
        {
          id: 'dev-004',
          name: 'HR Department',
          model: 'Konica Minolta bizhub C554',
          ipAddress: '192.168.1.53',
          location: 'Floor 1',
          status: 'offline',
          pageCount: 523100,
          bwPages: 420000,
          colorPages: 103100,
          tonerBlack: 18,
          tonerCyan: 28,
          tonerMagenta: 35,
          tonerYellow: 12,
          drumBlack: 32,
          drumCyan: 38,
          drumMagenta: 42,
          drumYellow: 28,
          fuserUnit: 45,
          temperature: 0,
          errorCodes: ['E-101: Device Offline', 'E-104: Network Timeout'],
          lastUpdate: new Date(Date.now() - 20 * 60000).toISOString(),
          serialNumber: 'KON-2024-004',
          snmpCommunity: 'public'
        }
      ];

      const alertsData = [
        {
          id: 'alert-001',
          device: 'Finance Department',
          deviceId: 'dev-002',
          severity: 'high',
          type: 'toner',
          title: 'Yellow Toner Low',
          message: 'Yellow toner cartridge is below 25%. Order supplies soon.',
          errorCode: 'W-202',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          acknowledged: false
        },
        {
          id: 'alert-002',
          device: 'HR Department',
          deviceId: 'dev-004',
          severity: 'critical',
          type: 'offline',
          title: 'Device Offline',
          message: 'Device has been offline for 20 minutes. Check network connection.',
          errorCode: 'E-101',
          timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
          acknowledged: false
        },
        {
          id: 'alert-003',
          device: 'HR Department',
          deviceId: 'dev-004',
          severity: 'high',
          type: 'toner',
          title: 'Black Toner Critical',
          message: 'Black toner is critically low (18%). Replace immediately.',
          errorCode: 'W-101',
          timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
          acknowledged: false
        },
        {
          id: 'alert-004',
          device: 'Operations',
          deviceId: 'dev-003',
          severity: 'medium',
          type: 'maintenance',
          title: 'Drum Unit Maintenance',
          message: 'Yellow drum unit is approaching replacement threshold (34%).',
          errorCode: 'W-301',
          timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
          acknowledged: true
        }
      ];

      setDevices(devicesData);
      setAlerts(alertsData);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.customerId || !newCustomer.customerName) {
      setError('Please fill in required fields');
      return;
    }

    const customerToAdd = {
      id: newCustomer.customerId,
      name: newCustomer.customerName,
      email: newCustomer.contactEmail,
      phone: newCustomer.contactPhone,
      address: newCustomer.address,
      city: newCustomer.city,
      state: newCustomer.state,
      zipCode: newCustomer.zipCode,
      logo: '🏢',
      devices: 0,
      status: 'active'
    };

    setCustomers([...customers, customerToAdd]);
    setShowAddCustomer(false);
    setNewCustomer({
      customerId: '',
      customerName: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      city: '',
      state: '',
      zipCode: ''
    });
    alert('✅ Customer added successfully!');
  };

  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.ipAddress) {
      setError('Please fill in required fields');
      return;
    }

    const deviceToAdd = {
      id: `dev-${Date.now()}`,
      ...newDevice,
      status: 'online',
      pageCount: Math.floor(Math.random() * 1000000),
      bwPages: Math.floor(Math.random() * 800000),
      colorPages: Math.floor(Math.random() * 300000),
      tonerBlack: Math.floor(Math.random() * 100),
      tonerCyan: Math.floor(Math.random() * 100),
      tonerMagenta: Math.floor(Math.random() * 100),
      tonerYellow: Math.floor(Math.random() * 100),
      drumBlack: Math.floor(Math.random() * 100),
      drumCyan: Math.floor(Math.random() * 100),
      drumMagenta: Math.floor(Math.random() * 100),
      drumYellow: Math.floor(Math.random() * 100),
      fuserUnit: Math.floor(Math.random() * 100),
      temperature: Math.floor(Math.random() * 20) + 40,
      errorCodes: [],
      lastUpdate: new Date().toISOString()
    };

    setDevices([...devices, deviceToAdd]);
    setShowAddDevice(false);
    setNewDevice({
      name: '',
      model: '',
      ipAddress: '',
      location: '',
      snmpCommunity: 'public',
      serialNumber: ''
    });
    alert('✅ Device added successfully!');
  };

  const handleGenerateInstaller = async (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    try {
      const response = await fetch(`${API_BASE}/installer/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId,
          apiUrl: installerSettings.apiUrl
        })
      }).catch(() => null);

      if (response?.ok) {
        const data = await response.json();
        setSelectedCustomerForInstaller({
          ...customer,
          installerData: data
        });
      } else {
        // Simulate successful generation
        setSelectedCustomerForInstaller({
          ...customer,
          installerData: {
            packageId: `pkg-${Date.now()}`,
            packageName: `FleetSync-${customerId}-${Date.now()}`,
            downloadUrl: '/api/installer/download/test',
            expiresIn: '7 days',
            configContent: {
              customerId: customerId,
              customerName: customer.name,
              apiUrl: installerSettings.apiUrl,
              collectionInterval: installerSettings.collectionInterval
            }
          }
        });
      }
      setShowInstallerModal(true);
    } catch (err) {
      setError('Failed to generate installer: ' + err.message);
    }
  };

  const filteredDevices = devices.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.ipAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentCustomerData = customers.find(c => c.id === currentCustomer);

  // Dashboard View
  const DashboardView = () => (
    <div className="dashboard-view">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card online">
          <div className="kpi-icon">🟢</div>
          <div className="kpi-content">
            <div className="kpi-label">Online Devices</div>
            <div className="kpi-value">{devices.filter(d => d.status === 'online').length}</div>
            <div className="kpi-subtitle">of {devices.length} total</div>
          </div>
        </div>

        <div className="kpi-card offline">
          <div className="kpi-icon">🔴</div>
          <div className="kpi-content">
            <div className="kpi-label">Offline Devices</div>
            <div className="kpi-value">{devices.filter(d => d.status === 'offline').length}</div>
            <div className="kpi-subtitle">Requires attention</div>
          </div>
        </div>

        <div className="kpi-card alert">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-content">
            <div className="kpi-label">Active Alerts</div>
            <div className="kpi-value">{alerts.filter(a => !a.acknowledged).length}</div>
            <div className="kpi-subtitle">Unacknowledged</div>
          </div>
        </div>

        <div className="kpi-card pages">
          <div className="kpi-icon">📄</div>
          <div className="kpi-content">
            <div className="kpi-label">Total Pages Printed</div>
            <div className="kpi-value">{(devices.reduce((sum, d) => sum + d.pageCount, 0) / 1000000).toFixed(1)}M</div>
            <div className="kpi-subtitle">All devices combined</div>
          </div>
        </div>

        <div className="kpi-card toner">
          <div className="kpi-icon">🎨</div>
          <div className="kpi-content">
            <div className="kpi-label">Avg Toner Level</div>
            <div className="kpi-value">{Math.round(devices.reduce((sum, d) => sum + d.tonerBlack, 0) / devices.length)}%</div>
            <div className="kpi-subtitle">Black Toner Average</div>
          </div>
        </div>

        <div className="kpi-card consumption">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <div className="kpi-label">Estimated Monthly Cost</div>
            <div className="kpi-value">${(devices.length * 250).toLocaleString()}</div>
            <div className="kpi-subtitle">Supplies & maintenance</div>
          </div>
        </div>
      </div>

      {/* Devices Section */}
      <div className="section">
        <div className="section-header">
          <h2>📱 Devices & Equipment</h2>
          <div className="section-controls">
            <input
              type="text"
              placeholder="Search devices..."
              className="search-box"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn-primary" onClick={() => setShowAddDevice(true)}>+ Add Device</button>
            <button className="btn-secondary" onClick={fetchAllData}>🔄 Refresh</button>
          </div>
        </div>

        <div className="devices-grid">
          {filteredDevices.map(device => (
            <div key={device.id} className={`device-card ${device.status}`}>
              <div className="device-header">
                <span className={`status-badge ${device.status}`}>
                  {device.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                </span>
                <span className="device-last-update">{new Date(device.lastUpdate).toLocaleTimeString()}</span>
              </div>

              <h3 className="device-name">{device.name}</h3>
              <p className="device-model">{device.model}</p>
              <p className="device-location">📍 {device.location}</p>
              <p className="device-ip">🌐 {device.ipAddress}</p>

              <div className="device-metrics">
                <div className="metric-row">
                  <span>Pages Printed</span>
                  <span className="metric-value">{device.pageCount.toLocaleString()}</span>
                </div>
                <div className="metric-row">
                  <span>Temperature</span>
                  <span className="metric-value">{device.temperature}°C</span>
                </div>
              </div>

              <div className="consumables-section">
                <div className="consumable-item">
                  <span className="consumable-label">Black</span>
                  <div className="progress-bar">
                    <div className="progress" style={{ width: `${device.tonerBlack}%`, background: '#000' }}></div>
                  </div>
                  <span className="consumable-value">{device.tonerBlack}%</span>
                </div>
                <div className="consumable-item">
                  <span className="consumable-label">Cyan</span>
                  <div className="progress-bar">
                    <div className="progress" style={{ width: `${device.tonerCyan}%`, background: '#00ced1' }}></div>
                  </div>
                  <span className="consumable-value">{device.tonerCyan}%</span>
                </div>
                <div className="consumable-item">
                  <span className="consumable-label">Magenta</span>
                  <div className="progress-bar">
                    <div className="progress" style={{ width: `${device.tonerMagenta}%`, background: '#ff1493' }}></div>
                  </div>
                  <span className="consumable-value">{device.tonerMagenta}%</span>
                </div>
                <div className="consumable-item">
                  <span className="consumable-label">Yellow</span>
                  <div className="progress-bar">
                    <div className="progress" style={{ width: `${device.tonerYellow}%`, background: '#ffd700' }}></div>
                  </div>
                  <span className="consumable-value">{device.tonerYellow}%</span>
                </div>
              </div>

              <div className="device-footer">
                <button className="btn-detail" onClick={() => {
                  setSelectedDevice(device);
                  setShowDeviceDetail(true);
                }}>View Details →</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      <div className="section">
        <div className="section-header">
          <h2>⚠️ Active Alerts & Issues</h2>
          <span className="alert-count">{alerts.filter(a => !a.acknowledged).length} Unacknowledged</span>
        </div>

        <div className="alerts-list">
          {alerts.filter(a => !a.acknowledged).map(alert => (
            <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
              <div className="alert-icon">
                {alert.severity === 'critical' && '🔴'}
                {alert.severity === 'high' && '🟠'}
                {alert.severity === 'medium' && '🟡'}
              </div>
              <div className="alert-content">
                <div className="alert-device">{alert.device}</div>
                <div className="alert-title">{alert.title}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{new Date(alert.timestamp).toLocaleString()}</div>
                {alert.errorCode && <div className="alert-code">Error Code: {alert.errorCode}</div>}
              </div>
              <button className="btn-acknowledge" onClick={() => {
                setSelectedAlert(alert);
                setShowAlertDetails(true);
              }}>View →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Customers View
  const CustomersView = () => (
    <div className="customers-view">
      <div className="view-header">
        <h1>👥 Customer Management</h1>
        <button className="btn-primary large" onClick={() => setShowAddCustomer(true)}>+ Add New Customer</button>
      </div>

      <div className="customers-grid">
        {customers.map(customer => (
          <div key={customer.id} className="customer-card">
            <div className="customer-header">
              <span className="customer-logo">{customer.logo}</span>
              <span className={`customer-status ${customer.status}`}>✓ {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}</span>
            </div>
            <h3>{customer.name}</h3>
            <div className="customer-details">
              <p>📧 {customer.email}</p>
              <p>📞 {customer.phone}</p>
              <p>📍 {customer.city}, {customer.state} {customer.zipCode}</p>
              <p className="devices-count">🖨️ {customer.devices} devices</p>
            </div>
            <div className="customer-actions">
              <button className="btn-primary" onClick={() => {
                setCurrentCustomer(customer.id);
                setCurrentView('dashboard');
              }}>View Devices</button>
              <button className="btn-secondary" onClick={() => handleGenerateInstaller(customer.id)}>📥 Installer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Modals
  const AddCustomerModal = () => (
    <div className="modal-overlay" onClick={() => setShowAddCustomer(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Customer</h2>
          <button className="modal-close" onClick={() => setShowAddCustomer(false)}>✕</button>
        </div>
        <div className="modal-content">
          <div className="form-group">
            <label>Customer ID *</label>
            <input type="text" placeholder="e.g., CUST-001" value={newCustomer.customerId} onChange={(e) => setNewCustomer({...newCustomer, customerId: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Customer Name *</label>
            <input type="text" placeholder="e.g., Acme Corp" value={newCustomer.customerName} onChange={(e) => setNewCustomer({...newCustomer, customerName: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="admin@company.com" value={newCustomer.contactEmail} onChange={(e) => setNewCustomer({...newCustomer, contactEmail: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" placeholder="(555) 123-4567" value={newCustomer.contactPhone} onChange={(e) => setNewCustomer({...newCustomer, contactPhone: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" placeholder="Street address" value={newCustomer.address} onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input type="text" value={newCustomer.city} onChange={(e) => setNewCustomer({...newCustomer, city: e.target.value})} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input type="text" placeholder="NY" value={newCustomer.state} onChange={(e) => setNewCustomer({...newCustomer, state: e.target.value})} />
            </div>
            <div className="form-group">
              <label>ZIP Code</label>
              <input type="text" value={newCustomer.zipCode} onChange={(e) => setNewCustomer({...newCustomer, zipCode: e.target.value})} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowAddCustomer(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleAddCustomer}>Create Customer</button>
        </div>
      </div>
    </div>
  );

  const AddDeviceModal = () => (
    <div className="modal-overlay" onClick={() => setShowAddDevice(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Device</h2>
          <button className="modal-close" onClick={() => setShowAddDevice(false)}>✕</button>
        </div>
        <div className="modal-content">
          <div className="form-group">
            <label>Device Name *</label>
            <input type="text" placeholder="e.g., Main Lobby Copier" value={newDevice.name} onChange={(e) => setNewDevice({...newDevice, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Model</label>
            <input type="text" placeholder="e.g., Xerox C7030" value={newDevice.model} onChange={(e) => setNewDevice({...newDevice, model: e.target.value})} />
          </div>
          <div className="form-group">
            <label>IP Address *</label>
            <input type="text" placeholder="192.168.1.100" value={newDevice.ipAddress} onChange={(e) => setNewDevice({...newDevice, ipAddress: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" placeholder="e.g., Floor 2, Lobby" value={newDevice.location} onChange={(e) => setNewDevice({...newDevice, location: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Serial Number</label>
            <input type="text" value={newDevice.serialNumber} onChange={(e) => setNewDevice({...newDevice, serialNumber: e.target.value})} />
          </div>
          <div className="form-group">
            <label>SNMP Community</label>
            <input type="text" placeholder="public" value={newDevice.snmpCommunity} onChange={(e) => setNewDevice({...newDevice, snmpCommunity: e.target.value})} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowAddDevice(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleAddDevice}>Add Device</button>
        </div>
      </div>
    </div>
  );

  const DeviceDetailModal = () => (
    selectedDevice && (
      <div className="modal-overlay" onClick={() => setShowDeviceDetail(false)}>
        <div className="modal large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedDevice.name}</h2>
            <button className="modal-close" onClick={() => setShowDeviceDetail(false)}>✕</button>
          </div>
          <div className="modal-content detailed">
            <div className="detail-section">
              <h3>Device Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Model</label>
                  <value>{selectedDevice.model}</value>
                </div>
                <div className="detail-item">
                  <label>Serial Number</label>
                  <value>{selectedDevice.serialNumber}</value>
                </div>
                <div className="detail-item">
                  <label>IP Address</label>
                  <value>{selectedDevice.ipAddress}</value>
                </div>
                <div className="detail-item">
                  <label>Location</label>
                  <value>{selectedDevice.location}</value>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <value><span className={`status-badge ${selectedDevice.status}`}>{selectedDevice.status.toUpperCase()}</span></value>
                </div>
                <div className="detail-item">
                  <label>Temperature</label>
                  <value>{selectedDevice.temperature}°C</value>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Meter Readings</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Total Pages</label>
                  <value>{selectedDevice.pageCount.toLocaleString()}</value>
                </div>
                <div className="detail-item">
                  <label>B&W Pages</label>
                  <value>{selectedDevice.bwPages.toLocaleString()}</value>
                </div>
                <div className="detail-item">
                  <label>Color Pages</label>
                  <value>{selectedDevice.colorPages.toLocaleString()}</value>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Toner Levels</h3>
              <div className="toner-grid">
                {[{name: 'Black', value: selectedDevice.tonerBlack, color: '#000'},
                  {name: 'Cyan', value: selectedDevice.tonerCyan, color: '#00ced1'},
                  {name: 'Magenta', value: selectedDevice.tonerMagenta, color: '#ff1493'},
                  {name: 'Yellow', value: selectedDevice.tonerYellow, color: '#ffd700'}].map(toner => (
                  <div key={toner.name} className="toner-item">
                    <label>{toner.name}</label>
                    <div className="progress-bar">
                      <div className="progress" style={{ width: `${toner.value}%`, background: toner.color }}></div>
                    </div>
                    <span>{toner.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedDevice.errorCodes.length > 0 && (
              <div className="detail-section error-section">
                <h3>Error Codes</h3>
                {selectedDevice.errorCodes.map((code, idx) => (
                  <div key={idx} className="error-code">{code}</div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowDeviceDetail(false)}>Close</button>
          </div>
        </div>
      </div>
    )
  );

  const InstallerModal = () => (
    selectedCustomerForInstaller && (
      <div className="modal-overlay" onClick={() => setShowInstallerModal(false)}>
        <div className="modal large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📥 Download Installer</h2>
            <button className="modal-close" onClick={() => setShowInstallerModal(false)}>✕</button>
          </div>
          <div className="modal-content installer-content">
            <div className="installer-info">
              <h3>FleetSync Client Installer for {selectedCustomerForInstaller.name}</h3>
              <p>This custom installer is pre-configured with your customer's API keys and settings.</p>

              <div className="installer-details">
                <div className="detail-row">
                  <span>Package Name:</span>
                  <strong>{selectedCustomerForInstaller.installerData?.packageName}</strong>
                </div>
                <div className="detail-row">
                  <span>Expires:</span>
                  <strong>{selectedCustomerForInstaller.installerData?.expiresIn}</strong>
                </div>
                <div className="detail-row">
                  <span>API Server:</span>
                  <strong>{installerSettings.apiUrl}</strong>
                </div>
              </div>

              <div className="installer-steps">
                <h4>Installation Steps:</h4>
                <ol>
                  <li>Download the EXE file to your computer</li>
                  <li>Send to client via email or secure link</li>
                  <li>Client runs as Administrator on Windows PC</li>
                  <li>Interactive wizard guides through setup</li>
                  <li>Collector automatically discovers MFPs on network</li>
                  <li>Data starts flowing to dashboard</li>
                </ol>
              </div>

              <div className="installer-config">
                <h4>Embedded Configuration:</h4>
                <pre>{JSON.stringify(selectedCustomerForInstaller.installerData?.configContent, null, 2)}</pre>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowInstallerModal(false)}>Close</button>
            <button className="btn-primary" onClick={() => alert('Download will start. Save the EXE file and send to customer.')}>⬇️ Download EXE</button>
          </div>
        </div>
      </div>
    )
  );

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="header-brand">
            <span className="brand-icon">📊</span>
            <span className="brand-text">FleetSync Pro</span>
          </div>
        </div>
        <div className="header-center">
          {currentCustomerData && (
            <select value={currentCustomer} onChange={(e) => setCurrentCustomer(e.target.value)} className="customer-selector">
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.logo} {c.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="header-right">
          <button className="header-btn" title="Notifications">🔔</button>
          <button className="header-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
          <button className="header-btn" title="Profile">👤</button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <nav className="sidebar-nav">
          <a href="#" className={currentView === 'dashboard' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('dashboard'); }}>
            📈 Dashboard
          </a>
          <a href="#" className={currentView === 'devices' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('devices'); }}>
            🖨️ Devices
          </a>
          <a href="#" className={currentView === 'customers' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('customers'); }}>
            👥 Customers
          </a>
          <a href="#" className={currentView === 'alerts' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('alerts'); }}>
            ⚠️ Alerts
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${!sidebarOpen ? 'full-width' : ''}`}>
        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading">Loading data...</div>}

        {!loading && currentView === 'dashboard' && <DashboardView />}
        {!loading && currentView === 'customers' && <CustomersView />}

        {showAddCustomer && <AddCustomerModal />}
        {showAddDevice && <AddDeviceModal />}
        {showDeviceDetail && <DeviceDetailModal />}
        {showInstallerModal && <InstallerModal />}
      </main>
    </div>
  );
}

export default App;