const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");
const os = require("os");

protocol.registerSchemesAsPrivileged([
  { scheme: "pv", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let win = null;
let dataDir = null;
let watcher = null;
let selfWriteAt = 0;

const configPath = () => path.join(app.getPath("userData"), "config.json");
const dataFile = () => path.join(dataDir, "data.json");
const photoDir = () => path.join(dataDir, "photos");
const seedDir = () => (app.isPackaged ? path.join(process.resourcesPath, "seed") : path.join(__dirname, "seed"));

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), "utf8")); } catch { return {}; }
}
function writeConfig(c) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(c, null, 2));
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

// Make sure the data folder exists; seed it with the bundled gallery on first run.
function ensureData(dir) {
  fs.mkdirSync(path.join(dir, "photos"), { recursive: true });
  if (!fs.existsSync(path.join(dir, "data.json"))) {
    const seed = seedDir();
    if (fs.existsSync(seed)) copyDir(seed, dir);
    if (!fs.existsSync(path.join(dir, "data.json")))
      fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify({ version: 1, photos: [], customers: [] }, null, 1));
  }
}

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile(), "utf8"));
    return { photos: d.photos || [], customers: d.customers || [] };
  } catch {
    return { photos: [], customers: [] };
  }
}

function save(d) {
  const tmp = dataFile() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, photos: d.photos, customers: d.customers }, null, 1));
  fs.renameSync(tmp, dataFile());
  selfWriteAt = Date.now();
}

// Read-modify-write against the file on disk so two PCs sharing a folder don't overwrite each other.
function mutate(fn) {
  const d = load();
  fn(d);
  save(d);
  scheduleBackup();
  return snapshot(d);
}

function snapshot(d = load()) {
  return { ...d, dataDir, backup: backupInfo() };
}

/* ---------- automatic backup ---------- */
// Copies data.json (one dated copy per day, last 60 kept) and any new photos into
// <backupDir>/Perde Vitrini Yedek/<computer name>/. Photos are copied once, never re-copied.
const backupRoot = (dir) => path.join(dir, "Perde Vitrini Yedek", os.hostname());

function backupInfo() {
  const c = readConfig();
  return { dir: c.backupDir || "", lastAt: c.lastBackupAt || 0, error: c.lastBackupError || "" };
}

function runBackup() {
  const c = readConfig();
  if (!c.backupDir) return backupInfo();
  try {
    if (!fs.existsSync(c.backupDir)) throw new Error("Yedek klasörüne ulaşılamıyor: " + c.backupDir);
    const root = backupRoot(c.backupDir);
    const bPhotos = path.join(root, "photos");
    const bHist = path.join(root, "gecmis");
    fs.mkdirSync(bPhotos, { recursive: true });
    fs.mkdirSync(bHist, { recursive: true });
    for (const name of fs.readdirSync(photoDir())) {
      const dst = path.join(bPhotos, name);
      if (!fs.existsSync(dst)) fs.copyFileSync(path.join(photoDir(), name), dst);
    }
    fs.copyFileSync(dataFile(), path.join(root, "data.json"));
    const day = new Date().toISOString().slice(0, 10);
    fs.copyFileSync(dataFile(), path.join(bHist, `data-${day}.json`));
    const hist = fs.readdirSync(bHist).filter((f) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const old of hist.slice(0, Math.max(0, hist.length - 60))) fs.unlinkSync(path.join(bHist, old));
    writeConfig({ ...readConfig(), lastBackupAt: Date.now(), lastBackupError: "" });
  } catch (e) {
    writeConfig({ ...readConfig(), lastBackupError: String(e.message || e) });
  }
  if (win && !win.isDestroyed()) win.webContents.send("backup", backupInfo());
  return backupInfo();
}

let backupTimer = null;
function scheduleBackup(ms = 20000) {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(runBackup, ms);
}

function safeName(n) {
  return path.basename(String(n || ""));
}

function writePhoto(bytes, ext = "jpg") {
  const name = crypto.randomUUID() + "." + (ext.replace(/[^a-z0-9]/gi, "") || "jpg");
  fs.writeFileSync(path.join(photoDir(), name), Buffer.from(bytes));
  return name;
}

function removeFiles(names) {
  for (const n of names || []) {
    try { fs.unlinkSync(path.join(photoDir(), safeName(n))); } catch {}
  }
}

function watch() {
  if (watcher) watcher.close();
  try {
    watcher = fs.watch(dataDir, (ev, file) => {
      if (file !== "data.json" || Date.now() - selfWriteAt < 1500) return;
      clearTimeout(watch.t);
      watch.t = setTimeout(() => win && !win.isDestroyed() && win.webContents.send("changed"), 300);
    });
  } catch {}
}

