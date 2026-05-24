#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/allcare-medi}"
DATA_DIR="${DATA_DIR:-/opt/allcare-medi-data}"
ENV_DIR="${ENV_DIR:-/etc/allcaremedi}"
APP_USER="${APP_USER:-${SUDO_USER:-opc}}"
REPO_URL="${REPO_URL:-https://github.com/jjongsongsu-del/allcare-medi.git}"
API_DOMAIN="${API_DOMAIN:-131.186.26.5}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/oci/setup_ubuntu.sh"
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y git python3-venv python3-pip nginx curl
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git python3 python3-pip nginx curl
else
  echo "Unsupported Linux distribution. Install git, python3, pip, nginx, and curl first."
  exit 1
fi

mkdir -p "$APP_DIR" "$DATA_DIR" "$ENV_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR/server"
sudo -u "$APP_USER" python3 -m venv .venv
sudo -u "$APP_USER" .venv/bin/pip install --upgrade pip
sudo -u "$APP_USER" .venv/bin/pip install -r requirements.txt

if [[ ! -f "$ENV_DIR/server.env" ]]; then
  cp "$APP_DIR/deploy/oci/server.env.example" "$ENV_DIR/server.env"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=sqlite:///$DATA_DIR/allcaremedi.db|" "$ENV_DIR/server.env"
fi

cp "$APP_DIR/deploy/oci/allcaremedi.service" /etc/systemd/system/allcaremedi.service
sed -i "s/__APP_USER__/$APP_USER/g" /etc/systemd/system/allcaremedi.service
systemctl daemon-reload
systemctl enable --now allcaremedi

if [[ -d /etc/nginx/sites-available ]]; then
  cp "$APP_DIR/deploy/oci/nginx-allcaremedi.conf" /etc/nginx/sites-available/allcaremedi
  sed -i "s/131.186.26.5/$API_DOMAIN/g" /etc/nginx/sites-available/allcaremedi
  ln -sf /etc/nginx/sites-available/allcaremedi /etc/nginx/sites-enabled/allcaremedi
  rm -f /etc/nginx/sites-enabled/default
else
  cp "$APP_DIR/deploy/oci/nginx-allcaremedi.conf" /etc/nginx/conf.d/allcaremedi.conf
  sed -i "s/131.186.26.5/$API_DOMAIN/g" /etc/nginx/conf.d/allcaremedi.conf
fi
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "AllCareMedi server installed."
echo "Edit secrets: sudo nano $ENV_DIR/server.env"
echo "Restart API: sudo systemctl restart allcaremedi"
echo "Health local: curl http://127.0.0.1:8000/health"
echo "Health public: curl http://$API_DOMAIN/health"
