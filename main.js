const electron = require("electron");
const url = require("url");
const path = require("path");

function createWindow() {
  const mainWindow = new electron.BrowserWindow({width: 800, height: 600, webPreferences: {nodeIntegration:true,webviewTag:true,contextIsolation:false}, title: "Orion Browser", backgroundColor: "#fff"});
  // TODO: implement the menu The Right Way(tm)
  mainWindow.setMenu(null);
  mainWindow.loadFile("chrome/browser.html");
}

electron.app.whenReady().then(() => {
  createWindow()

  electron.app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  })
})

// Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
electron.app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') electron.app.quit();
})
