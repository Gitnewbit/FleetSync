require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET not set — using insecure default. Set JWT_SECRET env var before production use.');
}
const _JWT = JWT_SECRET || 'fleetsync-insecure-default-change-this';
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'fleetsync.db');
const downloadPath = path.join(__dirname, 'downloads');
let db;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : true,   // true = reflect any origin (fine for self-hosted tool)
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/downloads', express.static(downloadPath));

// Ensure downloads directory exists
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath, { recursive: true });
}

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ========== DATABASE INITIALIZATION ==========

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('[ERROR] Database connection failed:', err);
        reject(err);
      } else {
        console.log('[✓] Database connected');
        db.on('error', (err) => { console.error('[SQLite]', err.message); });
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Customers table
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          customerId TEXT PRIMARY KEY,
          customerName TEXT NOT NULL,
          contactEmail TEXT,
          contactPhone TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zip TEXT,
          apiKey TEXT,
          config JSON,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Users table
        db.run(`
       CREATE TABLE IF NOT EXISTS users (
          userId TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          role TEXT NOT NULL,
          customerId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

        db.run(`
      CREATE TABLE IF NOT EXISTS xerox_models (
      modelId TEXT PRIMARY KEY,
      modelName TEXT NOT NULL,
      family TEXT,
      supportsColor INTEGER,
      supportsScan INTEGER,
      supportsFax INTEGER,
      meterOid TEXT,
      tonerOidBlack TEXT,
      tonerOidCyan TEXT,
      tonerOidMagenta TEXT,
      tonerOidYellow TEXT
        );
      `);

      // Devices table
      db.run(`
        CREATE TABLE IF NOT EXISTS devices (
          deviceId TEXT PRIMARY KEY,
          customerId TEXT NOT NULL,
          name TEXT NOT NULL,
          model TEXT,
          location TEXT,
          ipAddress TEXT,
          serialNumber TEXT,
          snmpCommunity TEXT,
          isActive BOOLEAN DEFAULT 1,
          addedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customerId) REFERENCES customers(customerId)
        );
        CREATE INDEX IF NOT EXISTS idx_devices_customer ON devices(customerId);
      `);

// Metrics History table
db.run(`
  CREATE TABLE IF NOT EXISTS metrics_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    deviceId TEXT,
    customerId TEXT,

    timestamp TEXT,

    pageCount INTEGER,
    bwPageCount INTEGER,
    colorPageCount INTEGER,

    monoLargePageCount INTEGER,
    colorLargePageCount INTEGER,

    tonerLevelBlack INTEGER,
    tonerLevelCyan INTEGER,
    tonerLevelMagenta INTEGER,
    tonerLevelYellow INTEGER,

    drumYieldBlack INTEGER,
    drumYieldCyan INTEGER,
    drumYieldMagenta INTEGER,
    drumYieldYellow INTEGER,

    fuserUnitYield INTEGER
  );
`);

// Metrics table
db.run(`
  CREATE TABLE IF NOT EXISTS metrics (
    metricId TEXT PRIMARY KEY,
    deviceId TEXT NOT NULL,
    customerId TEXT NOT NULL,
    timestamp DATETIME NOT NULL,

    pageCount INTEGER,
    bwPageCount INTEGER,
    colorPageCount INTEGER,

    tonerLevelBlack INTEGER,
    tonerLevelCyan INTEGER,
    tonerLevelMagenta INTEGER,
    tonerLevelYellow INTEGER,

    drumYieldBlack INTEGER,
    drumYieldCyan INTEGER,
    drumYieldMagenta INTEGER,
    drumYieldYellow INTEGER,

    fuserUnitYield INTEGER,
    temperature INTEGER,
    isOnline BOOLEAN,

    errorCode TEXT,
    errorDescription TEXT,
    serviceCode TEXT,
    serviceMessage TEXT,

    lastSeenOnline DATETIME,
    lastSeenOffline DATETIME,

    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (deviceId) REFERENCES devices(deviceId),
    FOREIGN KEY (customerId) REFERENCES customers(customerId)
  );

  CREATE INDEX IF NOT EXISTS idx_metrics_device
  ON metrics(deviceId);

  CREATE INDEX IF NOT EXISTS idx_metrics_customer
  ON metrics(customerId);

  CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
  ON metrics(timestamp);
`);


      // Device status table
      db.run(`
        CREATE TABLE IF NOT EXISTS device_status (
          deviceId TEXT PRIMARY KEY,
          customerId TEXT NOT NULL,
          isCurrentlyOnline BOOLEAN,
          lastOnlineTime DATETIME,
          lastOfflineTime DATETIME,
          consecutiveFailures INTEGER,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deviceId) REFERENCES devices(deviceId),
          FOREIGN KEY (customerId) REFERENCES customers(customerId)
        );
        CREATE INDEX IF NOT EXISTS idx_status_customer ON device_status(customerId);
      `);

      // Alerts table
      db.run(`
        CREATE TABLE IF NOT EXISTS alerts (
          alertId TEXT PRIMARY KEY,
          deviceId TEXT NOT NULL,
          customerId TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          severity TEXT,
          alertType TEXT,
          message TEXT,
          errorCode TEXT,
          acknowledged BOOLEAN DEFAULT 0,
          acknowledgedAt DATETIME,
          acknowledgedBy TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deviceId) REFERENCES devices(deviceId),
          FOREIGN KEY (customerId) REFERENCES customers(customerId)
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(deviceId);
        CREATE INDEX IF NOT EXISTS idx_alerts_customer ON alerts(customerId);
      `);

      // Service history table
      db.run(`
        CREATE TABLE IF NOT EXISTS service_history (
          serviceId TEXT PRIMARY KEY,
          deviceId TEXT NOT NULL,
          customerId TEXT NOT NULL,
          serviceCode TEXT,
          message TEXT,
          timestamp DATETIME,
          resolvedAt DATETIME,
          resolvedBy TEXT,
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deviceId) REFERENCES devices(deviceId),
          FOREIGN KEY (customerId) REFERENCES customers(customerId)
        );
        CREATE INDEX IF NOT EXISTS idx_service_device ON service_history(deviceId);
        CREATE INDEX IF NOT EXISTS idx_service_customer ON service_history(customerId);
      `);


// Fleet Devices table
db.run(`
  CREATE TABLE IF NOT EXISTS fleet_devices (
    deviceId TEXT PRIMARY KEY,
    customerId TEXT,
    collectorId TEXT,
    hostname TEXT,
    ipAddress TEXT,
    manufacturer TEXT,
    model TEXT,
    status TEXT,
    lastSeen DATETIME
  );
`);

// Installer packages table
db.run(`
  CREATE TABLE IF NOT EXISTS installer_packages (
    packageId TEXT PRIMARY KEY,
    customerId TEXT NOT NULL,
    packageName TEXT NOT NULL,
    fileName TEXT NOT NULL,
    apiKey TEXT NOT NULL,
    apiUrl TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME,
    downloadCount INTEGER DEFAULT 0,
    lastDownloadedAt DATETIME,
    FOREIGN KEY (customerId) REFERENCES customers(customerId)
  );
  CREATE INDEX IF NOT EXISTS idx_packages_customer ON installer_packages(customerId);
