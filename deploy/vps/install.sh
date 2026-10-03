#!/usr/bin/env bash
# Lumi API + database installer for a shared VPS.
#
#   bash deploy/vps/install.sh        (run as root, from a clone of the repository)
#
# Safety rules this script follows:
#   - Everything lives in /opt/lumi and in Docker objects named lumi-vps*.
#   - No host ports are published; nginx, firewall, systemd and other containers are never touched.
#   - The only foreign objects it may delete are containers whose name or image matches
#     hermes|opencode|warp, and only after you confirm the exact list.
#   - Never runs any docker "prune" command.
# Re-running is safe: existing config and data are kept, images are updated.
set -euo pipefail

LUMI_DIR=/opt/lumi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose -p lumi-vps --env-file "$LUMI_DIR/.env" -f "$LUMI_DIR/docker-compose.yml")
JUNK_RE='hermes|open-?code|warp'
MIN_FREE_MB=700

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '\033[36m›\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Prompts read from the terminal even when the script itself is piped.
ask() { # ask VAR "question" [default]; skipped when VAR is already set in the environment
  local __var=$1 __q=$2 __def=${3:-} __ans=''
  if [ -n "${!__var:-}" ]; then return; fi
  if { exec 3</dev/tty; } 2>/dev/null; then
    read -r -p "$__q${__def:+ [$__def]}: " __ans <&3 || true
    exec 3<&-
  else
    printf '%s%s: ' "$__q" "${__def:+ [$__def]}" >&2
    read -r __ans || true
    echo >&2
  fi
  printf -v "$__var" '%s' "${__ans:-$__def}"
}
confirm() { # confirm "question" -> 0 on yes (default no)
  local a=''
  ask a "$1 (y/N)" N
  [[ "$a" =~ ^[Yy] ]]
}
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

# ---------------------------------------------------------------- preflight
bold "Lumi — VPS installer"
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo -i)."
command -v docker >/dev/null || die "Docker is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin is missing (docker compose)."
[ -f "$HERE/docker-compose.yml" ] || die "Run this from the repository (deploy/vps/docker-compose.yml not found)."

info "Memory / disk now:"
free -m | sed 's/^/    /'
df -h / | sed 's/^/    /'
info "Running containers (left untouched unless listed for removal below):"
docker ps --format '    {{.Names}}\t{{.Image}}\t{{.Status}}'

# ---------------------------------------------------------------- optional cleanup
mapfile -t JUNK < <(docker ps -a --format '{{.ID}} {{.Names}} {{.Image}}' | grep -Ei "$JUNK_RE" | grep -v 'lumi-vps' || true)
if [ "${#JUNK[@]}" -gt 0 ]; then
  bold "These containers match '$JUNK_RE' (hermes / opencode / warp):"
  for line in "${JUNK[@]}"; do
    read -r id name image <<<"$line"
    project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$id" 2>/dev/null || true)
    printf '    %-14s %-30s %s%s\n' "$id" "$name" "$image" "${project:+  (compose project: $project)}"
  done
  if [ "${LUMI_CLEANUP:-}" = yes ] || { [ "${LUMI_CLEANUP:-}" != no ] && confirm "Delete exactly these containers?"; }; then
    vols=() imgs=()
    for line in "${JUNK[@]}"; do
      read -r id name image <<<"$line"
      imgs+=("$(docker inspect -f '{{.Image}}' "$id")")
      while read -r v; do [ -n "$v" ] && vols+=("$v"); done < <(docker inspect -f '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{"\n"}}{{end}}{{end}}' "$id")
      docker rm -f "$id" >/dev/null && info "removed container $name"
    done
    for img in $(printf '%s\n' "${imgs[@]}" | sort -u); do
      if [ -z "$(docker ps -aq --filter "ancestor=$img")" ]; then
        docker rmi "$img" >/dev/null 2>&1 && info "removed image $img" || warn "kept image $img (in use or tagged elsewhere)"
      fi
    done
    if [ "${#vols[@]}" -gt 0 ]; then
      warn "Their data volumes: ${vols[*]}"
      if [ "${LUMI_CLEANUP_VOLUMES:-}" = yes ] || { [ "${LUMI_CLEANUP_VOLUMES:-}" != no ] && confirm "Also delete these volumes (their data is lost)?"; }; then
        for v in "${vols[@]}"; do
          if [ -z "$(docker ps -aq --filter "volume=$v")" ]; then docker volume rm "$v" >/dev/null && info "removed volume $v"; fi
        done
      fi
    fi
  else
    info "Cleanup skipped."
  fi
fi

avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
if [ "$avail" -lt "$MIN_FREE_MB" ] && [ -z "$(docker ps -q --filter name=lumi-vps-api)" ]; then
  warn "Only ${avail} MB RAM available; Lumi needs about ${MIN_FREE_MB} MB (postgres 256 + api 384 + tunnel 64)."
  [ "${LUMI_FORCE:-}" = yes ] || confirm "Continue anyway?" || die "Stopped to protect the existing services."
