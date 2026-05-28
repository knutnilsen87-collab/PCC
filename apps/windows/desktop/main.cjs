const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const SCAN_POLICY = {
  maxDepth: 8,
  maxFiles: 5000,
  maxFileBytesForContentRead: 250000,
  ignoreNames: new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", ".turbo", ".cache", "coverage", "target", "vendor", "__pycache__", ".venv", "venv"]),
  secretNames: [/^\.env($|\.)/i, /secret/i, /token/i, /credential/i, /private_key/i, /\.pem$/i, /\.key$/i, /^id_rsa$/i, /^id_ed25519$/i],
  textExtensions: new Set([".json", ".md", ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".yaml", ".yml", ".toml", ".rs", ".go", ".py", ".sql", ".txt"]),
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: "Project Command Center",
    backgroundColor: "#121214",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  registerNativeCommands();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function registerNativeCommands() {
  ipcMain.handle("pcc_pick_and_scan_folder", async () => {
    if (process.env.PCC_DESKTOP_SMOKE_FOLDER) {
      const folderPath = process.env.PCC_DESKTOP_SMOKE_FOLDER;
      const entries = await scanFolderReadOnly(folderPath);
      return { folderPath, entries };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Import project folder",
      properties: ["openDirectory"],
    });

    if (result.canceled || !result.filePaths[0]) return null;
    const folderPath = result.filePaths[0];
    const entries = await scanFolderReadOnly(folderPath);
    return { folderPath, entries };
  });
}

async function scanFolderReadOnly(rootPath) {
  const entries = [];
  await walkDirectory(rootPath, "", entries, 0);
  return entries;
}

async function walkDirectory(rootPath, relativeBase, entries, depth) {
  if (depth > SCAN_POLICY.maxDepth || entries.length >= SCAN_POLICY.maxFiles * 2) return;

  let children;
  try {
    children = await fs.readdir(path.join(rootPath, relativeBase), { withFileTypes: true });
  } catch {
    return;
  }

  for (const child of children) {
    if (entries.length >= SCAN_POLICY.maxFiles * 2) return;
    const relativePath = toSafeRelativePath(path.join(relativeBase, child.name));
    if (!relativePath) continue;

    if (child.isDirectory()) {
      entries.push({ path: relativePath, kind: "directory" });
      if (!shouldSkipPath(relativePath)) {
        await walkDirectory(rootPath, relativePath, entries, depth + 1);
      }
      continue;
    }

    if (!child.isFile()) {
      entries.push({ path: relativePath, kind: "file", isBinary: true });
      continue;
    }

    const fullPath = path.join(rootPath, relativePath);
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }

    const skipReason = shouldSkipPath(relativePath);
    const extension = path.extname(child.name).toLowerCase();
    const isText = SCAN_POLICY.textExtensions.has(extension);
    const entry = {
      path: relativePath,
      kind: "file",
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      isBinary: !isText,
    };

    if (!skipReason && isText && stat.size <= SCAN_POLICY.maxFileBytesForContentRead) {
      try {
        entry.content = await fs.readFile(fullPath, "utf8");
        entry.isBinary = false;
      } catch {
        entry.isBinary = true;
      }
    }

    entries.push(entry);
  }
}

function shouldSkipPath(relativePath) {
  const parts = relativePath.split("/");
  if (parts.some((part) => SCAN_POLICY.ignoreNames.has(part))) return true;
  const name = parts[parts.length - 1] ?? relativePath;
  if (SCAN_POLICY.secretNames.some((pattern) => pattern.test(name) || pattern.test(relativePath))) return true;
  return false;
}

function toSafeRelativePath(value) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("../") || normalized === "..") return "";
  return normalized;
}
