#!/usr/bin/env bash
#
# TGT E6330 install / verify — version-controls the rig-side state of the
# gig-command listener stack, the boot-to-Reaper kiosk wiring, the Reaper
# project template, and the Mixing Station desktop app (S160).
#
# Run modes:
#   install.sh install   Copy all files into their runtime locations + reload
#                        systemd + enable gig-command-server.service + install
#                        default-jre + download pinned Mixing Station JAR.
#                        Prompts for sudo when needed (root-owned destinations).
#   install.sh verify    Checks each runtime file exists AND its sha256 matches
#                        the repo source. Read-only. Exits non-zero if any
#                        mismatch.
#
# Run on E6330. From OptiPlex you can drive it via:
#   rsync -a /c/Apps/TGT/ tangerine@e6330:~/TGT/  # or git clone there
#   ssh tangerine@e6330 'cd ~/TGT && bash tools/e6330/install.sh install'
#
# Per S140 (Task #0 of S136 sequencing). Closes harness assert A.5.
# Companion docs:
#   - audit/shared/S140-RIG-INSTALL-RESULTS.md (in Dev Team repo)
#   - tools/post-prod/README.md (Files + Deploy table)

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Mixing Station pinned version (S160) ───────────────────────────────────
# Bump by changing this single line; verify will flag a mismatch if the JAR
# on disk reports a different version in its filename marker.
# Upstream archive URL pattern (Cloudflare-cached, content-addressable):
#   https://mixingstation.app/backend/api/web/download/archive/mixing-station-pc/update/<VERSION>
readonly MS_VERSION="2.9.3"
readonly MS_INSTALL_DIR="/opt/tgt/mixing-station"
readonly MS_JAR="$MS_INSTALL_DIR/mixing-station-desktop.jar"
readonly MS_VERSION_MARKER="$MS_INSTALL_DIR/.version"
readonly MS_DOWNLOAD_URL="https://mixingstation.app/backend/api/web/download/archive/mixing-station-pc/update/$MS_VERSION"

# ── Colour-codes for output ────────────────────────────────────────────────
RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'

# ── File mapping table ─────────────────────────────────────────────────────
# Each row: <repo-relative source> | <runtime destination> | <user-or-root>
#
# user destinations live under $HOME (resolved at runtime).
# root destinations are absolute paths.
readonly FILES=(
  "tools/post-prod/gig-command-listener.lua|HOME/.config/REAPER/Scripts/TGT/gig-command-listener.lua|user"
  "tools/post-prod/song-marker-listener.lua|HOME/.config/REAPER/Scripts/TGT/song-marker-listener.lua|user"
  "tools/post-prod/tgt-record-at-end.lua|HOME/.config/REAPER/Scripts/tgt-record-at-end.lua|user"
  "tools/post-prod/tgt-gig-and-practice.RPP|HOME/.config/REAPER/ProjectTemplates/tgt-gig-and-practice.RPP|user"
  "tools/e6330/rig-files/REAPER-Scripts/__startup.lua|HOME/.config/REAPER/Scripts/__startup.lua|user"
  "tools/e6330/rig-files/openbox/autostart|HOME/.config/openbox/autostart|user"
  "tools/e6330/rig-files/profile/.profile|HOME/.profile|user"
  "tools/e6330/gig-command-server.py|/opt/tgt/gig-command-server.py|root"
  "tools/e6330/wifi-switcher.py|/opt/tgt/wifi-switcher.py|root"
  "tools/e6330/rig-files/mixing-station/launch.sh|/opt/tgt/mixing-station/launch.sh|root"
  "tools/e6330/gig-command-server.service|/etc/systemd/system/gig-command-server.service|root"
  "tools/e6330/rig-files/systemd/getty-autologin.conf|/etc/systemd/system/getty@tty1.service.d/autologin.conf|root"
)

resolve_dest() {
  local raw="$1"
  echo "${raw//HOME/$HOME}"
}

