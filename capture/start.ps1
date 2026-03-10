# TGT Audio Capture — PowerShell Launcher
# Run this to start the capture tool.
# Backend auto-starts via vite plugin.

$captureUI = "C:\Apps\TGT\capture\ui"

# Kill any existing instances
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*capture*" -or $_.CommandLine -like "*5174*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*capture*" -or $_.CommandLine -like "*9123*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

# Start vite (which auto-starts backend via plugin)
$proc = Start-Process -FilePath "node" `
    -ArgumentList "node_modules\vite\bin\vite.js", "--port", "5174" `
    -WorkingDirectory $captureUI `
    -WindowStyle Hidden `
    -PassThru

Write-Host ""
Write-Host "  TGT Audio Capture" -ForegroundColor Green
Write-Host "  UI:      http://localhost:5174" -ForegroundColor Cyan
Write-Host "  Backend: http://localhost:9123" -ForegroundColor Cyan
Write-Host "  PID:     $($proc.Id)" -ForegroundColor DarkGray
Write-Host ""

# Wait for servers to boot
Start-Sleep -Seconds 4

# Open in Chrome app mode (PWA-style, no URL bar)
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "--app=http://localhost:5174"
} else {
    Start-Process "http://localhost:5174"
}

Write-Host "  Press any key to stop servers..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*9123*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "  Servers stopped." -ForegroundColor Yellow
