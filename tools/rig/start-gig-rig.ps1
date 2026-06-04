<#
================================================================================
  start-gig-rig.ps1  --  Config-asserting launcher for the Reaper live rig
================================================================================

  GOLDEN RULE (the known clobber bug):
  ------------------------------------
  A clean single-instance Reaper exit persists the audio/OSC config fine.
  Corruption ONLY happens when REAPER.ini is edited while a reaper.exe
  instance is OPEN -- Reaper overwrites the file with its in-memory config
  on exit, discarding the edit. Therefore this script ONLY EVER edits
  REAPER.ini while reaper.exe is fully CLOSED. The cold-start path below
  closes every reaper.exe (graceful, then forced) and proves it is gone
  BEFORE touching the ini, then launches Reaper afterwards.

  What it does:
    1. If Reaper is already running AND UDP 8000 is bound -> rig is live,
       print status and exit 0 (never disturb a live gig).
    2. Cold start:
         a. Ensure NO reaper.exe is running (ini must be written closed).
         b. Assert REAPER.ini section-aware + idempotent (only fix what's
            wrong; never duplicate csurf_0; preserve all other lines + CRLF;
            back up once to REAPER.ini.rigbak).
         c. Launch Reaper.
    3. Ensure the Media Server host is listening on TCP 9200, else start it.
    4. Print a readiness summary.

  Dependency-free: built-in PowerShell + Windows NetTCPIP cmdlets only.
================================================================================
#>

$ErrorActionPreference = 'Stop'

# ---- Constants: verified-correct rig configuration -------------------------
$ReaperIni  = 'C:\Users\njt94\AppData\Roaming\REAPER\REAPER.ini'
$ReaperExe  = 'C:\Program Files\REAPER (x64)\reaper.exe'
$MsTrayExe  = 'C:\Apps\windows\TangerineMediaServer\TangerineMediaServer.Tray.exe'
$MsPort     = 9200
$OscPort    = 8000

# Verified audio config (X-AIR ASIO Driver -> 18 inputs @ 48000).
# NOTE: asio_driver_name is QUOTED to match exactly what Reaper itself writes
# for values containing spaces (the currently-working on-disk file is quoted).
$AudioKeys = [ordered]@{
    'mode'           = '3'
    'asio_driver_name' = '"X-AIR ASIO Driver"'
    'asio_srate'     = '48000'
    'asio_srate_use' = '1'
    'asio_input0'    = '0'
    'asio_input1'    = '17'
}
$CsurfValue = 'OSC "TGT-OSC" 5 8000 9000 0 "" "Default.ReaperOSC"'

$script:changes = @()

# ---- Networking helpers (built-in NetTCPIP) --------------------------------
function Get-UdpOwnerPid {
    param([int]$Port)
    $e = Get-NetUDPEndpoint -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($e) { return [int]$e.OwningProcess }
    return $null
}
function Get-TcpListener {
    param([int]$Port)
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}
function Get-ReaperProcs { Get-Process reaper -ErrorAction SilentlyContinue }

# ---- INI helpers: section-aware, CRLF-preserving ---------------------------
function Get-SectionRange {
    # Returns @{Start=<header idx>; End=<exclusive idx of next section/EOF>} or $null
    param([System.Collections.Generic.List[string]]$Lines, [string]$Section)
    $start = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i].Trim() -eq "[$Section]") { $start = $i; break }
    }
    if ($start -lt 0) { return $null }
    $end = $Lines.Count
    for ($i = $start + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i].Trim() -match '^\[.+\]$') { $end = $i; break }
    }
    return @{ Start = $start; End = $end }
}

function Set-IniKey {
    # Set key=value ONLY inside the given section. Insert at section end if absent.
    param([System.Collections.Generic.List[string]]$Lines, [string]$Section, [string]$Key, [string]$Value)
    $r = Get-SectionRange $Lines $Section
    if (-not $r) { throw "Section [$Section] not found in $ReaperIni" }
    $desired = "$Key=$Value"
    for ($i = $r.Start + 1; $i -lt $r.End; $i++) {
        if ($Lines[$i] -match ('^\s*' + [regex]::Escape($Key) + '=')) {
            if ($Lines[$i] -ne $desired) {
                $script:changes += "[$Section] $Key : '$($Lines[$i])' -> '$desired'"
                $Lines[$i] = $desired
            }
            return
        }
    }
    $Lines.Insert($r.End, $desired)
    $script:changes += "[$Section] $Key inserted -> '$desired'"
}

