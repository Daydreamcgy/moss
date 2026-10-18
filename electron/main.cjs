const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');

const isDev = process.env.MOSS_DEV === '1';
const DOCUMENT_EXTENSIONS = /\.(md|markdown|mdown|mkd|mdx|txt)$/i;

let mainWindow = null;
let pendingFile = null;

function fileFromArgv(argv) {
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue;
    if (!DOCUMENT_EXTENSIONS.test(arg)) continue;
    try {
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    } catch {
      /* ignore unreadable arguments */
    }
  }
  return null;
}

function readDocument(filePath) {
  if (!filePath) return null;
  try {
    return {
      path: filePath,
      name: path.basename(filePath),
      text: fs.readFileSync(filePath, 'utf8'),
    };
  } catch {
    return null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 680,
    minHeight: 460,
    title: 'Moss',
    backgroundColor: '#ffffff',
    autoHideMenuBar: process.platform !== 'darwin',
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: { color: '#ffffff', symbolColor: '#2b2b2b', height: 40 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5188');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Ask the renderer first: it knows whether anything is unsaved.
  win.on('close', (event) => {
    if (win.allowClose) return;
    event.preventDefault();
    if (!win.webContents.isDestroyed()) win.webContents.send('moss:before-close');
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  return win;
}

function focusWindow(win) {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function openInWindow(win, doc) {
  if (!win || !doc) return;
  focusWindow(win);
  win.webContents.send('moss:open-file', doc);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    // No `role: 'fileMenu'` on purpose: it ships a Ctrl+W "Close" accelerator
    // that would swallow the editor's close-tab shortcut.
    { label: 'File', submenu: [{ role: 'quit' }] },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.on('moss:theme', (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || typeof win.setTitleBarOverlay !== 'function') return;

  const color = typeof payload?.color === 'string' ? payload.color : '#ffffff';
  const symbolColor = typeof payload?.symbolColor === 'string' ? payload.symbolColor : '#2b2b2b';

  try {
    win.setTitleBarOverlay({ color, symbolColor, height: 40 });
  } catch {
    /* overlay not supported on this platform */
  }
});

ipcMain.on('moss:close-response', (event, dirtyCount, text) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  if (!dirtyCount) {
    win.allowClose = true;
    win.destroy();
    return;
  }

  const choice = dialog.showMessageBoxSync(win, {
    type: 'warning',
    buttons: [text?.cancel ?? 'Cancel', text?.discard ?? 'Close without saving'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: text?.title ?? 'Moss',
    message: text?.message ?? `${dirtyCount} document(s) have unsaved changes`,
    detail: text?.detail ?? 'Closing now will discard them.',
  });

  if (choice === 1) {
    win.allowClose = true;
    win.destroy();
  }
});

ipcMain.handle('moss:take-startup-file', () => {
  const doc = readDocument(pendingFile);
  pendingFile = null;
  return doc;
});

ipcMain.handle('moss:save-file', async (_event, filePath, text) => {
  if (typeof filePath !== 'string' || !filePath) return false;
  await fs.promises.writeFile(filePath, String(text ?? ''), 'utf8');
  return true;
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  pendingFile = fileFromArgv(process.argv);

  app.on('second-instance', (_event, argv) => {
    // A second launch (double-clicking another .md) lands here: reuse the window.
    const doc = readDocument(fileFromArgv(argv));
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (doc) openInWindow(win, doc);
    else focusWindow(win);
  });

  app.whenReady().then(() => {
    buildMenu();
    mainWindow = createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