`, (err) => {

  if (err) {
    console.error('[ERROR] Creating tables:', err);
    reject(err);
  } else {
    console.log('[✓] Database tables initialized');

    // ── Schema migrations — run on every start, silently skip existing cols ──
    const migrations = [
      // customers
      'ALTER TABLE customers ADD COLUMN address TEXT',
      'ALTER TABLE customers ADD COLUMN city TEXT',
      'ALTER TABLE customers ADD COLUMN state TEXT',
      'ALTER TABLE customers ADD COLUMN zip TEXT',
      'ALTER TABLE customers ADD COLUMN apiKey TEXT',
      'ALTER TABLE customers ADD COLUMN config JSON',
      'ALTER TABLE customers ADD COLUMN updatedAt DATETIME',

      // installer_packages — old DBs may be missing these columns
      'ALTER TABLE installer_packages ADD COLUMN customerId TEXT',
      'ALTER TABLE installer_packages ADD COLUMN apiKey TEXT',
      'ALTER TABLE installer_packages ADD COLUMN apiUrl TEXT',
      'ALTER TABLE installer_packages ADD COLUMN packageName TEXT',
      'ALTER TABLE installer_packages ADD COLUMN fileName TEXT',
      'ALTER TABLE installer_packages ADD COLUMN expiresAt DATETIME',
      'ALTER TABLE installer_packages ADD COLUMN downloadCount INTEGER DEFAULT 0',
      'ALTER TABLE installer_packages ADD COLUMN lastDownloadedAt DATETIME',

      // device_status — old DBs may be missing customerId
      'ALTER TABLE device_status ADD COLUMN customerId TEXT',
      'ALTER TABLE device_status ADD COLUMN consecutiveFailures INTEGER DEFAULT 0',
      'ALTER TABLE device_status ADD COLUMN updatedAt DATETIME',

      // alerts — old DBs may be missing these
      'ALTER TABLE alerts ADD COLUMN customerId TEXT',
      'ALTER TABLE alerts ADD COLUMN acknowledgedBy TEXT',
      'ALTER TABLE alerts ADD COLUMN acknowledgedAt DATETIME',

      // metrics
      'ALTER TABLE metrics ADD COLUMN customerId TEXT',
      'ALTER TABLE metrics ADD COLUMN temperature INTEGER',
      'ALTER TABLE metrics ADD COLUMN serviceCode TEXT',
      'ALTER TABLE metrics ADD COLUMN serviceMessage TEXT',
    ];
    // Each runs independently — silently ignores "duplicate column name" errors
    migrations.forEach(sql => db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.warn('[MIGRATION]', err.message, '|', sql);
      }
    }));

    resolve();
  }

});

    });
  });
}

function seedXeroxModels() {

  const models = [
    ['xm001','VersaLink B405','VersaLink',0,1,1],
    ['xm002','VersaLink C405','VersaLink',1,1,1],
    ['xm003','VersaLink B415','VersaLink',0,1,1],
    ['xm004','VersaLink C415','VersaLink',1,1,1],
    ['xm005','VersaLink B7025','VersaLink',0,1,1],
    ['xm006','VersaLink C7025','VersaLink',1,1,1],
    ['xm007','VersaLink B7135','VersaLink',0,1,1],
    ['xm008','VersaLink C7135','VersaLink',1,1,1],
    ['xm009','AltaLink C8255','AltaLink',1,1,1]
  ];

  models.forEach(model => {

    db.run(
      `
      INSERT OR IGNORE INTO xerox_models
      (
        modelId,
        modelName,
        family,
        supportsColor,
        supportsScan,
        supportsFax
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      model
    );

  });

}

// ========== JWT AUTHENTICATION ==========

function authenticateToken(req, res, next) {

  const authHeader =
    req.headers['authorization'];

  const token =
    authHeader &&
    authHeader.split(' ')[1];

  if (!token) {

    return res.status(401).json({
      error: 'Access denied'
    });

  }

  jwt.verify(
    token, _JWT,
    (err, user) => {

      if (err) {

        return res.status(403).json({
          error: 'Invalid token'
        });

      }

      req.user = user;

      next();

    }
  );

}

// ========== AUTH ROUTES ==========


// Login User
app.post('/api/auth/login', async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {

        if (err) {

          console.error(err);

          return res.status(500).json({
            error: 'Database error'
          });

        }

        if (!user) {

          return res.status(401).json({
            error: 'Invalid credentials'
          });

        }

        const validPassword =
          await bcrypt.compare(
            password,
            user.passwordHash
          );

        if (!validPassword) {

          return res.status(401).json({
            error: 'Invalid credentials'
          });

        }

        const token =
          jwt.sign(
            {
              userId: user.userId,
              email: user.email,
              role: user.role,
              customerId: user.customerId
            },
            _JWT,
            {
              expiresIn: '7d'
            }
          );

        res.json({
          success: true,
          token,
          user: {
            userId:     user.userId,
            email:      user.email,
            role:       user.role,
            customerId: user.customerId,
            isAdmin:    user.role === 'it_manager'
          }
        });

      }
    );

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Server error'
    });

  }

});

// Current User
app.get(
  '/api/auth/me',
  authenticateToken,
  (req, res) => {

    res.json({
      success: true,
      user: req.user
    });

  }
);

// ========== COLLECTOR HEARTBEAT ==========

