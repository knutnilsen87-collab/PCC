const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__PCC_DESKTOP__", {
  mode: "desktop",
  pickAndScanFolder: () => ipcRenderer.invoke("pcc_pick_and_scan_folder"),
});
