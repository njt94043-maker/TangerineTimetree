#!/usr/bin/env bash
# Mixing Station — TGT gig rig launcher (E6330).
#
# Pinned JAR + JRE are placed by tools/e6330/install.sh:
#   /opt/tgt/mixing-station/mixing-station-desktop.jar  (pinned 2.9.3)
#   default-jre (Debian package, openjdk-17-jre)
#
# Called from ~/.config/openbox/autostart at boot so the window is up alongside
# Reaper + wifi-switcher — Alt+Tab switches between them.
#
# Settings live in $HOME/.config/MixingStation/ (per upstream docs) and survive
# reboot — XR18 IP / mix profile / scenes do NOT need re-pairing each gig.

set -u

JAR=/opt/tgt/mixing-station/mixing-station-desktop.jar
LOG=/tmp/mixing-station.log

if [ ! -f "$JAR" ]; then
  echo "[$(date -Is)] FATAL: $JAR missing. Run: bash tools/e6330/install.sh install" >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "[$(date -Is)] FATAL: java not in PATH. Install default-jre (install.sh handles this)." >&2
  exit 1
fi

exec java -jar "$JAR" "$@" >>"$LOG" 2>&1
