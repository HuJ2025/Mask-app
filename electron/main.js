const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let pythonProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;

/**
 * 创建窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 850,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#020617',
    });

    if (isDev) {
        mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
        // mainWindow.webContents.openDevTools();
    } else {
        // 你之前就是这么写的，对应 app.asar/frontend/dist/index.html
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * 轮询检测后端是否 ready
 * 用 /api/config 来当健康检查
 */
function waitForBackendReady(timeoutMs = 150000, intervalMs = 500) {
    const start = Date.now();

    return new Promise((resolve, reject) => {
        const check = () => {
            const req = http.get(
                {
                    host: '127.0.0.1',
                    port: BACKEND_PORT,
                    path: '/api/config',
                    timeout: 2000,
                },
                (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        res.resume();
                        console.log('[backend] ready, status =', res.statusCode);
                        resolve();
                    } else {
                        res.resume();
                        retry();
                    }
                }
            );

            req.on('error', () => {
                retry();
            });

            req.on('timeout', () => {
                req.destroy();
                retry();
            });
        };

        const retry = () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error('backend not ready within timeout'));
            } else {
                setTimeout(check, intervalMs);
            }
        };

        check();
    });
}

/**
 * 启动后端（仅生产环境）
 */
function startPythonBackend() {
    if (isDev) {
        console.log('Dev mode: Waiting for external backend on port ' + BACKEND_PORT);
        return;
    }

    const scriptPath = path.join(process.resourcesPath, 'server');

    // Ensure executable permissions (common issue in packaged apps)
    try {
        fs.chmodSync(scriptPath, '755');
    } catch (err) {
        console.error('Failed to set permissions for backend:', err);
    }

    console.log(`Starting backend: ${scriptPath}`);

    // FIX: Manually construct a robust PATH including Homebrew
    // This avoids needing 'fix-path' dependency which might not be installed
    const extraPaths = [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/local/sbin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin'
    ];

    // Construct new PATH: extraPaths + existing PATH
    const newPath = extraPaths.join(':') + (process.env.PATH ? ':' + process.env.PATH : '');

    const env = {
        ...process.env,
        PATH: newPath
    };

    pythonProcess = spawn(scriptPath, [], {
        env: env,
        stdio: 'pipe',
    });

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

/**
 * 确保后端已经在跑：
 * 1. 先尝试连一次，如果已经有（比如上次没关干净），就直接用；
 * 2. 没有的话 spawn 一次；
 * 3. 然后等待 /api/config 返回 200。
 */
async function ensureBackendRunning() {
    if (isDev) {
        // 开发模式就不在这里起 uvicorn，继续用你 npm run dev:backend
        return;
    }

    // 先试试是不是已经有一个在跑（比如之前的实例）
    try {
        console.log('[backend] checking existing backend...');
        await waitForBackendReady(1000, 200);
        console.log('[backend] existing backend detected, reusing it');
        return;
    } catch {
        console.log('[backend] no existing backend, will spawn a new one');
    }

    startPythonBackend();

    try {
        await waitForBackendReady();
    } catch (err) {
        console.error('[backend] failed to become ready:', err);
        // 这里你可以选择继续打开窗口，让前端自己提示错误
    }
}

app.whenReady().then(async () => {
    console.log('[main] app ready, isDev =', isDev, 'resourcesPath =', process.resourcesPath);

    await ensureBackendRunning();  // ⭐ 关键：先搞定 backend

    createWindow();                // 然后再开前端

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (pythonProcess) {
        console.log('[main] killing backend process...');
        pythonProcess.kill();
    }
});