function Set-CsurfSingle {
    # Ensure EXACTLY ONE csurf_0 line in [reaper]; collapse any duplicates.
    param([System.Collections.Generic.List[string]]$Lines, [string]$Value)
    $r = Get-SectionRange $Lines 'reaper'
    if (-not $r) { throw "Section [reaper] not found in $ReaperIni" }
    $desired = "csurf_0=$Value"
    $idx = New-Object System.Collections.Generic.List[int]
    for ($i = $r.Start + 1; $i -lt $r.End; $i++) {
        if ($Lines[$i] -match '^\s*csurf_0=') { $idx.Add($i) }
    }
    if ($idx.Count -eq 0) {
        $Lines.Insert($r.End, $desired)
        $script:changes += "[reaper] csurf_0 inserted -> '$desired'"
        return
    }
    if ($Lines[$idx[0]] -ne $desired) {
        $script:changes += "[reaper] csurf_0 : '$($Lines[$idx[0]])' -> '$desired'"
        $Lines[$idx[0]] = $desired
    }
    for ($j = $idx.Count - 1; $j -ge 1; $j--) {
        $script:changes += "[reaper] removed duplicate csurf_0 at line $($idx[$j] + 1)"
        $Lines.RemoveAt($idx[$j])
    }
}

function Assert-ReaperConfig {
    # MUST be called only with reaper.exe CLOSED.
    if (-not (Test-Path $ReaperIni)) { throw "REAPER.ini not found: $ReaperIni" }

    # Back up once.
    $bak = "$ReaperIni.rigbak"
    if (-not (Test-Path $bak)) {
        Copy-Item -LiteralPath $ReaperIni -Destination $bak
        Write-Host "  Backup created: $bak"
    } else {
        Write-Host "  Backup already present: $bak (left untouched)"
    }

    # Read raw, split on CRLF preserving structure.
    $raw = [System.IO.File]::ReadAllText($ReaperIni)
    $arr = $raw -split "`r`n", -1
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($l in $arr) { $lines.Add($l) }

    foreach ($k in $AudioKeys.Keys) { Set-IniKey $lines 'audioconfig' $k $AudioKeys[$k] }
    Set-IniKey $lines 'reaper' 'csurf_cnt' '1'
    Set-CsurfSingle $lines $CsurfValue

    if ($script:changes.Count -eq 0) {
        Write-Host "  Config already correct - no changes written."
    } else {
        $out = ($lines -join "`r`n")
        $enc = New-Object System.Text.UTF8Encoding($false)   # no BOM (matches original)
        [System.IO.File]::WriteAllText($ReaperIni, $out, $enc)
        Write-Host "  Applied $($script:changes.Count) change(s):"
        foreach ($c in $script:changes) { Write-Host "    - $c" }
    }
}

function Read-BackConfig {
    # Re-read from disk and return the actual on-disk values (proof, not memory).
    $raw = [System.IO.File]::ReadAllText($ReaperIni)
    $arr = $raw -split "`r`n", -1
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($l in $arr) { $lines.Add($l) }
    $res = @{}
    $ra = Get-SectionRange $lines 'audioconfig'
    foreach ($k in @('mode','asio_driver_name','asio_srate','asio_srate_use','asio_input0','asio_input1')) {
        for ($i = $ra.Start + 1; $i -lt $ra.End; $i++) {
            if ($lines[$i] -match ('^\s*' + [regex]::Escape($k) + '=(.*)$')) { $res[$k] = $matches[1]; break }
        }
    }
    $rr = Get-SectionRange $lines 'reaper'
    $csurf = @()
    for ($i = $rr.Start + 1; $i -lt $rr.End; $i++) {
        if ($lines[$i] -match '^\s*csurf_cnt=(.*)$') { $res['csurf_cnt'] = $matches[1] }
        if ($lines[$i] -match '^\s*csurf_0=')        { $csurf += $lines[$i] }
    }
    $res['csurf_0_count'] = $csurf.Count
    $res['csurf_0'] = ($csurf -join ' || ')
    return $res
}

# ============================================================================
#  MAIN
# ============================================================================
Write-Host "=== Tangerine Gig Rig launcher ==="
Write-Host ""

