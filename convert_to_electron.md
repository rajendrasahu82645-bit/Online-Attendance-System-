---
description: Convert AttendX web project to a desktop Electron application
---

# Overview
This workflow packages the existing **AttendX** web application (Next.js front‑end in `v2/app` and Express back‑end in `fontant/server.js`) into a native **Electron** desktop app for Windows.

# Prerequisites
- **Node.js** (v20+) installed on the development machine.
- **Git** (optional, for cloning the repo).
- **Windows OS** (the target platform).

# Steps
1. **Create a new Electron project folder**
   ```
   mkdir electron-app && cd electron-app
   ```
2. **Initialize npm**
   // turbo
   ```
   npm init -y
   ```
3. **Install Electron and required dependencies**
   // turbo
   ```
   npm install --save-dev electron concurrently wait-on
   npm install --save express
   ```
4. **Copy the existing project files**
   - Copy the entire `Online Attendance System code` directory into `electron-app/src`.
   - The folder structure should look like:
     ```
     electron-app/
       src/
         backend/   (contains fontant folder with server.js)
         frontend/ (contains v2 folder with Next.js app)
     ```
5. **Add an Electron main script** (`main.js` in the project root):
   ```javascript
   const { app, BrowserWindow } = require('electron');
   const path = require('path');
   const { exec } = require('child_process');

   let win;
   function createWindow() {
     win = new BrowserWindow({
       width: 1280,
       height: 720,
       webPreferences: { nodeIntegration: false, contextIsolation: true }
     });
     // Load the Next.js dev server once it is ready
     win.loadURL('http://localhost:3000');
   }

   app.whenReady().then(() => {
     // Start the Express backend
     const backend = exec('node src/fontant/server.js', { cwd: __dirname });
     backend.stdout.pipe(process.stdout);
     backend.stderr.pipe(process.stderr);

     // Start the Next.js front‑end
     const frontend = exec('npm run dev', { cwd: path.join(__dirname, 'src', 'v2') });
     frontend.stdout.pipe(process.stdout);
     frontend.stderr.pipe(process.stderr);

     // Wait for the front‑end to be reachable before creating the window
     const waitOn = require('wait-on');
     waitOn({ resources: ['http-get://localhost:3000'], timeout: 30000 }, (err) => {
       if (err) {
         console.error('Front‑end did not start in time', err);
         app.quit();
       } else {
         createWindow();
       }
     });
   });

   app.on('window-all-closed', () => {
     if (process.platform !== 'darwin') app.quit();
   });
   ```
6. **Add a start script** to `package.json`:
   ```json
   "scripts": {
     "start": "concurrently \"node src/fontant/server.js\" \"npm run dev --prefix src/v2\"",
     "electron": "wait-on http-get://localhost:3000 && electron ."
   }
   ```
7. **Run the application**
   // turbo
   ```
   npm run start   # launches backend + Next.js dev server
   npm run electron   # opens the Electron window pointing to http://localhost:3000
   ```
8. **Package the app for distribution** (optional)
   ```
   npm install --save-dev electron-builder
   ```
   Add to `package.json`:
   ```json
   "build": {
     "appId": "com.attendx.desktop",
     "win": { "target": "nsis" }
   },
   "scripts": { "dist": "electron-builder" }
   ```
   Then run:
   ```
   npm run dist
   ```
   The generated installer (`.exe`) will appear in the `dist` folder.

# Tips & Gotchas
- Ensure the **BarcodeDetector** API works inside Electron; it relies on Chromium, so recent Electron versions support it.
- If you prefer a production build of the Next.js app, run `npm run build && npm start` inside `src/v2` before launching Electron, and point `win.loadFile('src/v2/.next/server/pages/index.html')` instead of the dev URL.
- Adjust CORS settings in `fontant/server.js` if the Electron window is considered a different origin.

# Verification
1. After running `npm run electron`, the desktop window should display the AttendX dashboard.
2. Test the **Scanner** tab – the camera should work and barcode detection should behave as in the browser.
3. Use the **Mark Present/Absent** buttons to ensure attendance is recorded via the Express API.

---
*Workflow created to help you convert the AttendX web project into a native Windows desktop application using Electron.*
