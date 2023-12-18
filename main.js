const { app, BrowserWindow } = require('electron')

const createWindow = () => {
  const win = new BrowserWindow({show: false});
  win.maximize();
  // set icon
  //win.setIcon('icon.svg')
   //win.removeMenu();
  win.loadFile('index.html')
  win.show();
}

app.whenReady().then(() => {
  createWindow()
})