function useDir(dir) {
  dataDir = dir;
  ensureData(dir);
  watch();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Perde Vitrini",
    backgroundColor: "#f3f5f5",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.maximize();
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("focus", () => win.webContents.send("changed"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const cfg = readConfig();
  useDir(cfg.dataDir || path.join(app.getPath("documents"), "Perde Vitrini"));

  protocol.handle("pv", (req) => {
    const u = new URL(req.url);
    const file = path.join(photoDir(), safeName(decodeURIComponent(u.pathname)));
    return net.fetch(pathToFileURL(file).toString());
  });

  ipcMain.handle("load", () => snapshot());

  ipcMain.handle("addPhotos", (_e, { items, cat, note }) =>
    mutate((d) => {
      for (const it of items) {
        const file = writePhoto(it.bytes, it.ext);
        d.photos.unshift({ id: crypto.randomUUID(), cat, note: note || "", file, createdAt: Date.now() });
      }
    })
  );

  ipcMain.handle("updatePhoto", (_e, { id, cat, note }) =>
    mutate((d) => {
      const p = d.photos.find((x) => x.id === id);
      if (p) { p.cat = cat; p.note = note; }
    })
  );

  ipcMain.handle("deletePhoto", (_e, id) =>
    mutate((d) => {
      const p = d.photos.find((x) => x.id === id);
      if (p) removeFiles([p.file]);
      d.photos = d.photos.filter((x) => x.id !== id);
    })
  );

  ipcMain.handle("uploadFile", (_e, { bytes, ext }) => writePhoto(bytes, ext));
  ipcMain.handle("deleteFiles", (_e, names) => removeFiles(names));

  ipcMain.handle("saveCustomer", (_e, c) =>
    mutate((d) => {
      const i = d.customers.findIndex((x) => x.id === c.id);
      if (i >= 0) d.customers[i] = { ...d.customers[i], ...c, updatedAt: Date.now() };
      else d.customers.push({ ...c, id: c.id || crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() });
    })
  );

  ipcMain.handle("deleteCustomer", (_e, id) =>
    mutate((d) => {
      const c = d.customers.find((x) => x.id === id);
      if (c) removeFiles(c.photos);
      d.customers = d.customers.filter((x) => x.id !== id);
    })
  );

  ipcMain.handle("chooseDataDir", async () => {
    const r = await dialog.showOpenDialog(win, {
      title: "Verilerin tutulacağı klasörü seç",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled || !r.filePaths[0]) return snapshot();
    const target = r.filePaths[0];
    if (path.resolve(target) === path.resolve(dataDir)) return snapshot();
    if (path.resolve(target).startsWith(path.resolve(dataDir) + path.sep)) {
      dialog.showErrorBox("Klasör seçilemedi", "Mevcut veri klasörünün içindeki bir klasör seçilemez. Başka bir klasör seç.");
      return snapshot();
    }
    // Empty folder: carry the current data over. Folder with data: just switch to it.
    if (!fs.existsSync(path.join(target, "data.json"))) copyDir(dataDir, target);
    writeConfig({ ...readConfig(), dataDir: target });
    useDir(target);
    return snapshot();
  });

  ipcMain.handle("openDataDir", () => shell.openPath(dataDir));

  ipcMain.handle("chooseBackupDir", async () => {
    const r = await dialog.showOpenDialog(win, {
      title: "Yedeklerin gideceği klasörü seç (Google Drive, OneDrive, USB…)",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled || !r.filePaths[0]) return backupInfo();
    const target = r.filePaths[0];
    if (path.resolve(target).startsWith(path.resolve(dataDir))) {
      dialog.showErrorBox("Klasör seçilemedi", "Yedek, veri klasörünün kendisine veya içine alınamaz. Başka bir yer seç.");
      return backupInfo();
    }
    writeConfig({ ...readConfig(), backupDir: target, lastBackupError: "" });
    return runBackup();
  });
  ipcMain.handle("backupNow", () => runBackup());
  ipcMain.handle("openBackupDir", () => {
    const c = readConfig();
    if (c.backupDir) shell.openPath(fs.existsSync(backupRoot(c.backupDir)) ? backupRoot(c.backupDir) : c.backupDir);
  });

  createWindow();
  scheduleBackup(5000);
  setInterval(runBackup, 6 * 60 * 60 * 1000);
});

app.on("window-all-closed", () => {
  clearTimeout(backupTimer);
  runBackup();
  app.quit();
});
