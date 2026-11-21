const { app, BrowserWindow, shell } = require('electron');
const { join } = require('node:path');

const home = 'https://corvus.gent/hackersbay';

function route(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const internal = url.origin === 'https://corvus.gent' &&
      (url.pathname === '/hackersbay' || url.pathname.startsWith('/hackersbay/'));
    return { url: url.href, internal };
  } catch { return null; }
}

function openExternal(url) {
  void shell.openExternal(url).catch(() => {});
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1130, height: 850, minWidth: 375, minHeight: 520,
    title: 'The Hackers Bay', backgroundColor: '#06121f', icon: join(__dirname, 'icon.png'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  const { webContents } = window;
  webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write' && route(webContents.getURL())?.internal === true);
  });
  webContents.on('will-navigate', (event) => {
    const link = route(event.url);
    if (link?.internal) return;
    event.preventDefault();
    if (link) openExternal(link.url);
  });
  webContents.on('will-redirect', (event) => {
    if (route(event.url)?.internal !== true) event.preventDefault();
  });
  webContents.setWindowOpenHandler(({ url }) => {
    const link = route(url);
    if (link?.internal) void window.loadURL(link.url).catch(() => {});
    else if (link) openExternal(link.url);
    return { action: 'deny' };
  });
  void window.loadURL(home).catch(() => {});
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
