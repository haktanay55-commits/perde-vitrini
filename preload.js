const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  load: () => ipcRenderer.invoke("load"),
  addPhotos: (items, cat, note) => ipcRenderer.invoke("addPhotos", { items, cat, note }),
  updatePhoto: (id, cat, note) => ipcRenderer.invoke("updatePhoto", { id, cat, note }),
  deletePhoto: (id) => ipcRenderer.invoke("deletePhoto", id),
  uploadFile: (bytes, ext) => ipcRenderer.invoke("uploadFile", { bytes, ext }),
  deleteFiles: (names) => ipcRenderer.invoke("deleteFiles", names),
  saveCustomer: (c) => ipcRenderer.invoke("saveCustomer", c),
  deleteCustomer: (id) => ipcRenderer.invoke("deleteCustomer", id),
  chooseDataDir: () => ipcRenderer.invoke("chooseDataDir"),
  openDataDir: () => ipcRenderer.invoke("openDataDir"),
  chooseBackupDir: () => ipcRenderer.invoke("chooseBackupDir"),
  backupNow: () => ipcRenderer.invoke("backupNow"),
  openBackupDir: () => ipcRenderer.invoke("openBackupDir"),
  onChanged: (fn) => ipcRenderer.on("changed", fn),
  onBackup: (fn) => ipcRenderer.on("backup", (_e, info) => fn(info)),
});
