#!/usr/bin/env bash
# Stops and removes only Lumi's containers and network. Data (database volume, backups, .env)
# is kept unless you pass --purge. Nothing else on the server is touched.
set -euo pipefail
LUMI_DIR=/opt/lumi
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
[ -f "$LUMI_DIR/docker-compose.yml" ] || { echo "Lumi is not installed in $LUMI_DIR." >&2; exit 1; }
docker compose -p lumi-vps --env-file "$LUMI_DIR/.env" -f "$LUMI_DIR/docker-compose.yml" down
if [ "${1:-}" = --purge ]; then
  read -r -p "Delete the Lumi database volume and $LUMI_DIR permanently? (type DELETE): " a </dev/tty
  if [ "$a" = DELETE ]; then
    docker volume rm lumi-vps-pgdata
    rm -rf "$LUMI_DIR"
    echo "Lumi data removed."
  fi
fi
echo "Lumi stopped."
