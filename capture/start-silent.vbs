' TGT Audio Capture — Silent Launcher
' Double-click to start both UI + backend with no visible windows.
' Backend auto-starts via vite plugin in vite.config.ts.

Dim shell
Set shell = CreateObject("WScript.Shell")

' Start vite dev server (which auto-starts the backend)
' Use full path to node to avoid PATH issues in WScript context
Dim nodePath
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"

' Fallback: try common locations
Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(nodePath) Then
    nodePath = shell.ExpandEnvironmentStrings("%APPDATA%") & "\fnm\node-versions\v22.14.0\installation\node.exe"
End If
If Not fso.FileExists(nodePath) Then
    nodePath = "node"  ' Fall back to PATH
End If

shell.Run "cmd /c cd /d ""C:\Apps\TGT\capture\ui"" && """ & nodePath & """ node_modules\vite\bin\vite.js --port 5174", 0, False

' Wait for servers to boot, then open as PWA-style app window (no browser chrome)
WScript.Sleep 5000

' Find Chrome and open in app mode (standalone window, no URL bar)
Dim chromePath
chromePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chromePath) Then
    chromePath = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
End If
If Not fso.FileExists(chromePath) Then
    chromePath = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"
End If

If fso.FileExists(chromePath) Then
    shell.Run """" & chromePath & """ --app=http://localhost:5174", 1, False
Else
    ' Fallback: open in default browser
    shell.Run "http://localhost:5174"
End If
