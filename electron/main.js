const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 850,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hiddenInset', // Mac-style title bar
        backgroundColor: '#020617', // Match slate-950
    });

    if (isDev) {
        mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
}

function startPythonBackend() {
    if (isDev) {
        console.log('Dev mode: Waiting for external backend on port ' + BACKEND_PORT);
        return;
    }

    let scriptPath;
    let cmd;
    let args;

    // In production, we use the bundled executable
    scriptPath = path.join(process.resourcesPath, 'backend_dist/server'); // Adjust based on build
    cmd = scriptPath;
    args = [];

    console.log(`Starting backend: ${cmd} ${args.join(' ')}`);

    pythonProcess = spawn(cmd, args);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Backend: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`);
    });
}

app.whenReady().then(() => {
    startPythonBackend();
    // Wait a bit for backend to start? Or just start UI.
    // Ideally we poll /health, but for now just start UI.
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});