app.post('/api/collector/heartbeat', (req, res) => {

  try {

    const {
      customerId,
      collectorId,
      machineName,
      timestamp
    } = req.body;

    console.log(
      `[HEARTBEAT] Customer=${customerId} Collector=${collectorId} Machine=${machineName}`
    );

    res.json({
      success: true,
      message: 'Heartbeat received',
      serverTime: new Date().toISOString()
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

// ========== DEVICE REGISTRATION ==========

app.post('/api/devices/register', (req, res) => {

    try {

        const {
            customerId,
            collectorId,
            hostname,
            ipAddress,
            manufacturer,
            model
        } = req.body;

        db.get(
            `
            SELECT deviceId
            FROM fleet_devices
            WHERE ipAddress = ?
            `,
            [ipAddress],
            (err, existing) => {

                if (err) {
                    console.error(err);

                    return res.status(500).json({
                        success: false
                    });
                }

                // Update existing device
                if (existing) {

                    db.run(
                        `
                        UPDATE fleet_devices
                        SET
                            hostname = ?,
                            manufacturer = ?,
                            model = ?,
                            status = 'Online',
                            lastSeen = ?
                        WHERE ipAddress = ?
                        `,
                        [
                            hostname,
                            manufacturer || 'Unknown',
                            model || 'Unknown',
                            new Date().toISOString(),
                            ipAddress
                        ],
                        (err) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false
                                });
                            }

                            res.json({
                                success: true,
                                action: 'updated'
                            });

                        }
                    );

                } else {

                    // Create new device
                    const deviceId = uuidv4();

                    db.run(
                        `
                        INSERT INTO fleet_devices
                        (
                            deviceId,
                            customerId,
                            collectorId,
                            hostname,
                            ipAddress,
                            manufacturer,
                            model,
                            status,
                            lastSeen
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        [
                            deviceId,
                            customerId,
                            collectorId,
                            hostname,
                            ipAddress,
                            manufacturer || 'Unknown',
                            model || 'Unknown',
                            'Online',
                            new Date().toISOString()
                        ],
                        (err) => {

                            if (err) {
                                console.error(err);

                                return res.status(500).json({
                                    success: false
                                });
                            }

                            res.json({
                                success: true,
                                action: 'created'
                            });

                        }
                    );

                }

            }
        );

    } catch (ex) {

        console.error(ex);

        res.status(500).json({
            success: false
        });

    }

});

app.get('/api/devices/list', (req, res) => {

    db.all(
        `
        SELECT *
        FROM fleet_devices
        ORDER BY hostname
        `,
        [],
        (err, rows) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false
                });
            }

            res.json(rows);

        }
    );

});

// ========== CUSTOMER MANAGEMENT ==========

app.post('/api/customers', (req, res) => {
  try {
    const {
      customerId, customerName, contactEmail, contactPhone,
      address, city, state, zip
    } = req.body;

    if (!customerId || !customerName) {
      return res.status(400).json({ error: 'Customer ID and Customer Name are required.' });
    }

    const now = new Date().toISOString();

    // Check if customer already exists
    db.get('SELECT customerId, apiKey FROM customers WHERE customerId = ?', [customerId], (lookupErr, existing) => {
      if (lookupErr) {
        console.error('[POST /api/customers lookup]', lookupErr);
        return res.status(500).json({ error: 'Database error during lookup.' });
      }

      if (existing) {
        // Customer exists — update name/contact info but keep apiKey
        db.run(
          `UPDATE customers SET
            customerName = ?, contactEmail = ?, contactPhone = ?,
            address = ?, city = ?, state = ?, zip = ?, updatedAt = ?
           WHERE customerId = ?`,
          [customerName, contactEmail || null, contactPhone || null,
           address || null, city || null, state || null, zip || null,
           now, customerId],
          function(updateErr) {
            if (updateErr) {
              console.error('[POST /api/customers update]', updateErr);
              return res.status(500).json({ error: updateErr.message });
            }
            return res.status(200).json({
              success: true,
              customerId,
              apiKey: existing.apiKey,
              message: 'Customer updated successfully'
            });
          }
        );
        return;
      }

      // New customer — insert with fresh apiKey
      const apiKey = crypto.randomBytes(32).toString('hex');
      const config = JSON.stringify({ collectionInterval: 60, createdAt: now });

      db.run(
        `INSERT INTO customers
          (customerId, customerName, contactEmail, contactPhone,
           address, city, state, zip, apiKey, config, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, customerName, contactEmail || null, contactPhone || null,
         address || null, city || null, state || null, zip || null,
         apiKey, config, now, now],
        function(insertErr) {
          if (insertErr) {
            console.error('[POST /api/customers insert]', insertErr.message);
            return res.status(500).json({ error: insertErr.message });
          }
          console.log(`[✓] Customer created: ${customerId} (${customerName})`);
          res.status(201).json({
            success: true,
            customerId,
            apiKey,
            message: 'Customer created successfully'
          });
        }
      );
    });
  } catch (err) {
    console.error('[POST /api/customers]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// List ALL customers (IT Manager view)
app.get('/api/customers', (req, res) => {
  try {
    db.all('SELECT * FROM customers ORDER BY customerName', [], (err, rows) => {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to fetch customers' });
      }
      res.json(rows || []);
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/customers/:customerId', (req, res) => {
  try {
    db.get('SELECT * FROM customers WHERE customerId = ?', [req.params.customerId], (err, row) => {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to fetch customer' });
      }
      res.json(row || {});
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== DELETE CUSTOMER ==========
app.delete('/api/customers/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    const { cascade } = req.query; // ?cascade=true also removes devices, metrics, alerts

    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }

    // Check customer exists
    db.get('SELECT customerName FROM customers WHERE customerId = ?', [customerId], (err, row) => {
      if (err)  return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Customer not found' });

      // Always remove related records so no orphans remain
      const cb = (err) => { if (err) console.warn('[DELETE customer cascade]', err.message); };
      db.serialize(() => {
        db.run('DELETE FROM alerts            WHERE customerId = ?', [customerId], cb);
        db.run('DELETE FROM metrics           WHERE customerId = ?', [customerId], cb);
        db.run('DELETE FROM device_status     WHERE customerId = ?', [customerId], cb);
        db.run('DELETE FROM service_history   WHERE customerId = ?', [customerId], cb);
        try { db.run('DELETE FROM installer_packages WHERE customerId = ?', [customerId], cb); } catch(_) {}
        db.run('DELETE FROM devices           WHERE customerId = ?', [customerId], cb);
        db.run('DELETE FROM customers         WHERE customerId = ?', [customerId], function(delErr) {
          if (delErr) {
            console.error('[DELETE /api/customers]', delErr);
            return res.status(500).json({ error: delErr.message });
          }
          console.log(`[✓] Customer deleted: ${customerId} (${row.customerName})`);
          res.json({ success: true, customerId, deletedName: row.customerName });
        });
      });
    });
  } catch (err) {
    console.error('[DELETE /api/customers]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});


// ========== DEVICE MANAGEMENT ==========

app.post('/api/devices', (req, res) => {
  try {
    const { deviceId, customerId, name, model, location, ipAddress, serialNumber, snmpCommunity } = req.body;

    if (!deviceId || !customerId || !name || !ipAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
      INSERT INTO devices (deviceId, customerId, name, model, location, ipAddress, serialNumber, snmpCommunity, isActive, addedDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `;

    db.run(sql, [deviceId, customerId, name, model, location, ipAddress, serialNumber || null, snmpCommunity || 'public'], function(err) {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to add device' });
      }
      res.status(201).json({ success: true, deviceId });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/devices', (req, res) => {
  try {
    const customerId = req.query.customerId;
    let sql = 'SELECT * FROM devices';
    let params = [];

    if (customerId) {
      sql += ' WHERE customerId = ?';
      params = [customerId];
    }

    sql += ' ORDER BY name';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to fetch devices' });
      }
      res.json(rows || []);
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/devices/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    db.get('SELECT name FROM devices WHERE deviceId = ?', [deviceId], (lookupErr, row) => {
      if (lookupErr) return res.status(500).json({ error: lookupErr.message });
      if (!row)      return res.status(404).json({ error: 'Device not found' });

      // Remove device + all its related records
      const dcb = (err) => { if (err) console.warn('[DELETE device cascade]', err.message); };
      db.serialize(() => {
        db.run('DELETE FROM metrics         WHERE deviceId = ?', [deviceId], dcb);
        db.run('DELETE FROM device_status   WHERE deviceId = ?', [deviceId], dcb);
        db.run('DELETE FROM alerts          WHERE deviceId = ?', [deviceId], dcb);
        db.run('DELETE FROM service_history WHERE deviceId = ?', [deviceId], dcb);
        db.run('DELETE FROM devices         WHERE deviceId = ?', [deviceId], function(err) {
          if (err) {
            console.error('[DELETE /api/devices]', err);
            return res.status(500).json({ error: err.message });
          }
          console.log(`[✓] Device deleted: ${deviceId} (${row.name})`);
          res.json({ success: true, deviceId, deletedName: row.name });
        });
      });
    });
  } catch (err) {
    console.error('[DELETE /api/devices]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ========== GET SINGLE DEVICE ==========

app.get('/api/devices/:deviceId', (req, res) => {

  try {

    const deviceId =
      req.params.deviceId;

    const sql = `
      SELECT *
      FROM devices
      WHERE deviceId = ?
    `;

    db.get(
      sql,
      [deviceId],
      (err, row) => {

        if (err) {

          console.error('[ERROR]', err);

          return res.status(500).json({
            error:
              'Failed to fetch device'
          });

        }

        if (!row) {

          return res.status(404).json({
            error:
              'Device not found'
          });

        }

        res.json({
          success: true,
          device: row
        });

      }
    );

  } catch (err) {

    console.error('[ERROR]', err);

    res.status(500).json({
      error: 'Server error'
    });

  }

});

// ========== UPDATE DEVICE ==========

app.put('/api/devices/:deviceId', (req, res) => {

  try {

    const deviceId =
      req.params.deviceId;

    const {
      name,
      model,
      location,
      ipAddress,
      serialNumber,
      snmpCommunity,
      isActive
    } = req.body;

    const sql = `
      UPDATE devices
      SET
        name = ?,
        model = ?,
        location = ?,
        ipAddress = ?,
        serialNumber = ?,
        snmpCommunity = ?,
        isActive = ?
      WHERE deviceId = ?
    `;

    db.run(
      sql,
      [
        name,
        model,
        location,
        ipAddress,
        serialNumber,
        snmpCommunity,
        isActive ? 1 : 0,
        deviceId
      ],
      function(err) {

        if (err) {

          console.error('[ERROR]', err);

          return res.status(500).json({
            error:
              'Failed to update device'
          });

        }

        res.json({
          success: true,
          deviceId
        });

      }
    );

  } catch (err) {

    console.error('[ERROR]', err);

    res.status(500).json({
      error: 'Server error'
    });

  }

});

app.get('/api/xerox/models', (req, res) => {

    db.all(
        `
        SELECT *
        FROM xerox_models
        ORDER BY modelName
        `,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json({
                    success:false
                });
            }

            res.json(rows);

        });

});

// ========== DEVICE DETAILS ==========

app.get(
  '/api/device-details/:deviceId',
  async (req, res) => {

    try {

      const deviceId =
        req.params.deviceId;

      const device =
        await queryAsync(
          `
          SELECT *
          FROM devices
          WHERE deviceId = ?
        `,
          [deviceId]
        );

      const latestMetric =
        await queryAsync(
          `
          SELECT *
          FROM metrics
          WHERE deviceId = ?
          ORDER BY timestamp DESC
          LIMIT 1
        `,
          [deviceId]
        );

      const alerts =
        await queryAsync(
          `
          SELECT *
          FROM alerts
          WHERE deviceId = ?
          ORDER BY timestamp DESC
          LIMIT 100
        `,
          [deviceId]
        );

      const status =
        await queryAsync(
          `
          SELECT *
          FROM device_status
          WHERE deviceId = ?
        `,
          [deviceId]
        );

      res.json({

        success: true,

        device:
          device[0] || {},

        latestMetric:
          latestMetric[0] || {},

        alerts:
          alerts || [],

        status:
          status[0] || {}

      });

    } catch (err) {

      console.error('[ERROR]', err);

      res.status(500).json({
        error:
          'Failed to fetch device details'
      });

    }

  }
);

// ========== SEARCH DEVICES ==========

app.get(
  '/api/search/devices',
  (req, res) => {

    try {

      const q =
        req.query.q || '';

      const customerId =
        req.query.customerId;

      let sql = `
        SELECT *
        FROM devices
        WHERE
        (
          name LIKE ?
          OR model LIKE ?
          OR location LIKE ?
          OR ipAddress LIKE ?
          OR serialNumber LIKE ?
        )
      `;

      const search =
        `%${q}%`;

      const params = [
        search,
        search,
        search,
        search,
        search
      ];

      if (customerId) {

        sql += `
          AND customerId = ?
        `;

        params.push(customerId);

      }

      sql += `
        ORDER BY name
      `;

      db.all(
        sql,
        params,
        (err, rows) => {

          if (err) {

            console.error(
              '[ERROR]',
              err
            );

            return res.status(500).json({
              error:
                'Search failed'
            });

          }

          res.json({
            success: true,
            devices: rows || []
          });

        }
      );

    } catch (err) {

      console.error('[ERROR]', err);

      res.status(500).json({
        error: 'Server error'
      });

    }

  }
);

function createAlertIfNeeded(
  deviceId,
  customerId,
  severity,
  alertType,
  message
) {

  db.get(
    `
    SELECT *
    FROM alerts
    WHERE deviceId = ?
    AND alertType = ?
    AND acknowledged = 0
    `,
    [deviceId, alertType],
    (err, existing) => {

      if (existing) {
        return;
      }

      db.run(
        `
        INSERT INTO alerts
        (
          alertId,
          deviceId,
          customerId,
          timestamp,
          severity,
          alertType,
          message,
          acknowledged
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, 0)
        `,
        [
          uuidv4(),
          deviceId,
          customerId,
          new Date().toISOString(),
          severity,
          alertType,
          message
        ]
      );

      console.log(
        `[ALERT] ${deviceId} -> ${message}`
      );

    }
  );

}

// ========== METRICS ENDPOINTS ==========

app.post('/api/metrics', (req, res) => {
  try {
    const metric = req.body;

    if (!metric.metricId || !metric.deviceId || !metric.customerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
      INSERT INTO metrics (
        metricId, deviceId, customerId, timestamp, pageCount, bwPageCount, colorPageCount,
        tonerLevelBlack, tonerLevelCyan, tonerLevelMagenta, tonerLevelYellow,
        drumYieldBlack, drumYieldCyan, drumYieldMagenta, drumYieldYellow,
        fuserUnitYield, temperature, isOnline, errorCode, errorDescription,
        serviceCode, serviceMessage, lastSeenOnline, lastSeenOffline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      metric.metricId, metric.deviceId, metric.customerId, metric.timestamp || new Date().toISOString(),
      metric.pageCount || 0, metric.bwPageCount || 0, metric.colorPageCount || 0,
      metric.tonerLevelBlack || 0, metric.tonerLevelCyan || 0, metric.tonerLevelMagenta || 0, metric.tonerLevelYellow || 0,
      metric.drumYieldBlack || 0, metric.drumYieldCyan || 0, metric.drumYieldMagenta || 0, metric.drumYieldYellow || 0,
      metric.fuserUnitYield || 0, metric.temperature || 0, metric.isOnline !== false ? 1 : 0,
      metric.errorCode || null, metric.errorDescription || null,
      metric.serviceCode || null, metric.serviceMessage || null,
      metric.lastSeenOnline || new Date().toISOString(), metric.lastSeenOffline || null
    ];

db.run(sql, values, function(err) {

  if (err) {

    console.error('[ERROR]', err);

    return res.status(500).json({
      error: 'Failed to store metric'
    });

  }

  // ==========================
  // SMART ALERTS ENGINE
  // ==========================

  if (metric.tonerLevelBlack <= 15) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'High',
      'LOW_BLACK_TONER',
      `Black toner is at ${metric.tonerLevelBlack}%`
    );

  }

  if (metric.tonerLevelCyan <= 15) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'High',
      'LOW_CYAN_TONER',
      `Cyan toner is at ${metric.tonerLevelCyan}%`
    );

  }

  if (metric.tonerLevelMagenta <= 15) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'High',
      'LOW_MAGENTA_TONER',
      `Magenta toner is at ${metric.tonerLevelMagenta}%`
    );

  }

  if (metric.tonerLevelYellow <= 15) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'High',
      'LOW_YELLOW_TONER',
      `Yellow toner is at ${metric.tonerLevelYellow}%`
    );

  }

  if (metric.drumYieldBlack <= 20) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'Medium',
      'BLACK_DRUM_LOW',
      `Black drum is at ${metric.drumYieldBlack}%`
    );

  }

  if (metric.fuserUnitYield <= 15) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'Critical',
      'FUSER_LOW',
      `Fuser life is at ${metric.fuserUnitYield}%`
    );

  }

  if (!metric.isOnline) {

    createAlertIfNeeded(
      metric.deviceId,
      metric.customerId,
      'Critical',
      'DEVICE_OFFLINE',
      'Device is offline'
    );

  }

  res.json({
    success: true,
    metricId: metric.metricId
  });

    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/metrics/:deviceId/latest', (req, res) => {
  try {
    db.get(
      'SELECT * FROM metrics WHERE deviceId = ? ORDER BY timestamp DESC LIMIT 1',
      [req.params.deviceId],
      (err, row) => {
        if (err) {
          console.error('[ERROR]', err);
          return res.status(500).json({ error: 'Failed to fetch metric' });
        }
        res.json(row || {});
      }
    );
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== ALERTS ENDPOINTS ==========

app.post('/api/alerts', (req, res) => {
  try {
    const { alertId, deviceId, customerId, timestamp, severity, alertType, message, errorCode } = req.body;

    if (!alertId || !deviceId || !customerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
      INSERT INTO alerts (alertId, deviceId, customerId, timestamp, severity, alertType, message, errorCode, acknowledged)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    db.run(sql, [alertId, deviceId, customerId, timestamp || new Date().toISOString(), severity || 'Medium', alertType, message, errorCode], function(err) {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to create alert' });
      }
      res.json({ success: true, alertId });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/alerts', (req, res) => {
  try {
    const customerId = req.query.customerId;
    const acknowledged = req.query.acknowledged;

    let sql = 'SELECT * FROM alerts WHERE 1=1';
    let params = [];

    if (customerId) {
      sql += ' AND customerId = ?';
      params.push(customerId);
    }

    if (acknowledged !== undefined) {
      sql += ' AND acknowledged = ?';
      params.push(acknowledged === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY timestamp DESC LIMIT 500';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to fetch alerts' });
      }
      res.json(rows || []);
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const { acknowledgedBy } = req.body;

    const sql = `
      UPDATE alerts
      SET acknowledged = 1, acknowledgedAt = CURRENT_TIMESTAMP, acknowledgedBy = ?
      WHERE alertId = ?
    `;

    db.run(sql, [acknowledgedBy, req.params.alertId], function(err) {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to acknowledge alert' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== DEVICE STATUS ==========

app.get('/api/device-status', (req, res) => {
  try {
    const customerId = req.query.customerId;
    let sql = 'SELECT * FROM device_status';
    let params = [];

    if (customerId) {
      sql += ' WHERE customerId = ?';
      params = [customerId];
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to fetch status' });
      }
      res.json(rows || []);
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/device-status', (req, res) => {
  try {
    const { deviceId, customerId, isCurrentlyOnline, lastOnlineTime, lastOfflineTime, consecutiveFailures } = req.body;

    if (!deviceId || !customerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
      INSERT OR REPLACE INTO device_status
      (deviceId, customerId, isCurrentlyOnline, lastOnlineTime, lastOfflineTime, consecutiveFailures)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [deviceId, customerId, isCurrentlyOnline ? 1 : 0, lastOnlineTime, lastOfflineTime, consecutiveFailures || 0], function(err) {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to update status' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== DASHBOARD ENDPOINT ==========

app.get('/api/dashboard/:customerId', (req, res) => {
  try {
    const customerId = req.params.customerId;

    Promise.all([
      queryAsync('SELECT COUNT(*) as count FROM devices WHERE customerId = ? AND isActive = 1', [customerId]),
      queryAsync('SELECT COUNT(*) as count FROM device_status WHERE customerId = ? AND isCurrentlyOnline = 1', [customerId]),
      queryAsync('SELECT COUNT(*) as count FROM device_status WHERE customerId = ? AND isCurrentlyOnline = 0', [customerId]),
      queryAsync('SELECT COUNT(*) as count FROM alerts WHERE customerId = ? AND acknowledged = 0', [customerId]),
      queryAsync(`
        SELECT AVG(tonerLevelBlack) as avgTonerBlack,
               AVG(tonerLevelCyan) as avgTonerCyan,
               AVG(tonerLevelMagenta) as avgTonerMagenta,
               AVG(tonerLevelYellow) as avgTonerYellow,
               AVG(fuserUnitYield) as avgFuser,
               AVG(drumYieldBlack) as avgDrum,
               MIN(tonerLevelBlack) as minTonerBlack,
               SUM(pageCount) as totalPages
        FROM metrics WHERE customerId = ?
      `, [customerId])
    ]).then(results => {
      res.json({
        totalDevices: results[0][0]?.count || 0,
        onlineDevices: results[1][0]?.count || 0,
        offlineDevices: results[2][0]?.count || 0,
        activeAlerts: results[3][0]?.count || 0,
        tonerStats: {
          avgBlack: Math.round(results[4][0]?.avgTonerBlack || 0),
          avgCyan: Math.round(results[4][0]?.avgTonerCyan || 0),
          avgMagenta: Math.round(results[4][0]?.avgTonerMagenta || 0),
          avgYellow: Math.round(results[4][0]?.avgTonerYellow || 0),
          minToner: results[4][0]?.minTonerBlack || 0
        },
        consumables: {
          avgFuser: Math.round(results[4][0]?.avgFuser || 0),
          avgDrum: Math.round(results[4][0]?.avgDrum || 0)
        },
        pageStats: {
          totalPages: results[4][0]?.totalPages || 0
        }
      });
    }).catch(err => {
      console.error('[ERROR]', err);
      res.status(500).json({ error: 'Failed to fetch dashboard' });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== INSTALLER PACKAGE GENERATION ==========

app.post('/api/installer/create', (req, res) => {
  try {
    const { customerId, customerName, apiUrl } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId required' });

    const finalApiUrl = (apiUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    // Fetch customer — auto-create if not in DB so seed customers always work
    db.get('SELECT * FROM customers WHERE customerId = ?', [customerId], (err, customer) => {
      if (err) return res.status(500).json({ error: 'DB error: ' + err.message });

      const proceed = (cust) => {
        const packageId   = uuidv4();
        const packageName = `FleetSync-${customerId}-${Date.now()}`;
        const now         = new Date().toISOString();

        // Record the package (non-fatal if installer_packages table has issues)
        db.run(
          `INSERT INTO installer_packages
             (packageId, customerId, packageName, fileName, apiKey, apiUrl, createdAt, expiresAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))`,
          [packageId, customerId, packageName, packageName + '.zip', cust.apiKey, finalApiUrl, now],
          () => {}  // ignore errors
        );

        // Write config file to downloads folder (non-fatal)
        const configContent = {
          customerId,
          customerName:       cust.customerName || customerId,
          apiKey:             cust.apiKey,
          apiUrl:             finalApiUrl,
          collectionInterval: 60,
          packageId,
          createdAt:          now,
        };
        try {
          fs.writeFileSync(
            path.join(downloadPath, `${packageName}-config.json`),
            JSON.stringify(configContent, null, 2)
          );
        } catch (_) {}

        console.log(`[✓] Installer package created for ${customerId}`);
        res.json({ success: true, packageId, packageName, expiresIn: '7 days', configContent });
      };

      if (customer) {
        proceed(customer);
      } else {
        // Customer not in DB (e.g. seed/demo customer) — auto-create with new apiKey
        const newApiKey = crypto.randomBytes(32).toString('hex');
        const name      = customerName || customerId;
        db.run(
          `INSERT INTO customers (customerId, customerName, apiKey, createdAt, updatedAt)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
          [customerId, name, newApiKey],
          (insertErr) => {
            if (insertErr && !insertErr.message.includes('UNIQUE constraint')) {
              return res.status(500).json({ error: insertErr.message });
            }
            // Re-read to get the row (handles race condition with UNIQUE conflict)
            db.get('SELECT * FROM customers WHERE customerId = ?', [customerId], (_, row) => {
              proceed(row || { customerId, customerName: name, apiKey: newApiKey });
            });
          }
        );
      }
    });
  } catch (err) {
    console.error('[POST /api/installer/create]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});



app.get('/api/installer/download/:packageId', (req, res) => {
  try {
    const packageId = req.params.packageId;

    db.get('SELECT * FROM installer_packages WHERE packageId = ?', [packageId], (err, pkg) => {
      if (err || !pkg) {
        console.error('[ERROR]', err);
        return res.status(404).json({ error: 'Package not found or expired' });
      }

      // Check if expired
      const expiresAt = new Date(pkg.expiresAt);
      if (expiresAt < new Date()) {
        return res.status(410).json({ error: 'Package expired' });
      }

      // Update download count and last downloaded time
      db.run(
        'UPDATE installer_packages SET downloadCount = downloadCount + 1, lastDownloadedAt = CURRENT_TIMESTAMP WHERE packageId = ?',
        [packageId]
      );

      // In production, send actual compiled EXE with embedded config
      const configFileName = path.join(downloadPath, `${pkg.packageName}-config.json`);

      if (fs.existsSync(configFileName)) {
        res.download(configFileName, `${pkg.packageName}-config.json`);
      } else {
        // Generate config on the fly
        const configContent = {
          customerId: pkg.customerId,
          apiKey: pkg.apiKey,
          apiUrl: pkg.apiUrl,
          createdAt: pkg.createdAt
        };
        res.json(configContent);
      }
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/installer/packages/:customerId', (req, res) => {
  try {
    const customerId = req.params.customerId;

    db.all(
      'SELECT packageId, packageName, fileName, createdAt, downloadCount, lastDownloadedAt, expiresAt FROM installer_packages WHERE customerId = ? ORDER BY createdAt DESC',
      [customerId],
      (err, packages) => {
        if (err) {
          console.error('[ERROR]', err);
          return res.status(500).json({ error: 'Failed to fetch packages' });
        }
        res.json(packages || []);
      }
    );
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ========== COLLECTOR SCRIPT — public endpoint (no auth) ==========

app.get('/api/collector/script', (req, res) => {
  const scriptPath = path.join(__dirname, 'collector', 'fleetsync_collector.py');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="fleetsync_collector.py"');
    return res.sendFile(scriptPath);
  }
  res.status(404).json({ error: 'Collector script not found on server' });
});

// ========== WINDOWS ONE-CLICK INSTALLER ==========
// Returns a self-contained .bat that:
//   1. Self-elevates to Admin
//   2. Installs Python silently if missing
//   3. Embeds + writes the collector .py (base64)
//   4. Writes a pre-filled fleetsync_config.json
//   5. Installs pip deps silently
//   6. Builds a --windowed EXE (no console, runs in background)
//   7. Registers a Windows Scheduled Task (auto-start on logon)
//   8. Starts the collector immediately

app.get('/api/installer/windows/:customerId', async (req, res) => { // no auth — generates a client bat file
  try {
    const { customerId } = req.params;
    const apiUrl   = (req.query.apiUrl  || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const interval = parseInt(req.query.interval || '60', 10);

    // Try DB first, fall back to query params — works for seed/demo customers too
    const customer = await new Promise((resolve) => {
      db.get('SELECT * FROM customers WHERE customerId = ?', [customerId],
        (_err, row) => resolve(row || null));
    }).catch(() => null);

    // Resolve apiKey — create/update customer in DB so SNMP data will be accepted
    let apiKey   = customer?.apiKey || req.query.apiKey || null;
    const custName = ((customer?.customerName || req.query.customerName || customerId) + '')
                      .replace(/['"]/g, '');

    if (!apiKey || apiKey === 'API_KEY_NOT_SET') {
      apiKey = crypto.randomBytes(32).toString('hex');
    }

    if (!customer) {
      // Persist customer so the collector's POST /api/snmp-data is accepted
      db.run(
        `INSERT OR IGNORE INTO customers (customerId, customerName, apiKey, createdAt, updatedAt)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [customerId, custName, apiKey]
      );
    } else if (!customer.apiKey) {
      db.run('UPDATE customers SET apiKey = ? WHERE customerId = ?', [apiKey, customerId]);
    }
    const collId   = 'col-' + require('crypto').randomBytes(4).toString('hex');
    const safeId   = customerId.replace(/[^A-Za-z0-9_-]/g, '');
    const installDir = `C:\\FleetSync\\${safeId}`;

    // ── Read + base64-encode the collector script ──────────────────────────
    const scriptPath = path.join(__dirname, 'collector', 'fleetsync_collector.py');
    const scriptBuf  = fs.existsSync(scriptPath)
      ? fs.readFileSync(scriptPath)
      : Buffer.from('# collector script not found on server\n');
    const scriptB64  = scriptBuf.toString('base64');
    // Split into 76-char lines for safe batch echo
    const scriptLines = scriptB64.match(/.{1,76}/g) || [];

    // ── Build config JSON + base64-encode it ──────────────────────────────
    const config = {
      apiUrl, customerId, apiKey,
      collectorId: collId,
      intervalSeconds: interval,
      devices: []
    };
    const configBuf  = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
    const configB64  = configBuf.toString('base64');
    const configLines = configB64.match(/.{1,76}/g) || [];

    // ── Generate echo lines for both files ────────────────────────────────
    const scriptEchoLines  = scriptLines.map(l  => `echo ${l}`).join('\r\n');
    const configEchoLines  = configLines.map(l  => `echo ${l}`).join('\r\n');

    // ── Assemble the batch file ─────────────────────────────────────────
    const bat = `@echo off
setlocal enabledelayedexpansion

:: ── Self-elevate to Administrator ──────────────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Start-Process -FilePath '\"'%~f0'\"' -Verb RunAs -Wait"
    exit /b
)

title FleetSync Pro Setup — ${custName}
color 0A
echo.
echo  ====================================================
echo   FleetSync Pro — Windows Collector Setup
echo   Customer : ${custName} (${customerId})
echo   Server   : ${apiUrl}
echo  ====================================================
echo.

:: ── Create install folder ──────────────────────────────────────────────────
set "DIR=${installDir}"
if not exist "%DIR%" mkdir "%DIR%"
echo  [INFO] Folder: %DIR%
echo.

:: ── Check / install Python ─────────────────────────────────────────────────
echo  [1/5] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  Python not found. Installing silently via winget...
    winget install -e --id Python.Python.3.11 --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
    if errorlevel 1 (
        echo  [!] winget install failed. Please install Python 3 manually:
        echo      https://www.python.org/downloads
        echo      IMPORTANT: Check "Add Python to PATH" during install.
        echo      Then re-run this file.
        pause & exit /b 1
    )
    :: Refresh PATH in current session
    for /f "tokens=*" %%i in ('where python 2^>nul') do set "PYEXE=%%i"
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  [OK] %%v

:: ── Write collector script (base64 → temp file → decode) ──────────────────
echo  [2/5] Writing collector script...
> "%TEMP%\\fs_script.b64" (
${scriptEchoLines}
)
powershell -NoProfile -Command ^
  "$b64=[string]::Concat([IO.File]::ReadAllLines('%TEMP%\\fs_script.b64'));" ^
  "[IO.File]::WriteAllBytes('%DIR%\\fleetsync_collector.py',[Convert]::FromBase64String($b64))"
del "%TEMP%\\fs_script.b64" 2>nul
if not exist "%DIR%\\fleetsync_collector.py" (
    echo  [ERROR] Failed to write collector script.
    pause & exit /b 1
)
echo  [OK] Collector script written

:: ── Write config JSON (base64 → temp file → decode) ──────────────────────
echo  [3/5] Writing configuration...
> "%TEMP%\\fs_config.b64" (
${configEchoLines}
)
powershell -NoProfile -Command ^
  "$b64=[string]::Concat([IO.File]::ReadAllLines('%TEMP%\\fs_config.b64'));" ^
  "[IO.File]::WriteAllBytes('%DIR%\\fleetsync_config.json',[Convert]::FromBase64String($b64))"
del "%TEMP%\\fs_config.b64" 2>nul
echo  [OK] Config written — edit %DIR%\\fleetsync_config.json to add copier IPs

:: ── Install Python packages ────────────────────────────────────────────────
echo.
echo  [4/5] Installing packages (takes 1-2 min)...
pip install pysnmp requests schedule pyinstaller --quiet --disable-pip-version-check
echo  [OK] Packages installed

:: ── Build silent background EXE ───────────────────────────────────────────
echo.
echo  [5/5] Building background EXE...
cd /d "%DIR%"
pyinstaller --onefile --windowed --name FleetSync_Collector --distpath "%DIR%" "%DIR%\\fleetsync_collector.py" >nul 2>&1
if exist "%DIR%\\FleetSync_Collector.exe" (
    echo  [OK] FleetSync_Collector.exe built  (no console window, runs silently)
) else (
    echo  [WARN] PyInstaller build skipped — will run via pythonw instead
)

:: ── Cleanup PyInstaller temp ───────────────────────────────────────────────
if exist "%DIR%\\build"                       rmdir /s /q "%DIR%\\build"       2>nul
if exist "%DIR%\\FleetSync_Collector.spec"    del /q "%DIR%\\FleetSync_Collector.spec" 2>nul
if exist "%DIR%\\__pycache__"                 rmdir /s /q "%DIR%\\__pycache__" 2>nul

:: ── Determine what to run ─────────────────────────────────────────────────
if exist "%DIR%\\FleetSync_Collector.exe" (
    set "RUNNER=%DIR%\\FleetSync_Collector.exe"
) else (
    set "RUNNER=pythonw.exe %DIR%\\fleetsync_collector.py"
)

:: ── Register Windows Scheduled Task (auto-start on logon) ─────────────────
echo.
echo  Registering auto-start scheduled task...
set "TASKNAME=FleetSync Collector - ${safeId}"
schtasks /delete /tn "%TASKNAME%" /f >nul 2>&1
schtasks /create /tn "%TASKNAME%" /tr "\\"%RUNNER%\\"" /sc onlogon /delay 0001:00 /ru "%USERNAME%" /f >nul 2>&1
if errorlevel 1 (
    :: fallback — run at system start
    schtasks /create /tn "%TASKNAME%" /tr "\\"%RUNNER%\\"" /sc onstart /f >nul 2>&1
)
echo  [OK] Task registered: %TASKNAME%
echo  [OK] Collector will auto-start whenever this PC logs in

:: ── Start collector immediately in background ─────────────────────────────
echo.
echo  Starting collector in background...
if exist "%DIR%\\FleetSync_Collector.exe" (
    start "" /B "%DIR%\\FleetSync_Collector.exe"
) else (
    start "" /B pythonw.exe "%DIR%\\fleetsync_collector.py"
)
timeout /t 3 /nobreak >nul

echo.
echo  ====================================================
echo   SETUP COMPLETE
echo  ====================================================
echo.
echo   Install  : %DIR%
echo   Config   : %DIR%\\fleetsync_config.json
echo   Log file : %DIR%\\fleetsync_collector.log
echo   Interval : ${interval}s
echo.
echo   IMPORTANT NEXT STEP:
echo   Open %DIR%\\fleetsync_config.json
echo   and add your copier IP addresses under "devices"
echo   Example:
echo     "devices": [
echo       { "ip": "192.168.1.50", "name": "Reception Copier",
echo         "community": "public", "location": "Reception" }
echo     ]
echo.
echo   Then restart:  double-click FleetSync_Collector.exe
echo   View logs  :   notepad %DIR%\\fleetsync_collector.log
echo   Stop       :   Task Manager ^> FleetSync_Collector
echo.
pause
endlocal
`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="FleetSync_Setup_${safeId}.bat"`);
    res.send(bat);

  } catch (err) {
    console.error('[INSTALLER ERROR]', err);
    res.status(500).json({ error: 'Failed to generate installer' });
  }
});

// ========== SNMP COLLECTOR BULK ENDPOINT ==========
// Called by fleetsync_collector.py on each collection cycle
// Auth: X-API-Key header (the per-customer API key)

app.post('/api/snmp-data', async (req, res) => {
  try {
    const { customerId, apiKey, devices, collectorId, timestamp } = req.body;

    if (!customerId || !apiKey || !Array.isArray(devices)) {
      return res.status(400).json({ error: 'customerId, apiKey and devices[] required' });
    }

    // Validate API key
    const customer = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM customers WHERE customerId = ? AND apiKey = ?', [customerId, apiKey], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!customer) {
      return res.status(401).json({ error: 'Invalid API key or customer ID' });
    }

    const now = new Date().toISOString();
    let processed = 0;

    for (const d of devices) {
      try {
        const ip = d.ipAddress || d.ip;
        if (!ip) continue;

        // Upsert device
        const existingDevice = await new Promise((resolve, reject) => {
          db.get('SELECT deviceId FROM devices WHERE ipAddress = ? AND customerId = ?', [ip, customerId], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });

        let deviceId = existingDevice?.deviceId;

        if (!deviceId) {
          deviceId = d.deviceId || `dev-${ip.replace(/\./g, '-')}-${uuidv4().slice(0, 8)}`;
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT OR IGNORE INTO devices
                (deviceId, customerId, name, model, location, ipAddress, serialNumber, snmpCommunity, isActive, addedDate)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
              [deviceId, customerId, d.name || ip, d.model || 'Unknown', d.location || 'Customer Site',
               ip, d.serialNumber || null, d.snmpCommunity || d.community || 'public', now],
              (err) => { if (err) reject(err); else resolve(); }
            );
          });
        } else {
          // Update last seen
          db.run('UPDATE devices SET name=COALESCE(?,name), model=COALESCE(?,model) WHERE deviceId=?',
            [d.name || null, d.model || null, deviceId]);
        }

        // Insert metric
        const metricId = uuidv4();
        const metric = {
          metricId,
          deviceId,
          customerId,
          timestamp:          d.timestamp || now,
          pageCount:          d.pageCount          || 0,
          bwPageCount:        d.bwPageCount        || 0,
          colorPageCount:     d.colorPageCount     || 0,
          tonerLevelBlack:    d.tonerLevelBlack    ?? d.tonerBlackPct    ?? 0,
          tonerLevelCyan:     d.tonerLevelCyan     ?? d.tonerCyanPct     ?? 0,
          tonerLevelMagenta:  d.tonerLevelMagenta  ?? d.tonerMagentaPct  ?? 0,
          tonerLevelYellow:   d.tonerLevelYellow   ?? d.tonerYellowPct   ?? 0,
          drumYieldBlack:     d.drumYieldBlack     ?? 0,
          drumYieldCyan:      d.drumYieldCyan      ?? 0,
          drumYieldMagenta:   d.drumYieldMagenta   ?? 0,
          drumYieldYellow:    d.drumYieldYellow    ?? 0,
          fuserUnitYield:     d.fuserUnitYield     ?? 0,
          temperature:        d.temperature        ?? 0,
          isOnline:           d.isOnline !== false ? 1 : 0,
          errorCode:          d.errorCode          || null,
          errorDescription:   d.errorDescription   || null,
          serviceCode:        null,
          serviceMessage:     null,
          lastSeenOnline:     d.isOnline !== false ? now : null,
          lastSeenOffline:    d.isOnline === false  ? now : null,
        };

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO metrics (
              metricId, deviceId, customerId, timestamp, pageCount, bwPageCount, colorPageCount,
              tonerLevelBlack, tonerLevelCyan, tonerLevelMagenta, tonerLevelYellow,
              drumYieldBlack, drumYieldCyan, drumYieldMagenta, drumYieldYellow,
              fuserUnitYield, temperature, isOnline, errorCode, errorDescription,
              serviceCode, serviceMessage, lastSeenOnline, lastSeenOffline
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [metric.metricId, metric.deviceId, metric.customerId, metric.timestamp,
             metric.pageCount, metric.bwPageCount, metric.colorPageCount,
             metric.tonerLevelBlack, metric.tonerLevelCyan, metric.tonerLevelMagenta, metric.tonerLevelYellow,
             metric.drumYieldBlack, metric.drumYieldCyan, metric.drumYieldMagenta, metric.drumYieldYellow,
             metric.fuserUnitYield, metric.temperature, metric.isOnline,
             metric.errorCode, metric.errorDescription, metric.serviceCode, metric.serviceMessage,
             metric.lastSeenOnline, metric.lastSeenOffline],
            (err) => { if (err) reject(err); else resolve(); }
          );
        });

        // Update device_status
        db.run(
          `INSERT OR REPLACE INTO device_status (deviceId, customerId, isCurrentlyOnline, lastOnlineTime, lastOfflineTime, consecutiveFailures, updatedAt)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [deviceId, customerId, metric.isOnline, metric.isOnline ? now : null, metric.isOnline ? null : now, now]
        );

        // Smart alert engine
        if (metric.tonerLevelBlack   <= 15) createAlertIfNeeded(deviceId, customerId, 'High',     'LOW_BLACK_TONER',   `Black toner at ${metric.tonerLevelBlack}%`);
        if (metric.tonerLevelCyan    <= 15) createAlertIfNeeded(deviceId, customerId, 'High',     'LOW_CYAN_TONER',    `Cyan toner at ${metric.tonerLevelCyan}%`);
        if (metric.tonerLevelMagenta <= 15) createAlertIfNeeded(deviceId, customerId, 'High',     'LOW_MAGENTA_TONER', `Magenta toner at ${metric.tonerLevelMagenta}%`);
        if (metric.tonerLevelYellow  <= 15) createAlertIfNeeded(deviceId, customerId, 'High',     'LOW_YELLOW_TONER',  `Yellow toner at ${metric.tonerLevelYellow}%`);
        if (metric.drumYieldBlack    <= 20) createAlertIfNeeded(deviceId, customerId, 'Medium',   'BLACK_DRUM_LOW',    `Black drum at ${metric.drumYieldBlack}%`);
        if (metric.fuserUnitYield    <= 15) createAlertIfNeeded(deviceId, customerId, 'Critical', 'FUSER_LOW',         `Fuser life at ${metric.fuserUnitYield}%`);
        if (!metric.isOnline)              createAlertIfNeeded(deviceId, customerId, 'Critical', 'DEVICE_OFFLINE',    'Device is offline');

        processed++;
        console.log(`[SNMP-DATA] ${d.name || ip} → K:${metric.tonerLevelBlack}% C:${metric.tonerLevelCyan}% M:${metric.tonerLevelMagenta}% Y:${metric.tonerLevelYellow}% ${metric.isOnline ? 'ONLINE' : 'OFFLINE'}`);

      } catch (devErr) {
        console.error(`[SNMP-DATA] Device error for ${d.ipAddress}:`, devErr.message);
      }
    }

    res.json({ success: true, customerId, processed, total: devices.length });

  } catch (err) {
    console.error('[SNMP-DATA ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ========== TEST CONNECTION (public) ==========
app.get('/api/test-connection', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), version: '2.0.0' });
});

// ========== HEALTH CHECK ==========

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/version', (req, res) => {
  res.json({
    name: 'FleetSync Pro API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========== UTILITIES ==========

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ======================================
// DEVICE METRICS
// ======================================

app.get("/api/devices/:id/latest-metrics", (req, res) => {

  db.get(
    `
    SELECT *
    FROM metrics
    WHERE deviceId = ?
    ORDER BY timestamp DESC
    LIMIT 1
    `,
    [req.params.id],
    (err, row) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json(row);
    }
  );

});

app.get(
  '/api/metrics/:deviceId/history',
  (req, res) => {

    db.all(
      `
      SELECT *
      FROM metrics_history
      WHERE deviceId = ?
      ORDER BY timestamp ASC
      LIMIT 500
      `,
      [req.params.deviceId],
      (err, rows) => {

        if (err) {
          return res.status(500).json(err);
        }

        res.json(rows);

      }
    );

  }
);

// ========== ERROR HANDLERS ==========

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ========== PRODUCTION: SERVE REACT BUILD ==========
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'client', 'build');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get(/^\/(?!api|downloads)/, (_req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
    console.log('[✓] Serving React build from client/build/');
  } else {
    console.warn('[WARN] client/build not found — run: cd client && npm run build');
  }
}


app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});
// ========== STARTUP ==========



async function seedCustomerApiKeys() {
  return new Promise((resolve) => {
    db.all('SELECT customerId FROM customers WHERE apiKey IS NULL', [], (err, rows) => {
      if (err || !rows || rows.length === 0) return resolve();
      const crypto = require('crypto');
      rows.forEach(row => {
        db.run('UPDATE customers SET apiKey = ? WHERE customerId = ?',
          [crypto.randomBytes(20).toString('hex'), row.customerId],
          (err) => { if (err) console.warn('[seedApiKey]', err.message); });
      });
      console.log(`[✓] Generated API keys for ${rows.length} customer(s)`);
      resolve();
    });
  });
}

async function seedAdminUser() {
  const email    = process.env.ADMIN_EMAIL    || 'admin@fleetsync.pro';
  const password = process.env.ADMIN_PASSWORD || 'FleetSync2024!';

  return new Promise((resolve) => {
    db.get('SELECT userId FROM users WHERE role = ?', ['it_manager'], (err, row) => {
      if (row) { console.log('[✓] Admin account already exists'); return resolve(); }

      bcrypt.hash(password, 10).then(hash => {
        db.run(
          `INSERT OR IGNORE INTO users (userId, email, passwordHash, role, customerId)
           VALUES (?, ?, ?, 'it_manager', NULL)`,
          [uuidv4(), email, hash],
          (insertErr) => {
            if (insertErr) console.error('[WARN] Could not seed admin:', insertErr.message);
            else console.log(`[✓] IT Manager account seeded: ${email}`);
            resolve();
          }
        );
      });
    });
  });
}

async function start() {
  try {
    await initializeDatabase();
    await seedAdminUser();
    await seedCustomerApiKeys();
    app.listen(PORT, () => {
      console.log(`\n╔════════════════════════════════════════════════════════╗`);
      console.log(`║     FleetSync Backend API v1.0                         ║`);
      console.log(`║     Production-Ready with Client EXE Generation        ║`);
      console.log(`╚════════════════════════════════════════════════════════╝`);
      console.log(`[✓] Server running on http://localhost:${PORT}`);
      console.log(`[✓] Database: ${dbPath}`);
      console.log(`[✓] Downloads: ${downloadPath}`);
      console.log(`[✓] Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('[FATAL] Failed to start:', err);
    process.exit(1);
  }
}


start();

module.exports = app;