# ---- 1. Already live? Don't disturb. ---------------------------------------
$reaper = Get-ReaperProcs
$udpPid = Get-UdpOwnerPid $OscPort
if ($reaper -and $udpPid) {
    $owner = (Get-Process -Id $udpPid -ErrorAction SilentlyContinue).ProcessName
    Write-Host "Rig appears LIVE -- not disturbing it."
    Write-Host "  reaper.exe running: PID(s) $(($reaper.Id) -join ', ')"
    Write-Host "  UDP $OscPort bound by PID $udpPid ($owner)"
    $tcp = Get-TcpListener $MsPort
    Write-Host "  TCP $MsPort listening: $([bool]$tcp)$(if($tcp){" (PID $($tcp.OwningProcess))"})"
    Write-Host ""
    Write-Host "Detected live rig. Exiting without changes."
    exit 0
}

# ---- 2a. Cold start: close Reaper (ini must be written CLOSED) --------------
Write-Host "Cold start. Ensuring Reaper is closed before touching REAPER.ini..."
$procs = Get-ReaperProcs
if ($procs) {
    foreach ($p in $procs) { try { $p.CloseMainWindow() | Out-Null } catch {} }
    for ($w = 0; $w -lt 16; $w++) {
        Start-Sleep -Milliseconds 500
        if (-not (Get-ReaperProcs)) { break }
    }
    $still = Get-ReaperProcs
    if ($still) {
        Write-Host "  Graceful close timed out; force-stopping stale reaper.exe."
        $still | Stop-Process -Force
        Start-Sleep -Milliseconds 800
    }
}
if (Get-ReaperProcs) { throw "Could not close reaper.exe; aborting before editing ini." }
Write-Host "  Confirmed: no reaper.exe running."

# ---- 2b. Assert config (Reaper is closed) ----------------------------------
Write-Host "Asserting REAPER.ini (section-aware, idempotent)..."
Assert-ReaperConfig
$cfg = Read-BackConfig   # re-read from disk to PROVE what was written
Write-Host "  Verified on disk: mode=$($cfg.mode) driver=$($cfg.asio_driver_name) srate=$($cfg.asio_srate) input0=$($cfg.asio_input0) input1=$($cfg.asio_input1) csurf_cnt=$($cfg.csurf_cnt) csurf_0_count=$($cfg.csurf_0_count)"

# ---- 2c. Launch Reaper -----------------------------------------------------
Write-Host "Launching Reaper..."
Start-Process -FilePath $ReaperExe | Out-Null

# ---- 3. Ensure Media Server host (TCP 9200) --------------------------------
if (Get-TcpListener $MsPort) {
    Write-Host "Media Server already listening on TCP $MsPort."
} else {
    Write-Host "Starting Media Server host..."
    if (Test-Path $MsTrayExe) { Start-Process -FilePath $MsTrayExe | Out-Null }
    else { Write-Host "  WARNING: MS tray exe not found: $MsTrayExe" }
}

# ---- 4. Readiness summary --------------------------------------------------
Write-Host ""
Write-Host "Waiting for rig to come up..."
$udpPid = $null
for ($w = 0; $w -lt 60; $w++) {       # up to ~60s for Reaper to bind UDP 8000
    Start-Sleep -Milliseconds 1000
    $udpPid = Get-UdpOwnerPid $OscPort
    if ($udpPid) { break }
}
$tcpUp = $null
for ($w = 0; $w -lt 20; $w++) {
    $tcpUp = Get-TcpListener $MsPort
    if ($tcpUp) { break }
    Start-Sleep -Milliseconds 1000
}

$reaper   = Get-ReaperProcs
$inputCnt = [int]$cfg.asio_input1 - [int]$cfg.asio_input0 + 1
$udpOwner = if ($udpPid) { (Get-Process -Id $udpPid -ErrorAction SilentlyContinue).ProcessName } else { $null }

Write-Host ""
Write-Host "================ RIG READINESS ================"
Write-Host ("  Reaper running          : {0}{1}" -f ($(if($reaper){'Y'}else{'N'})), $(if($reaper){" (PID $(($reaper.Id) -join ', '))"}else{''}))
Write-Host ("  Configured audio        : {0} @ {1} Hz, {2} inputs" -f $cfg.asio_driver_name, $cfg.asio_srate, $inputCnt)
Write-Host ("  UDP {0} (OSC) bound    : {1}{2}" -f $OscPort, ($(if($udpPid){'Y'}else{'N'})), $(if($udpPid){" (PID $udpPid / $udpOwner)"}else{''}))
Write-Host ("  TCP {0} (MediaServer) : {1}{2}" -f $MsPort, ($(if($tcpUp){'Y'}else{'N'})), $(if($tcpUp){" (PID $($tcpUp.OwningProcess))"}else{''}))
Write-Host "==============================================="

if ($reaper -and $udpPid) { exit 0 } else { exit 1 }
