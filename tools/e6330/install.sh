#!/usr/bin/env bash
#
# TGT E6330 install / verify — version-controls the rig-side state of the
# gig-command listener stack, the boot-to-Reaper kiosk wiring, and the Reaper
# project template.
#
# Run modes:
#   install.sh install   Copy all files into their runtime locations + reload
#                        systemd + enable gig-command-server.service. Prompts
#                        for sudo when needed (root-owned destinations).
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
  "tools/e6330/gig-command-server.service|/etc/systemd/system/gig-command-server.service|root"
  "tools/e6330/rig-files/systemd/getty-autologin.conf|/etc/systemd/system/getty@tty1.service.d/autologin.conf|root"
)

resolve_dest() {
  local raw="$1"
  echo "${raw//HOME/$HOME}"
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

  if [ $fail -gt 0 ]; then
    echo
    echo "${RED}=== install completed with $fail missing source(s) ===${RESET}"
    exit 1
  fi

  echo
  echo "${GREEN}=== install OK ===${RESET}"
  echo "Run '${0##*/} verify' to confirm runtime state matches repo."
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
