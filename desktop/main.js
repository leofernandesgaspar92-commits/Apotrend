'use strict';
// ────────────────────────────────────────────────────────────────────────────
//  ApoPulse Desktop — Electron-Hülle
//
//  Lädt EXAKT denselben Web-Kern wie die Mobile-/PWA-Version (frontend/index.html)
//  — read-only, ohne die Originaldatei zu verändern.
//  - Entwicklung:  ../frontend/index.html (direkt aus dem Repo)
//  - Gebaut:       resources/frontend/index.html (von electron-builder kopiert,
//                  siehe "extraResources" in package.json — Kopie, kein Original)
//  Es gibt hier bewusst KEINE eigene App-Logik: Desktop = gleicher Code, anderer
//  Rahmen. Damit kann die Mobile-Version nicht beeinträchtigt werden.
// ────────────────────────────────────────────────────────────────────────────
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function resolveIndexHtml() {
  const devPath = path.join(__dirname, '..', 'frontend', 'index.html');
  const prodPath = path.join(process.resourcesPath, 'frontend', 'index.html');
  return fs.existsSync(devPath) ? devPath : prodPath;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'ApoPulse',
    autoHideMenuBar: true, // klarere, aufgeraeumte Oberflaeche (Menue via Alt)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false,
    },
  });

  win.loadFile(resolveIndexHtml());

  // Externe Links (target=_blank / window.open) im System-Browser oeffnen,
  // statt ein neues App-Fenster zu erzeugen.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Versehentliche Navigation zu externen http(s)-Seiten -> System-Browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith('file:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