# ── Mixing Station — JRE + JAR install ─────────────────────────────────────
# Apt-installs default-jre (idempotent), then downloads the pinned JAR to
# /opt/tgt/mixing-station/ if missing or version-marker mismatched.
install_mixing_station() {
  echo
  echo "${BOLD}=== Mixing Station (v$MS_VERSION) ===${RESET}"

  # 1. JRE — apt is idempotent, but skip the cache refresh if already installed.
  if dpkg -s default-jre >/dev/null 2>&1; then
    echo "${GREEN}OK  ${RESET} default-jre already installed"
  else
    echo "${YELLOW}NEW ${RESET} installing default-jre (sudo apt-get)…"
    sudo apt-get update -qq
    sudo apt-get install -y default-jre
    echo "${GREEN}OK  ${RESET} default-jre installed"
  fi

  # 2. JAR — download to /opt/tgt/mixing-station/ if version-marker differs.
  local current=""
  if [ -f "$MS_VERSION_MARKER" ]; then
    current="$(cat "$MS_VERSION_MARKER" 2>/dev/null || true)"
  fi

  if [ "$current" = "$MS_VERSION" ] && [ -f "$MS_JAR" ]; then
    echo "${GREEN}OK  ${RESET} JAR already at $MS_VERSION ($MS_JAR)"
  else
    echo "${YELLOW}NEW ${RESET} downloading mixing-station-desktop.jar v$MS_VERSION (~67MB)…"
    sudo mkdir -p "$MS_INSTALL_DIR"
    # --fail makes curl bail on HTTP error instead of writing a 53-byte error blob.
    sudo curl --fail -sL -o "$MS_JAR.partial" "$MS_DOWNLOAD_URL"
    # The download is a zip wrapper around the JAR — extract just the JAR.
    local tmpdir
    tmpdir="$(mktemp -d)"
    sudo unzip -o -q "$MS_JAR.partial" -d "$tmpdir"
    if [ ! -f "$tmpdir/mixing-station-desktop.jar" ]; then
      echo "${RED}FAIL${RESET} downloaded zip did not contain mixing-station-desktop.jar"
      sudo rm -rf "$tmpdir" "$MS_JAR.partial"
      return 1
    fi
    sudo mv "$tmpdir/mixing-station-desktop.jar" "$MS_JAR"
    sudo rm -rf "$tmpdir" "$MS_JAR.partial"
    echo "$MS_VERSION" | sudo tee "$MS_VERSION_MARKER" >/dev/null
    echo "${GREEN}OK  ${RESET} JAR installed → $MS_JAR"
  fi

  # 3. Launcher script must be executable (chmod, post-copy).
  if [ -f "$MS_INSTALL_DIR/launch.sh" ]; then
    sudo chmod +x "$MS_INSTALL_DIR/launch.sh"
    echo "${GREEN}OK  ${RESET} launcher executable → $MS_INSTALL_DIR/launch.sh"
  fi
}

verify_mixing_station() {
  echo
  echo "${BOLD}=== Mixing Station ===${RESET}"
  local fail=0

  if command -v java >/dev/null 2>&1; then
    echo "${GREEN}OK  ${RESET} java in PATH ($(java -version 2>&1 | head -1))"
  else
    echo "${RED}FAIL${RESET} java not in PATH"
    fail=$((fail+1))
  fi

  if [ -f "$MS_JAR" ]; then
    local sz
    sz=$(stat -c %s "$MS_JAR" 2>/dev/null || stat -f %z "$MS_JAR")
    echo "${GREEN}OK  ${RESET} JAR present ($MS_JAR, ${sz} bytes)"
  else
    echo "${RED}FAIL${RESET} JAR missing: $MS_JAR"
    fail=$((fail+1))
  fi

  if [ -f "$MS_VERSION_MARKER" ]; then
    local got
    got="$(cat "$MS_VERSION_MARKER")"
    if [ "$got" = "$MS_VERSION" ]; then
      echo "${GREEN}OK  ${RESET} JAR version marker = $MS_VERSION"
    else
      echo "${YELLOW}DIFF${RESET} version marker=$got, repo pins $MS_VERSION (run install to upgrade)"
      fail=$((fail+1))
    fi
  else
    echo "${RED}FAIL${RESET} version marker missing: $MS_VERSION_MARKER"
    fail=$((fail+1))
  fi

  if [ -x "$MS_INSTALL_DIR/launch.sh" ]; then
    echo "${GREEN}OK  ${RESET} launcher executable"
  else
    echo "${RED}FAIL${RESET} launcher missing or not executable: $MS_INSTALL_DIR/launch.sh"
    fail=$((fail+1))
  fi

  return $fail
}

