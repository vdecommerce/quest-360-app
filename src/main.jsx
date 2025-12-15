import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { registerServiceWorker } from './registerServiceWorker.js'

function installFatalOverlay() {
  const show = (title, error) => {
    const root = document.getElementById('root')
    if (!root) return
    const details = (error && (error.stack || error.message || String(error))) || ''
    root.innerHTML = `<div style="max-width:900px;margin:24px auto;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#EAF6FF">
      <h1 style="margin:0 0 12px 0;font-size:22px">Cinema Glass</h1>
      <p style="margin:0 0 10px 0;opacity:.9">${title}</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#0b1620;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);opacity:.9">${details}</pre>
      <p style="margin:10px 0 0 0;opacity:.75">Tip: refresh (and on Quest, clear site data if this persists).</p>
    </div>`
  }
  window.addEventListener('error', (e) => show('App crash', e.error || e.message))
  window.addEventListener('unhandledrejection', (e) => show('Unhandled promise rejection', e.reason))
}

installFatalOverlay()
registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
