// Lightweight standalone Wake on LAN server for Raspberry Pi or other lightweight Linux devices
const express = require('express');
const cors = require('cors');
const wol = require('wake_on_lan');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
const DEVICES_FILE = path.join(__dirname, 'devices.json');

// Basic configuration
app.use(express.json());

// Configure CORS with specific origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Simple authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).send({ error: 'Authentication required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // We're not querying a database here, just checking if the token is valid
    // In a production environment, you might want to implement a proper user system
    req.user = { id: decoded.id };
    req.token = token;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Authentication failed' });
  }
};

// Utility function to read devices from file
const readDevices = async () => {
  try {
    const data = await fs.readFile(DEVICES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

// Utility function to write devices to file
const writeDevices = async (devices) => {
  await fs.writeFile(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf8');
};

// Status endpoint
app.get('/api/status', (req, res) => {
  res.send({
    status: 'online',
    message: 'WOL Server is running',
    version: '1.0.0'
  });
});

// Network scanning endpoint
app.get('/api/network/scan', auth, async (req, res) => {
  try {
    let discoveredDevices = [];
    
    // Only proceed for Linux or Mac
    const platform = os.platform();
    if (platform !== 'linux' && platform !== 'darwin') {
      return res.status(400).send({ error: 'Unsupported operating system' });
    }
    
    try {
      // Prefer arp-scan if available
      try {
        const arpScan = execSync('arp-scan -l').toString();
        const lines = arpScan.split('\n');
        
        for (const line of lines) {
          // Parse arp-scan output
          const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]+)/i);
          if (match) {
            discoveredDevices.push({
              ipAddress: match[1],
              macAddress: match[2],
              isOnline: true,
              name: `Device (${match[1]})` // Optional: provide a default name
            });
          }
        }
      } catch (arpScanErr) {
        // Fallback to arp command
        const arpTable = execSync('arp -a').toString();
        const lines = arpTable.split('\n');
        
        for (const line of lines) {
          // Parse arp -a output
          const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]+)/i);
          if (match) {
            const mac = match[2].replace(/-/g, ':');
            discoveredDevices.push({
              ipAddress: match[1],
              macAddress: mac,
              isOnline: true,
              name: `Device (${match[1]})` // Optional: provide a default name
            });
          }
        }
      }
      
      res.send(discoveredDevices);
    } catch (err) {
      console.error('Network scan error:', err);
      res.status(500).send({ 
        error: 'Failed to perform network scan',
        details: err.message 
      });
    }
  } catch (error) {
    console.error('Complete network scan error:', error);
    res.status(500).send({ error: error.message });
  }
});

// Devices endpoint - List all devices
app.get('/api/devices', auth, async (req, res) => {
  try {
    const devices = await readDevices();
    res.send(devices);
  } catch (error) {
    console.error('Error reading devices:', error);
    res.status(500).send({ error: 'Failed to retrieve devices' });
  }
});

// Add a new device
app.post('/api/devices', auth, async (req, res) => {
  try {
    const { name, macAddress, ipAddress, tags = [] } = req.body;
    
    // Validate required fields
    if (!macAddress) {
      return res.status(400).send({ error: 'MAC address is required' });
    }
    
    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).send({ error: 'Invalid MAC address format' });
    }
    
    // Read existing devices
    const devices = await readDevices();
    
    // Check if device already exists
    const existingDeviceIndex = devices.findIndex(
      d => d.macAddress.toLowerCase() === macAddress.toLowerCase()
    );
    
    if (existingDeviceIndex !== -1) {
      // Update existing device
      devices[existingDeviceIndex] = {
        ...devices[existingDeviceIndex],
        name: name || devices[existingDeviceIndex].name,
        ipAddress: ipAddress || devices[existingDeviceIndex].ipAddress,
        tags: [...new Set([...devices[existingDeviceIndex].tags, ...tags])]
      };
    } else {
      // Add new device
      devices.push({
        id: Date.now().toString(), // Simple unique ID
        name: name || `Device (${macAddress})`,
        macAddress,
        ipAddress,
        tags,
        isOnline: false,
        createdAt: new Date().toISOString()
      });
    }
    
    // Write updated devices
    await writeDevices(devices);
    
    // Return the added/updated device
    const savedDevice = devices.find(
      d => d.macAddress.toLowerCase() === macAddress.toLowerCase()
    );
    
    res.status(201).send(savedDevice);
  } catch (error) {
    console.error('Error adding device:', error);
    res.status(500).send({ error: 'Failed to add device' });
  }
});

// Update a device
app.patch('/api/devices/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    // Read existing devices
    const devices = await readDevices();
    
    // Find the device
    const deviceIndex = devices.findIndex(d => d.id === id);
    
    if (deviceIndex === -1) {
      return res.status(404).send({ error: 'Device not found' });
    }
    
    // Update device
    devices[deviceIndex] = {
      ...devices[deviceIndex],
      ...updateFields
    };
    
    // Write updated devices
    await writeDevices(devices);
    
    res.send(devices[deviceIndex]);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).send({ error: 'Failed to update device' });
  }
});

// Delete a device
app.delete('/api/devices/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Read existing devices
    let devices = await readDevices();
    
    // Filter out the device
    const initialLength = devices.length;
    devices = devices.filter(d => d.id !== id);
    
    if (devices.length === initialLength) {
      return res.status(404).send({ error: 'Device not found' });
    }
    
    // Write updated devices
    await writeDevices(devices);
    
    res.send({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).send({ error: 'Failed to delete device' });
  }
});

// Wake on LAN endpoint
app.post('/api/wake', auth, async (req, res) => {
  try {
    const { macAddress, broadcastAddress = '255.255.255.255', port = 9 } = req.body;
    
    if (!macAddress) {
      return res.status(400).send({ error: 'MAC address is required' });
    }
    
    // Validate MAC address format (basic validation)
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return res.status(400).send({ error: 'Invalid MAC address format' });
    }
    
    wol.wake(macAddress, {
      address: broadcastAddress,
      port: port
    }, (error) => {
      if (error) {
        return res.status(500).send({ error: 'Failed to send WOL packet' });
      }
      
      res.send({ 
        message: 'Wake packet sent successfully',
        macAddress,
        broadcastAddress,
        port 
      });
    });
  } catch (error) {
    console.error('Error sending wake packet:', error);
    res.status(500).send({ error: error.message });
  }
});

// Wake with device ID endpoint for compatibility with main app
app.post('/api/devices/:id/wake', auth, async (req, res) => {
  try {
    // Read devices to find the device by ID
    const devices = await readDevices();
    const device = devices.find(d => d.id === req.params.id);
    
    if (!device) {
      return res.status(404).send({ error: 'Device not found' });
    }
    
    wol.wake(device.macAddress, {
      address: device.broadcastAddress || '255.255.255.255',
      port: device.port || 9
    }, (error) => {
      if (error) {
        return res.status(500).send({ error: 'Failed to send WOL packet' });
      }
      
      res.send({ 
        message: 'Wake packet sent successfully',
        macAddress: device.macAddress,
        broadcastAddress: device.broadcastAddress || '255.255.255.255',
        port: device.port || 9
      });
    });
  } catch (error) {
    console.error('Error sending wake packet:', error);
    res.status(500).send({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`WOL Server running on port ${PORT}`);
});
