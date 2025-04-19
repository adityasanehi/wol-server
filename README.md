# Wake on LAN Server for Raspberry Pi

A lightweight Wake on LAN server that can be installed on Raspberry Pi or other lightweight Linux devices.

## Features

- Simple REST API for sending Wake on LAN packets
- JWT authentication for security
- Small memory footprint
- Systemd service for automatic startup
- CORS configuration for connecting from web applications

## Requirements

- Raspberry Pi or other Linux device
- Node.js 12.x or higher
- Internet connection for installation
- The server must be on the same network as the devices you want to wake

## Installation

1. Download the latest release and extract it
2. Run the installer script:
```bash
chmod +x install.sh
./install.sh
```

3. Edit the configuration file:
```bash
sudo nano /opt/wol-server/.env
```

4. Set your JWT_SECRET and ALLOWED_ORIGINS in the .env file

## Manual Installation

If you prefer to install manually:

1. Install Node.js if not already installed
```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Create a directory for the server
```bash
sudo mkdir -p /opt/wol-server
```

3. Copy files and install dependencies
```bash
sudo cp wol-server.js package.json .env.example /opt/wol-server/
sudo mv /opt/wol-server/.env.example /opt/wol-server/.env
cd /opt/wol-server
npm install --production
```

4. Create and enable systemd service
```bash
sudo nano /etc/systemd/system/wol-server.service
# Copy the service configuration from install.sh
sudo systemctl daemon-reload
sudo systemctl enable wol-server
sudo systemctl start wol-server
```

## API Endpoints

### Check Status
```
GET /api/status
```
Returns the server status and version.

### Wake Device
```
POST /api/wake
Headers:
  Authorization: Bearer [JWT_TOKEN]
Body:
  {
    "macAddress": "00:11:22:33:44:55",
    "broadcastAddress": "255.255.255.255", (optional)
    "port": 9 (optional)
  }
```

## Integrating with the Main App

To use this WOL server with the main Wake on LAN web app:

1. In the main app, add your WOL server URL to the device settings
2. Generate a JWT token with your secret or use the same JWT_SECRET as your main app
3. Configure ALLOWED_ORIGINS to allow requests from your main app domain

## Troubleshooting

- Check if the service is running:
```bash
sudo systemctl status wol-server
```

- View logs:
```bash
sudo journalctl -u wol-server -f
```

- Test API directly:
```bash
curl -X GET http://localhost:8080/api/status
```

## License

MIT