#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status.

# Ensure we are in the script's directory (project root)
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}>>> Starting Deployment Script for Strong Character AI...${NC}"

# 1. System Check & Dependencies
echo -e "${YELLOW}[1/6] Checking system dependencies...${NC}"
if command -v apt-get >/dev/null; then
    echo "Detected apt-based system (Ubuntu/Debian/veLinux). Updating..."
    # sudo apt-get update -qq
    
    # Python dependencies
    if ! dpkg -s python3-venv >/dev/null 2>&1; then
        echo "Installing python3-venv..."
        sudo apt-get install -y python3-venv
    fi
    if ! dpkg -s python3-pip >/dev/null 2>&1; then
        echo "Installing python3-pip..."
        sudo apt-get install -y python3-pip
    fi
    if ! dpkg -s git >/dev/null 2>&1; then
        echo "Installing git..."
        sudo apt-get install -y git
    fi
    
    # Node.js dependencies (Check if node exists and version is recent enough, or just install)
    if ! command -v node >/dev/null; then
        echo "Installing Node.js (LTS)..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "Node.js is already installed: $(node -v)"
        # Check Node.js version, if too old (e.g. v12), update it
        NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo "Node.js version $NODE_VERSION is too old. Updating to LTS..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    fi
    
    # Ensure npm is installed (sometimes it's a separate package in some distros, though usually included with nodejs)
    if ! command -v npm >/dev/null; then
        echo "npm not found. Installing npm..."
        sudo apt-get install -y npm
    fi
else
    echo -e "${RED}Error: This script supports Ubuntu/Debian/veLinux (apt) only.${NC}"
    echo "Please install python3-venv, python3-pip, git, and nodejs manually."
    exit 1
fi

# 2. Frontend Build
echo -e "${YELLOW}[2/6] Building Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
echo "Building React app..."
npm run build
cd ..

# 3. Python Virtual Environment
echo -e "${YELLOW}[3/6] Setting up Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    echo "Creating venv..."
    python3 -m venv venv
else
    echo "venv already exists."
fi

# Use absolute path for python executable in venv
PROJECT_ROOT=$(pwd)
VENV_PYTHON="$PROJECT_ROOT/venv/bin/python"
VENV_PIP="$PROJECT_ROOT/venv/bin/pip"
VENV_GUNICORN="$PROJECT_ROOT/venv/bin/gunicorn"

# 4. Install Python Dependencies
echo -e "${YELLOW}[4/6] Installing Python requirements...${NC}"
$VENV_PIP install --upgrade pip
$VENV_PIP install --no-cache-dir -r backend/requirements.txt
# Ensure gunicorn and uvicorn are installed
$VENV_PIP install --no-cache-dir gunicorn uvicorn

# 5. Environment Configuration Check
echo -e "${YELLOW}[5/6] Checking configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with your API keys before running this script."
    exit 1
fi

# 6. Systemd Service Setup
echo -e "${YELLOW}[6/6] Configuring Systemd Service...${NC}"

SERVICE_TEMPLATE="strong_charactor.service"
TARGET_SERVICE_NAME="strong_charactor.service"
TARGET_SERVICE_PATH="/etc/systemd/system/$TARGET_SERVICE_NAME"

if [ ! -f "$SERVICE_TEMPLATE" ]; then
    echo -e "${RED}Error: $SERVICE_TEMPLATE template not found in current directory.${NC}"
    exit 1
fi

# Get current user to run the service
CURRENT_USER=$(whoami)
echo "Service will run as user: $CURRENT_USER"

# Create a temporary service file with correct paths and user
echo "Generating service configuration..."
cp $SERVICE_TEMPLATE "${SERVICE_TEMPLATE}.tmp"

# Replace placeholders using sed
# 1. Update WorkingDirectory
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PROJECT_ROOT|g" "${SERVICE_TEMPLATE}.tmp"
# 2. Update ExecStart (Use Gunicorn from venv, with Uvicorn worker)
sed -i "s|ExecStart=.*|ExecStart=$VENV_GUNICORN -k uvicorn.workers.UvicornWorker backend.app.main:app --bind 0.0.0.0:8000 --workers 1 --access-logfile - --error-logfile -|g" "${SERVICE_TEMPLATE}.tmp"
# 3. Update User
sed -i "s|User=.*|User=$CURRENT_USER|g" "${SERVICE_TEMPLATE}.tmp"
# 4. Update Group (Assume group is same as user, or 'users', or keep root if user is root)
# Simple approach: set Group to current user's primary group
CURRENT_GROUP=$(id -gn)
sed -i "s|Group=.*|Group=$CURRENT_GROUP|g" "${SERVICE_TEMPLATE}.tmp"
# 5. Update EnvironmentFile path
sed -i "s|EnvironmentFile=.*|EnvironmentFile=$PROJECT_ROOT/.env|g" "${SERVICE_TEMPLATE}.tmp"

echo "Installing service to $TARGET_SERVICE_PATH..."
sudo mv "${SERVICE_TEMPLATE}.tmp" "$TARGET_SERVICE_PATH"

# Reload systemd and enable service
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload
echo "Enabling $TARGET_SERVICE_NAME..."
sudo systemctl enable $TARGET_SERVICE_NAME
echo "Restarting $TARGET_SERVICE_NAME..."
sudo systemctl restart $TARGET_SERVICE_NAME

echo -e "${GREEN}>>> Deployment Complete!${NC}"
echo -e "Service status:"
sudo systemctl status $TARGET_SERVICE_NAME --no-pager | head -n 10
echo -e "\nTo view logs: journalctl -u $TARGET_SERVICE_NAME -f"
