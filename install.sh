#!/bin/bash

# WOL Server Installer for Raspberry Pi
echo "WOL Server Installer for Raspberry Pi"
echo "====================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Installing..."
  curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js is already installed."
fi

# Check Node.js version
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Create installation directory
INSTALL_DIR="/opt/wol-server"
echo "Creating installation directory: $INSTALL_DIR"
sudo mkdir -p $INSTALL_DIR

# Copy files
echo "Copying files..."
sudo cp wol-server.js $INSTALL_DIR/
sudo cp package.json $INSTALL_DIR/
sudo cp .env.example $INSTALL_DIR/.env

# Set correct permissions
echo "Setting permissions..."
sudo chown -R $USER:$USER $INSTALL_DIR

# Install dependencies
echo "Installing dependencies..."
cd $INSTALL_DIR
npm install --production

# Create systemd service
echo "Creating systemd service..."
SERVICE_FILE="/etc/systemd/system/wol-server.service"

sudo bash -c "cat > $SERVICE_FILE" << EOL
[Unit]
Description=Wake on LAN Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/wol-server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Configure service
echo "Configuring service..."
sudo systemctl daemon-reload
sudo systemctl enable wol-server
sudo systemctl start wol-server

# Get server IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')
PORT=$(grep PORT $INSTALL_DIR/.env | cut -d '=' -f2 || echo "8080")

echo ""
echo "======================================"
echo "Installation Complete!"
echo "Your WOL server is running at: http://$IP_ADDRESS:$PORT"
echo "Check status: sudo systemctl status wol-server"
echo "View logs: sudo journalctl -u wol-server -f"
echo ""
echo "Don't forget to edit the .env file to set your JWT_SECRET and ALLOWED_ORIGINS:"
echo "sudo nano $INSTALL_DIR/.env"
echo "======================================"
