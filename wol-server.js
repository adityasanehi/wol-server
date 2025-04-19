// File: wol-server.js
// Lightweight standalone Wake on LAN server for Raspberry Pi or other lightweight Linux devices
const express = require('express');
const cors = require('cors');
const wol = require('wake_on_lan');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

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

// Status endpoint
app.get('/api/status', (req, res) => {
  res.send({
    status: 'online',
    message: 'WOL Server is running',
    version: '1.0.0'
  });
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
    // Since we don't have a database, we expect the device details in the request body
    const { macAddress, broadcastAddress = '255.255.255.255', port = 9 } = req.body;
    
    if (!macAddress) {
      return res.status(400).send({ error: 'MAC address is required' });
    }
    
    wol.wake(macAddress, {
      address: broadcastAddress,
      port
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

// Start server
app.listen(PORT, () => {
  console.log(`WOL Server running on port ${PORT}`);
});