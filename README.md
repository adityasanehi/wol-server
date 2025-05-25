# Wake on LAN Server for Raspberry Pi

A lightweight Wake on LAN server that can be installed on Raspberry Pi or other lightweight Linux devices.

## Features

- Simple REST API for sending Wake on LAN packets
- JWT authentication for security
- Small memory footprint
- Systemd service for automatic startup
- CORS configuration for connecting from web applications
- Device management with persistent storage
- Network scanning capabilities

## Requirements

- Raspberry Pi Zero 2W/3/4/5 or other lightweight Linux devices
- Node.js 12.x or higher
- Internet connection for installation
- The server must be on the same network as the devices you want to wake

## Installation

### Quick Install (Recommended)

Download and run the installer script from the latest release:

```bash
# Download the installer from the latest release
wget https://github.com/yourusername/wol-server/releases/latest/download/install.sh
chmod +x install.sh
./install.sh
```

### Specific Version Install

```bash
# Replace v1.0.0 with your desired version
wget https://github.com/yourusername/wol-server/releases/download/v1.0.0/install.sh
chmod +x install.sh
./install.sh
```

### Manual Installation

If you prefer to install manually:

1. **Install Node.js** (if not already installed):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Install arp-scan**:
```bash
sudo apt-get update
sudo apt-get install -y arp-scan
```

3. **Create installation directory**:
```bash
sudo mkdir -p /opt/wol-server
cd /opt/wol-server
```

4. **Download files from the latest release**:
```bash
# Replace v1.0.0 with the latest version
RELEASE_URL="https://github.com/yourusername/wol-server/releases/download/v1.0.0"
sudo wget "$RELEASE_URL/wol-server.js"
sudo wget "$RELEASE_URL/package.json"
sudo wget "$RELEASE_URL/.env.example" -O .env
```

5. **Set permissions and install dependencies**:
```bash
sudo chown -R $USER:$USER /opt/wol-server
npm install --production
```

6. **Create systemd service**:
```bash
sudo tee /etc/systemd/system/wol-server.service > /dev/null << EOL
[Unit]
Description=Wake on LAN Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/wol-server
ExecStart=/usr/bin/node /opt/wol-server/wol-server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL
```

7. **Enable and start the service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable wol-server
sudo systemctl start wol-server
```

## Configuration

After installation, edit the configuration file:

```bash
sudo nano /opt/wol-server/.env
```

Set your JWT_SECRET and ALLOWED_ORIGINS:

```env
PORT=8080
JWT_SECRET=your_very_secure_jwt_secret_here
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## API Endpoints

### Authentication
All endpoints except `/api/status` require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer your_jwt_token_here
```

### Check Status
```
GET /api/status
```
Returns the server status and version.

### Device Management

#### List All Devices
```
GET /api/devices
```

#### Add New Device
```
POST /api/devices
Content-Type: application/json
{
  "name": "My Computer",
  "macAddress": "00:11:22:33:44:55",
  "ipAddress": "192.168.1.100",
  "tags": ["desktop", "work"]
}
```

#### Update Device
```
PATCH /api/devices/{id}
Content-Type: application/json
{
  "name": "Updated Name"
}
```

#### Delete Device
```
DELETE /api/devices/{id}
```

### Wake Device

#### Wake by MAC Address
```
POST /api/wake
Content-Type: application/json
{
  "macAddress": "00:11:22:33:44:55",
  "broadcastAddress": "255.255.255.255",
  "port": 9
}
```

#### Wake by Device ID
```
POST /api/devices/{id}/wake
```

### Network Scanning
```
GET /api/network/scan
```
Scans the local network for devices and returns their IP and MAC addresses.

## Integrating with Web Applications

To use this WOL server with a web application:

1. Configure ALLOWED_ORIGINS in the .env file to include your web app's domain
2. Generate JWT tokens using the same JWT_SECRET
3. Make API calls to the server endpoints with proper authentication

Example JavaScript usage:
```javascript
// Wake a device
const response = await fetch('http://your-pi-ip:8080/api/wake', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_jwt_token'
  },
  body: JSON.stringify({
    macAddress: '00:11:22:33:44:55'
  })
});

const result = await response.json();
console.log(result.message);
```

## Troubleshooting

### Check Service Status
```bash
sudo systemctl status wol-server
```

### View Logs
```bash
sudo journalctl -u wol-server -f
```

### Test API Directly
```bash
# Check status
curl -X GET http://localhost:8080/api/status

# Test with authentication (replace YOUR_JWT_TOKEN)
curl -X POST http://localhost:8080/api/wake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"macAddress": "00:11:22:33:44:55"}'
```

### Common Issues

1. **Service won't start**: Check Node.js installation and file permissions
2. **Authentication errors**: Verify JWT_SECRET is set and tokens are valid
3. **CORS errors**: Add your domain to ALLOWED_ORIGINS in .env
4. **Network scan fails**: Ensure arp-scan is installed and user has proper permissions

### Updating

To update to a new version:
1. Stop the service: `sudo systemctl stop wol-server`
2. Download and run the new installer
3. The installer will preserve your .env configuration

## Development

### Running in Development Mode
```bash
npm install  # Include dev dependencies
npm run dev  # Uses nodemon for auto-restart
```

### Project Structure
```
wol-server/
├── wol-server.js     # Main server application
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
├── devices.json      # Device storage (created automatically)
└── README.md         # This file
```

## License

MIT License - see the full license in the repository.