cmd_install() {
  echo "${BOLD}=== TGT E6330 install ===${RESET}"
  echo "Repo:    $REPO_ROOT"
  echo "User:    $(whoami)@$(hostname)"
  echo

  # Sanity check: this script should be run on the kiosk user, not root.
  if [ "$(id -u)" -eq 0 ]; then
    echo "${RED}ERROR${RESET}: do not run install.sh as root. Run as the kiosk user (tangerine on E6330)."
    echo "  Root-owned destinations use sudo internally."
    exit 1
  fi

  local fail=0
  for entry in "${FILES[@]}"; do
    local src dst owner
    IFS='|' read -r src dst owner <<<"$entry"
    src="$REPO_ROOT/$src"
    dst="$(resolve_dest "$dst")"

    if [ ! -f "$src" ]; then
      echo "${RED}MISS${RESET} source missing: $src"
      fail=$((fail+1))
      continue
    fi

    local dest_dir="$(dirname "$dst")"
    if [ "$owner" = "user" ]; then
      mkdir -p "$dest_dir"
      cp -f "$src" "$dst"
      echo "${GREEN}OK  ${RESET} user: $dst"
    else
      sudo mkdir -p "$dest_dir"
      sudo cp -f "$src" "$dst"
      echo "${GREEN}OK  ${RESET} root: $dst"
    fi
  done

  # Post-install: reload systemd + enable gig-command-server (idempotent).
  echo
  echo "${BOLD}=== systemd reload + enable ===${RESET}"
  sudo systemctl daemon-reload
  sudo systemctl enable --now gig-command-server.service
  echo "${GREEN}OK  ${RESET} gig-command-server.service enabled+running"

  # Mixing Station: JRE + pinned JAR + launcher chmod.
  install_mixing_station

  if [ $fail -gt 0 ]; then
    echo
    echo "${RED}=== install completed with $fail missing source(s) ===${RESET}"
    exit 1
  fi

  echo
  echo "${GREEN}=== install OK ===${RESET}"
  echo "Run '${0##*/} verify' to confirm runtime state matches repo."
  echo "First Mixing Station launch: configure XR18 IP in MS connection panel"
  echo "(settings persist in ~/.config/MixingStation/ — survive reboot)."
}

cmd_verify() {
  echo "${BOLD}=== TGT E6330 verify ===${RESET}"
  echo "Repo: $REPO_ROOT"
  echo

  local fail=0 pass=0
  for entry in "${FILES[@]}"; do
    local src dst owner
    IFS='|' read -r src dst owner <<<"$entry"
    src="$REPO_ROOT/$src"
    dst="$(resolve_dest "$dst")"

    if [ ! -f "$src" ]; then
      echo "${RED}MISS${RESET} source missing: $src"
      fail=$((fail+1))
      continue
    fi

    if [ ! -f "$dst" ]; then
      echo "${RED}MISS${RESET} runtime missing: $dst"
      fail=$((fail+1))
      continue
    fi

    local src_hash dst_hash
    src_hash=$(sha256sum "$src" | awk '{print $1}')
    dst_hash=$(sha256sum "$dst" | awk '{print $1}')

    if [ "$src_hash" = "$dst_hash" ]; then
      echo "${GREEN}OK  ${RESET} $(printf '%-60s' "$dst") sha256=${src_hash:0:8}"
      pass=$((pass+1))
    else
      echo "${YELLOW}DIFF${RESET} $dst"
      echo "       src=${src_hash:0:8}  dst=${dst_hash:0:8}"
      fail=$((fail+1))
    fi
  done

  # systemd unit health
  echo
  echo "${BOLD}=== systemd ===${RESET}"
  if systemctl is-enabled --quiet gig-command-server.service 2>/dev/null; then
    echo "${GREEN}OK  ${RESET} gig-command-server.service enabled"
  else
    echo "${RED}FAIL${RESET} gig-command-server.service NOT enabled"
    fail=$((fail+1))
  fi
  if systemctl is-active --quiet gig-command-server.service 2>/dev/null; then
    echo "${GREEN}OK  ${RESET} gig-command-server.service active"
  else
    echo "${YELLOW}WARN${RESET} gig-command-server.service not running (may be intentional)"
  fi

  # Listener reachable?
  if curl -sf --max-time 2 http://localhost:8666/healthz >/dev/null 2>&1; then
    echo "${GREEN}OK  ${RESET} gig-command-server.service responding on :8666/healthz"
  else
    echo "${YELLOW}WARN${RESET} :8666/healthz not responding (server not running, or firewall)"
  fi

  # Mixing Station: JRE present, JAR version, launcher executable.
  local ms_fail=0
  verify_mixing_station || ms_fail=$?
  fail=$((fail + ms_fail))

  echo
  if [ $fail -eq 0 ]; then
    echo "${GREEN}=== verify OK — $pass files match ===${RESET}"
    exit 0
  else
    echo "${RED}=== verify FAILED — $fail mismatches/misses ===${RESET}"
    echo "Run '${0##*/} install' to sync runtime to repo."
    exit 1
  fi
}

case "${1:-}" in
  install) cmd_install ;;
  verify)  cmd_verify ;;
  *)
    echo "Usage: $0 {install|verify}"
    echo
    echo "  install  Copy repo files into runtime locations on E6330."
    echo "  verify   Check runtime state matches repo (sha256). Read-only."
    exit 2
    ;;
esac
