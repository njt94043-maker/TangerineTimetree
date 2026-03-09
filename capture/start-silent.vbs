' TGT Audio Capture — Silent Launcher
' Double-click to start both UI + backend with no visible windows.
' Backend auto-starts via vite plugin in vite.config.ts.

Dim shell
Set shell = CreateObject("WScript.Shell")

' Start vite dev server (which auto-starts the backend)
shell.Run "cmd /c cd /d ""C:\Apps\TGT\capture\ui"" && node node_modules\vite\bin\vite.js --port 5174", 0, False

' Wait for servers to boot, then open the capture UI
WScript.Sleep 4000
shell.Run "http://localhost:5174"
