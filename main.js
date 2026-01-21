const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let connectorProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#0a0a0f',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0a0a0f',
            symbolColor: '#ffffff',
            height: 40
        },
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('index.html');
    
    // Open DevTools in development
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (connectorProcess) {
            connectorProcess.cleanup();
            connectorProcess = null;
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle IPC messages from renderer
ipcMain.handle('start-monitoring', async (event, username) => {
    if (connectorProcess) {
        connectorProcess.cleanup();
    }

    const TikTokConnector = require('./tiktok-connector.js');
    connectorProcess = new TikTokConnector(username, (eventType, data) => {
        // Send events back to renderer
        mainWindow.webContents.send('tiktok-event', { type: eventType, data });
    });

    try {
        await connectorProcess.connect();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-monitoring', async () => {
    if (connectorProcess) {
        connectorProcess.cleanup();
        connectorProcess = null;
    }
    return { success: true };
});

ipcMain.handle('get-connection-status', async () => {
    if (!connectorProcess) {
        return { connected: false, connecting: false };
    }
    return {
        connected: connectorProcess.isConnected,
        connecting: connectorProcess.isConnecting
    };
});