fi

# ---------------------------------------------------------------- config
mkdir -p "$LUMI_DIR/backups"
chmod 700 "$LUMI_DIR"
cp "$HERE/docker-compose.yml" "$LUMI_DIR/docker-compose.yml"

if [ ! -f "$LUMI_DIR/.env" ]; then
  bold "Configuration (saved to $LUMI_DIR/.env)"
  ask LUMI_API_DOMAIN "API hostname (the Cloudflare Tunnel public hostname)" lumi-api.beyondex.one
  ask LUMI_WEB_DOMAIN "Web app hostname (Vercel)" lumi.beyondex.one
  ask EXTRA_CORS_ORIGINS "Extra allowed web origin, e.g. https://lumi-xxx.vercel.app (optional)" ""
  ask TUNNEL_TOKEN "Cloudflare Tunnel token" ""
  [ -n "$TUNNEL_TOKEN" ] || die "A tunnel token is required (Cloudflare → Zero Trust → Networks → Tunnels)."
  ask TEAM_EMAILS "Team emails: Pouya, Amirhossein, Matin (comma separated)" "pouya@beyondex.io,amirhossein@beyondex.io,matin@beyondex.io"
  ask OPENAI_API_KEY "OpenAI API key (optional, Enter to skip)" ""
  ask OPENAI_BASE_URL "OpenAI-compatible base URL (a proxy if openai.com is blocked)" "https://api.openai.com/v1"
  ask LUMI_VERSION "Image version" latest
  umask 077
  cat >"$LUMI_DIR/.env" <<EOF
LUMI_API_DOMAIN=$LUMI_API_DOMAIN
LUMI_WEB_DOMAIN=$LUMI_WEB_DOMAIN
EXTRA_CORS_ORIGINS=$EXTRA_CORS_ORIGINS
TUNNEL_TOKEN=$TUNNEL_TOKEN
POSTGRES_PASSWORD=$(rand 32)
JWT_SECRET=$(rand 48)
ALLOW_SIGNUP=false
TEAM_EMAILS=$TEAM_EMAILS
OPENAI_API_KEY=$OPENAI_API_KEY
OPENAI_BASE_URL=$OPENAI_BASE_URL
LUMI_API_IMAGE=${LUMI_API_IMAGE:-ghcr.io/pouya-wp/lumi-api:$LUMI_VERSION}
EOF
  for v in LUMI_POSTGRES_IMAGE LUMI_CLOUDFLARED_IMAGE; do
    [ -n "${!v:-}" ] && echo "$v=${!v}" >>"$LUMI_DIR/.env"
  done
  info "Saved $LUMI_DIR/.env"
else
  info "Using existing $LUMI_DIR/.env"
fi

# ---------------------------------------------------------------- images
if [ "${LUMI_SKIP_PULL:-}" != yes ]; then
  info "Pulling images from ghcr.io…"
  if ! "${COMPOSE[@]}" pull; then
    warn "Pull failed. If the packages are private, log in with a GitHub token that has read:packages."
    ask GH_USER "GitHub username" ""
    ask GH_TOKEN "GitHub token" ""
    echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
    "${COMPOSE[@]}" pull
  fi
fi

# ---------------------------------------------------------------- start
info "Starting Lumi (no host ports are published)…"
"${COMPOSE[@]}" up -d --remove-orphans

info "Waiting for the API (runs database migrations on first start)…"
for i in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T api node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
[ "${ok:-}" = 1 ] || { "${COMPOSE[@]}" logs --tail 40 api; die "API did not become healthy."; }
info "API is healthy."

if [ ! -f "$LUMI_DIR/.seeded" ]; then
  info "Creating the Beyondex workspace and team accounts…"
  "${COMPOSE[@]}" exec -T api node dist/scripts/seed-team.js | tee "$LUMI_DIR/team-passwords.txt"
  chmod 600 "$LUMI_DIR/team-passwords.txt"
  touch "$LUMI_DIR/.seeded"
  warn "Passwords are also in $LUMI_DIR/team-passwords.txt — delete that file after sharing them."
fi

bold "Done."
"${COMPOSE[@]}" ps --format '    {{.Service}}\t{{.Status}}'
info "Tunnel log (look for 'Registered tunnel connection'):"
"${COMPOSE[@]}" logs --tail 5 tunnel | sed 's/^/    /' || true
cat <<EOF

  API:      https://$(grep '^LUMI_API_DOMAIN=' "$LUMI_DIR/.env" | cut -d= -f2)/api/docs
  Update:   cd $HERE/../.. && git pull && bash deploy/vps/install.sh
  Logs:     docker compose -p lumi-vps logs -f api
  Backups:  $LUMI_DIR/backups (daily)
  Remove:   bash deploy/vps/uninstall.sh   (keeps data unless --purge)
EOF
