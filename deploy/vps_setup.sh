#!/usr/bin/env bash
# ==============================================================================
# SKE Export Documents & Realisation Tracker - VPS Provisioning & Deployment Script
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS
# Self-hosted: 100% Local OCR & Document Extraction (Zero Cloud AI / Zero External APIs)
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting SKE Online Deployment Setup on Ubuntu VPS"
echo "=========================================================="

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (or with sudo)." >&2
    exit 1
fi

APP_DIR="/opt/ske-applet"
CURRENT_DIR="$(pwd)"

# 1. Update OS Packages
echo "--> Updating Ubuntu system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y --no-install-recommends \
    curl \
    git \
    ufw \
    ca-certificates \
    gnupg \
    lsb-release \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0

# 2. Install Docker & Docker Compose Plugin if not installed
if ! command -v docker &> /dev/null; then
    echo "--> Installing Docker Engine & Compose plugin..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
fi

# 3. Configure UFW Firewall
echo "--> Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# 4. Prepare Application Directory
echo "--> Setting up application files at ${APP_DIR}..."
mkdir -p "${APP_DIR}"
cp -ru "${CURRENT_DIR}"/* "${APP_DIR}/" || true
cd "${APP_DIR}"

# 5. Generate Production .env File
if [ ! -f .env ]; then
    echo "--> Generating secure random credentials for .env..."
    POSTGRES_PWD=$(openssl rand -hex 24)
    JWT_SECRET_KEY=$(openssl rand -hex 32)
    cat <<EOF > .env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://ske_user:${POSTGRES_PWD}@postgres:5432/ske_export_db?schema=public
POSTGRES_USER=ske_user
POSTGRES_PASSWORD=${POSTGRES_PWD}
POSTGRES_DB=ske_export_db
JWT_SECRET=${JWT_SECRET_KEY}
OCR_CONCURRENCY=2
MAX_OCR_FILE_SIZE_MB=50
EOF
    chmod 600 .env
fi

# 6. Generate Self-Signed SSL Certificate as Default Fallback
mkdir -p deploy/ssl/live
if [ ! -f deploy/ssl/live/fullchain.pem ]; then
    echo "--> Creating default self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout deploy/ssl/live/privkey.pem \
        -out deploy/ssl/live/fullchain.pem \
        -subj "/C=IN/ST=TamilNadu/L=Chennai/O=SKEnterprises/CN=localhost"
fi

# 7. Setup Automated Daily Backup Cron Job
echo "--> Registering daily backup cron job..."
chmod +x deploy/backup_storage.sh deploy/restore_storage.sh
cat <<EOF > /etc/cron.d/ske-backup
0 2 * * * root cd ${APP_DIR} && ./deploy/backup_storage.sh >> /var/log/ske-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/ske-backup

# 8. Build and Launch Containers
echo "--> Building production containers with native OCR and launching services..."
docker compose build --no-cache
docker compose up -d

echo "--> Waiting for application healthcheck..."
sleep 10
if curl -f http://localhost/health >/dev/null 2>&1 || docker compose exec -T app curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "=========================================================="
    echo " SKE Online VPS Deployment Successful!"
    echo " - HTTP/HTTPS Reverse Proxy: ACTIVE (Ports 80 / 443)"
    echo " - PostgreSQL Database: ACTIVE (Container: postgres)"
    echo " - Local Tesseract OCR & PyMuPDF Worker: ACTIVE"
    echo " - Nightly Backup Cron: 02:00 AM (/var/backups/ske)"
    echo " - Disaster Recovery Script: ACTIVE (${APP_DIR}/deploy/restore_storage.sh)"
    echo "=========================================================="
else
    echo "WARNING: Backend container still initializing. Check logs with 'docker compose logs -f app'."
fi
