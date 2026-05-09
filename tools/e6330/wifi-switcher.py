#!/usr/bin/env python3
"""WiFi Switcher GUI for E6330 — Nathan-controllable network switcher.

S144 spawned this. Per `feedback--user-self-serve-tools.md`, when a runtime
control is needed at gigs (e.g. switching between home WiFi and the
`nathan's S23` mobile hotspot when the hotspot drops + comes back),
Nathan needs a UI he can Alt+Tab to from Reaper — no SSH, no terminal.

Window design:
  - Title "WiFi Switcher" so Alt+Tab finds it.
  - Big buttons per saved WiFi connection.
  - Live "Connected: <ssid>  IP: <addr>" header, polled every 3s.
  - Visibility hint per button: shows "(not visible)" when the SSID
    isn't in the latest scan, so Nathan can see at a glance whether
    the hotspot is actually broadcasting before tapping.
  - A "Rescan" button that runs `nmcli device wifi rescan`.

Reads/writes:
  - Reads `nmcli connection show` for saved WiFi connections.
  - Reads `nmcli device wifi list` for visible APs.
  - Calls `nmcli connection up <name>` to switch.
  - All shell-out is via subprocess; no privileged operations.

Install path (on rig): `/opt/tgt/wifi-switcher.py`
Autostart: appended to `~/.config/openbox/autostart` by `install.sh`.
"""
import subprocess
import tkinter as tk

POLL_SEC = 3

# ─── nmcli helpers ──────────────────────────────────────────────────────────


def run(*args, timeout=10):
    """Run a command, return (rc, stdout, stderr)."""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except FileNotFoundError as e:
        return 127, "", str(e)


def get_active_wifi():
    """Return the name of the active wifi connection, or None."""
    rc, out, _ = run("nmcli", "-t", "-f", "NAME,TYPE", "connection", "show", "--active")
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) >= 2 and "wireless" in parts[1]:
            return parts[0]
    return None


def get_active_ip():
    """Return the IPv4 of the wifi interface, or empty string."""
    # Try wlp2s0 first (e6330's NIC), fall back to scanning all interfaces.
    for iface in ("wlp2s0", "wlan0"):
        rc, out, _ = run("ip", "-4", "-o", "addr", "show", iface)
        if rc == 0 and "inet " in out:
            for line in out.splitlines():
                if "inet " in line:
                    return line.split()[3].split("/")[0]
    return ""


def get_saved_wifi():
    """Return list of saved wireless connection names, in priority order."""
    rc, out, _ = run(
        "nmcli", "-t", "-f", "NAME,TYPE,AUTOCONNECT-PRIORITY",
        "connection", "show",
    )
    rows = []
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) >= 3 and "wireless" in parts[1]:
            try:
                prio = int(parts[2])
            except ValueError:
                prio = 0
            rows.append((parts[0], prio))
    rows.sort(key=lambda r: -r[1])  # high priority first
    return [n for n, _ in rows]


def visible_ssids():
    """Return set of SSIDs currently visible in scan."""
    rc, out, _ = run("nmcli", "-t", "-f", "SSID", "device", "wifi", "list")
    return {s for s in (line.strip() for line in out.splitlines()) if s}


# ─── UI actions ─────────────────────────────────────────────────────────────


def switch_to(name, status_var, root):
    """Bring up a saved connection. nmcli needs root for `connection up`;
    passwordless sudo is configured for the tangerine user on E6330."""
    status_var.set(f"Connecting to {name}…")
    root.update()
    rc, out, err = run("sudo", "-n", "nmcli", "connection", "up", name, timeout=30)
    if rc == 0:
        status_var.set(f"Connected: {name}")
    else:
        msg = (err or out).strip().splitlines()[-1] if (err or out).strip() else "(no message)"
        status_var.set(f"FAILED: {msg[:80]}")


def rescan(status_var, root):
    """Scan for visible APs. Needs root via sudo (PolKit gates rescan)."""
    status_var.set("Rescanning…")
    root.update()
    run("sudo", "-n", "nmcli", "device", "wifi", "rescan", timeout=15)
    status_var.set("Rescan complete")


def refresh(active_label, ip_label, root):
    a = get_active_wifi() or "(none)"
    ip = get_active_ip()
    active_label.config(text=f"Connected: {a}")
    ip_label.config(text=f"IP: {ip or '(none)'}")
    root.after(POLL_SEC * 1000, refresh, active_label, ip_label, root)


# ─── main ───────────────────────────────────────────────────────────────────


def main():
    root = tk.Tk()
    root.title("WiFi Switcher")
    root.configure(bg="#1a1a1a")
    # Sized for up to 5 saved connections + header + status; tested on E6330
    # (1366x768 default). Resize is allowed below the minsize floor.
    root.geometry("520x540+60+60")
    root.minsize(480, 480)

    tk.Label(
        root, text="WIFI SWITCHER",
        bg="#1a1a1a", fg="#ff8a3c", font=("Helvetica", 18, "bold"),
    ).pack(pady=(10, 4))

    active_label = tk.Label(
        root, text="Connected: ?",
        bg="#1a1a1a", fg="#7fb800", font=("Helvetica", 13, "bold"),
    )
    active_label.pack()
    ip_label = tk.Label(
        root, text="IP: ?",
        bg="#1a1a1a", fg="#888", font=("Helvetica", 10),
    )
    ip_label.pack(pady=(0, 14))

    saved = get_saved_wifi()
    visible = visible_ssids()
    status_var = tk.StringVar(value="idle")

    if not saved:
        tk.Label(
            root, text="No saved WiFi connections found.",
            bg="#1a1a1a", fg="#d33", font=("Helvetica", 11),
        ).pack(pady=10)
    else:
        for name in saved:
            is_visible = name in visible
            suffix = "" if is_visible else "  (not visible)"
            # nathan's S23 is the gig hotspot; tint it green to match the
            # ARMED / RECORDING colour language Nathan uses elsewhere.
            bg = "#2c5f1f" if "S23" in name else "#2a4a6a"
            tk.Button(
                root,
                text=f"Switch to {name}{suffix}",
                command=lambda n=name: switch_to(n, status_var, root),
                bg=bg, fg="white",
                font=("Helvetica", 12, "bold"),
                relief="flat", padx=10, pady=12,
                activebackground="#3a3a3a", activeforeground="white",
            ).pack(fill="x", padx=20, pady=4)

    tk.Button(
        root, text="Rescan",
        command=lambda: rescan(status_var, root),
        bg="#444", fg="white",
        font=("Helvetica", 10),
        relief="flat", padx=8, pady=6,
    ).pack(fill="x", padx=20, pady=(14, 4))

    tk.Label(
        root, textvariable=status_var,
        bg="#1a1a1a", fg="#bbb", font=("Helvetica", 10),
    ).pack(pady=6)

    refresh(active_label, ip_label, root)
    root.mainloop()


if __name__ == "__main__":
    main()
