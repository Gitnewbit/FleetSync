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
  console.error('FATAL ERROR: JWT_SECRET is not defined');
  process.exit(1);
}
const dbPath = path.join(__dirname, 'fleetsync.db');
const downloadPath = path.join(__dirname, 'downloads');
let db;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8000'],
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
          apiKey TEXT UNIQUE,
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
        CREATE INDEX IF NOT EXISTS idx_metrics_device ON metrics(deviceId);
        CREATE INDEX IF NOT EXISTS idx_metrics_customer ON metrics(customerId);
        CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
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
    token,
    JWT_SECRET,
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

// Register User
app.post('/api/auth/register', async (req, res) => {

  try {

    const {
      email,
      password,
      role,
      customerId
    } = req.body;

    if (!email || !password) {

      return res.status(400).json({
        error: 'Email and password required'
      });

    }

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, existingUser) => {

        if (err) {

          console.error(err);

          return res.status(500).json({
            error: 'Database error'
          });

        }

        if (existingUser) {

          return res.status(400).json({
            error: 'User already exists'
          });

        }

        const passwordHash =
          await bcrypt.hash(password, 10);

        const userId =
          uuidv4();

        db.run(
          `
          INSERT INTO users
          (
            userId,
            email,
            passwordHash,
            role,
            customerId
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            userId,
            email,
            passwordHash,
            role || 'customer_admin',
            customerId || null
          ],
          function(insertErr) {

            if (insertErr) {

              console.error(insertErr);

              return res.status(500).json({
                error: 'Failed to create user'
              });

            }

            res.status(201).json({
              success: true,
              userId
            });

          }
        );

      }
    );

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Server error'
    });

  }

});

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
            JWT_SECRET,
            {
              expiresIn: '7d'
            }
          );

        res.json({
          success: true,
          token,
          user: {
            userId: user.userId,
            email: user.email,
            role: user.role,
            customerId: user.customerId
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
    const { customerId, customerName, contactEmail, contactPhone } = req.body;

    if (!customerId || !customerName) {
      return res.status(400).json({ error: 'customerId and customerName required' });
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const config = JSON.stringify({
      collectionInterval: 300,
      snmpTimeout: 5000,
      createdAt: new Date().toISOString()
    });

    const sql = `
      INSERT INTO customers (customerId, customerName, contactEmail, contactPhone, apiKey, config)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [customerId, customerName, contactEmail, contactPhone, apiKey, config], function(err) {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to create customer' });
      }
      res.status(201).json({
        success: true,
        customerId,
        apiKey,
        message: 'Customer created successfully'
      });
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
    db.run('DELETE FROM devices WHERE deviceId = ?', [req.params.deviceId], function(err) {
      if (err) {
        console.error('[ERROR]', err);
        return res.status(500).json({ error: 'Failed to delete device' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
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
        return res.status(500).json({ error: 'Failed to store metric' });
      }
      res.json({ success: true, metricId: metric.metricId });
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
    const { customerId, apiUrl } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }

    // Get customer details
    db.get('SELECT * FROM customers WHERE customerId = ?', [customerId], (err, customer) => {
      if (err || !customer) {
        console.error('[ERROR]', err);
        return res.status(404).json({ error: 'Customer not found' });
      }

      const packageId = uuidv4();
      const packageName = `FleetSync-${customerId}-${Date.now()}`;
      const fileName = `${packageName}.zip`;
      const finalApiUrl = apiUrl || 'https://fleetsync-api.azurewebsites.net';

      const sql = `
        INSERT INTO installer_packages (packageId, customerId, packageName, fileName, apiKey, apiUrl, createdAt, expiresAt)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+7 days'))
      `;

      db.run(sql, [packageId, customerId, packageName, fileName, customer.apiKey, finalApiUrl], function(err) {
        if (err) {
          console.error('[ERROR]', err);
          return res.status(500).json({ error: 'Failed to create installer package' });
        }

        // Generate config file content
        const configContent = {
          customerId: customerId,
          customerName: customer.customerName,
          contactEmail: customer.contactEmail,
          contactPhone: customer.contactPhone,
          apiKey: customer.apiKey,
          apiUrl: finalApiUrl,
          collectionInterval: 300,
          snmpTimeout: 5000,
          packageId: packageId,
          createdAt: new Date().toISOString()
        };

        // In production, you would generate the actual EXE here
        // For now, we'll create a configuration file that can be embedded in the EXE
        const configFileName = path.join(downloadPath, `${packageName}-config.json`);
        fs.writeFileSync(configFileName, JSON.stringify(configContent, null, 2));

        res.json({
          success: true,
          packageId,
          packageName,
          downloadUrl: `/api/installer/download/${packageId}`,
          expiresIn: '7 days',
          configContent
        });
      });
    });
  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Server error' });
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

// ========== ERROR HANDLERS ==========

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ========== STARTUP ==========

async function start() {
  try {
    await initializeDatabase();
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