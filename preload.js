const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    startMonitoring: (username) => ipcRenderer.invoke('start-monitoring', username),
    stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
    getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
    onTikTokEvent: (callback) => {
        ipcRenderer.on('tiktok-event', (event, data) => callback(data));
    },
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('tiktok-event');
    }
});
