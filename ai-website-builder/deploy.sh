#!/bin/bash
set -e

echo "========================================="
echo "  AI Website Builder - Vultr Deployment"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy.sh"
  exit 1
fi

# Step 1: Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "[1/5] Installing Docker..."

  # Detect package manager
  if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  elif command -v dnf &> /dev/null; then
    # RHEL/CentOS/Fedora/AlmaLinux
    dnf install -y dnf-plugins-core
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || \
    dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
  elif command -v yum &> /dev/null; then
    # Older CentOS
    yum install -y yum-utils
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
  else
    echo "ERROR: Unsupported OS. Please install Docker manually:"
    echo "  https://docs.docker.com/engine/install/"
    exit 1
  fi

  echo "Docker installed."
else
  echo "[1/5] Docker already installed."
  # Make sure Docker is running
  systemctl start docker 2>/dev/null || true
fi

# Step 2: Create .env file if it doesn't exist
if [ ! -f .env.prod ]; then
  echo "[2/5] Creating .env.prod file..."

  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -hex 16)
  REDIS_PASSWORD=$(openssl rand -hex 16)

  cat > .env.prod <<EOF
# Database
DB_USER=builder
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=builder

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}

# Frontend URL (update with your domain or Vultr IP)
FRONTEND_URL=http://$(curl -s ifconfig.me)
NEXT_PUBLIC_API_URL=http://$(curl -s ifconfig.me)/api
EOF

  echo "Created .env.prod with generated secrets."
  echo "IMPORTANT: Edit .env.prod if you want to use a domain name."
else
  echo "[2/5] .env.prod already exists, skipping."
fi

# Step 3: Build containers
echo "[3/5] Building Docker containers (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# Step 4: Start services
echo "[4/5] Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Step 5: Wait for services and seed database
echo "[5/5] Waiting for API to be ready..."
sleep 10

# Check if API is healthy
for i in {1..30}; do
  if docker exec builder-api wget -q --spider http://localhost:4000/api/health 2>/dev/null; then
    echo "API is healthy!"
    break
  fi
  echo "Waiting for API... ($i/30)"
  sleep 5
done

# Seed the database
echo "Seeding database..."
docker exec builder-api npx prisma db seed || echo "Seed may have already been applied."

# Get the server IP
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  Your app is running at:"
echo "  http://${SERVER_IP}"
echo ""
echo "  Login: demo@example.com / demo1234"
echo ""
echo "  Useful commands:"
echo "  - View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  - Stop:         docker compose -f docker-compose.prod.yml down"
echo "  - Restart:      docker compose -f docker-compose.prod.yml restart"
echo ""
echo "  To set up SSL with a domain:"
echo "  1. Point your domain DNS to ${SERVER_IP}"
echo "  2. Edit nginx.conf - replace YOUR_DOMAIN with your domain"
echo "  3. Run: docker compose -f docker-compose.prod.yml exec certbot \\"
echo "     certbot certonly --webroot -w /var/www/certbot -d yourdomain.com"
echo "  4. Uncomment the HTTPS block in nginx.conf"
echo "  5. Restart nginx: docker compose -f docker-compose.prod.yml restart nginx"
echo "========================================="
