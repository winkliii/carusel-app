const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SMOKE = process.env.CARUSEL_SMOKE;          // build-time self test: screenshot path
if (SMOKE) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'carusel-smoke-')));

/* The app updates itself: a newer carusel-studio.html downloaded by the in-app updater is kept in the user's data
   folder and used instead of the copy shipped inside the app. A downloaded copy that did not start last time
   (marker file still there) is thrown away, so a bad update cannot lock the app. */
const SHIPPED = path.join(__dirname, 'index.html');
const versionOf = html => +(/const APP_VERSION = (\d+);/.exec(html) || [0, 0])[1];
const updateFile = () => path.join(app.getPath('userData'), 'update.html');
const marker = () => path.join(app.getPath('userData'), 'update-pending');
function appFile() {
  try {
    const up = updateFile();
    if (!fs.existsSync(up)) return SHIPPED;
    if (fs.existsSync(marker()) || versionOf(fs.readFileSync(up, 'utf8')) <= versionOf(fs.readFileSync(SHIPPED, 'utf8'))) {
      fs.rmSync(up, { force: true }); fs.rmSync(marker(), { force: true });
      return SHIPPED;
    }
    fs.writeFileSync(marker(), '');
    return up;
  } catch (e) { return SHIPPED; }
}
ipcMain.on('started', () => { try { fs.rmSync(marker(), { force: true }); } catch (e) {} });
ipcMain.handle('install', (ev, html) => {
  if (typeof html !== 'string' || !versionOf(html) || !html.trimEnd().endsWith('</html>')) return false;
  fs.writeFileSync(updateFile(), html);
  BrowserWindow.fromWebContents(ev.sender).loadFile(appFile());
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 720, minHeight: 520,
    backgroundColor: '#141518', title: 'Carusel Studio', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(appFile());
  win.webContents.setWindowOpenHandler(({ url }) => {        // links (the feedback form) open in the normal browser
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', e => e.preventDefault());   // a file dropped outside the canvas must not replace the app

  if (SMOKE) win.webContents.once('did-finish-load', async () => {
    let result;
    try {
      await new Promise(r => setTimeout(r, 800));
      result = await win.webContents.executeJavaScript(`(async () => {
        addText(); const b = await renderFrame(0, 1, 'image/jpeg', .9);
        return JSON.stringify({ els: state.els.length, fonts: FONTS.length, frameBytes: b.size, zip: makeZip([{name:'a', data:new Uint8Array(3)}]).size });
      })()`);
      await new Promise(r => setTimeout(r, 300));
      fs.writeFileSync(SMOKE, (await win.webContents.capturePage()).toPNG());
    } catch (e) { result = 'ERROR ' + e.message; }
    console.log('SMOKE ' + result);
    app.quit();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'Editare', submenu: [{ role: 'cut', label: 'Decupează' }, { role: 'copy', label: 'Copiază' }, { role: 'paste', label: 'Lipește' }, { role: 'selectAll', label: 'Selectează tot' }] },
    { role: 'windowMenu' },
  ]) : null);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
