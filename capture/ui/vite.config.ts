import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import type { Plugin } from 'vite'

function backendAutoStart(): Plugin {
  let proc: ChildProcess | null = null
  const backendDir = resolve(__dirname, '..', 'backend')
  const pythonExe = resolve(backendDir, '.venv', 'Scripts', 'python.exe')

  return {
    name: 'backend-auto-start',
    configureServer() {
      proc = spawn(pythonExe, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '9123', '--reload'], {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        if (line) console.log(`  \x1b[36m[backend]\x1b[0m ${line}`)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        if (line) console.log(`  \x1b[33m[backend]\x1b[0m ${line}`)
      })

      proc.on('error', (err) => {
        console.error(`  \x1b[31m[backend] Failed to start: ${err.message}\x1b[0m`)
      })

      proc.on('exit', (code) => {
        if (code !== null && code !== 0) {
          console.error(`  \x1b[31m[backend] Exited with code ${code}\x1b[0m`)
        }
      })

      console.log('  \x1b[36m[backend]\x1b[0m Starting FastAPI on http://127.0.0.1:9123 ...')
    },
    closeBundle() {
      if (proc && !proc.killed) {
        proc.kill()
        proc = null
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), backendAutoStart()],
  server: {
    port: 5174,
  },
})
