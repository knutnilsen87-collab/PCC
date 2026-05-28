const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const exePath = path.join(__dirname, "..", "dist-desktop", "win-unpacked", "Project Command Center.exe");
const nativeDialogPort = 9333;
const importPort = 9334;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged desktop executable not found: ${exePath}`);
  }

  await runNativeDialogSmoke();
  await runImportSmoke();
  console.log("Packaged desktop smoke passed.");
}

async function runNativeDialogSmoke() {
  const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "pcc-desktop-picker-smoke-"));
  const markerPath = path.join(userDataDir, "native-dialog-command.json");
  const app = launchDesktopApp(nativeDialogPort, userDataDir, { PCC_DESKTOP_DIALOG_MARKER: markerPath });
  let runtime;
  try {
    const page = await connectToFirstPage(nativeDialogPort);
    runtime = await createCdpClient(page.webSocketDebuggerUrl);
    const windowInfo = await waitFor(() => evaluate(runtime, () => ({
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    })));
    assert(windowInfo.outerWidth >= 1400, `Desktop window opened too narrow: ${JSON.stringify(windowInfo)}`);
    assert(windowInfo.outerHeight >= 860, `Desktop window opened too short: ${JSON.stringify(windowInfo)}`);
    assert(windowInfo.outerWidth < windowInfo.screenWidth || windowInfo.outerHeight < windowInfo.screenHeight, `Desktop window should not open fullscreen: ${JSON.stringify(windowInfo)}`);
    const mode = await waitFor(() => evaluate(runtime, () => {
      if (!document.body.innerText.trim()) throw new Error("Renderer body not ready.");
      return {
      href: location.href,
      hasDesktopMode: document.body.innerText.includes("Desktop mode active"),
      hasWebFallbackInput: Boolean(document.querySelector("input[type='file'][webkitdirectory]")),
      hasWebDemoMode: document.body.innerText.includes("Web demo mode active"),
      bodyText: document.body.innerText.slice(0, 800),
      };
    }));

    assert(mode.hasDesktopMode, `Desktop mode indicator was not visible in packaged app. State: ${JSON.stringify(mode)}`);
    assert(!mode.hasWebFallbackInput, "Browser folder input is rendered in desktop mode.");
    assert(!mode.hasWebDemoMode, "Web demo mode is visible in packaged desktop app.");
    assert(!mode.href.includes("127.0.0.1"), `Packaged app loaded localhost URL: ${mode.href}`);

    await waitFor(() => evaluate(runtime, () => {
      const button = document.querySelector("button[aria-label='Import local project folder']");
      if (!button) throw new Error("Import folder button not ready.");
      setTimeout(() => button?.click(), 0);
      return true;
    }));

    const marker = await waitFor(async () => JSON.parse(await fsp.readFile(markerPath, "utf8")));
    const dialogOpened = await waitForNativeDialog(2500).catch(() => false);
    const windowNames = listTopLevelWindowNames();
    closeNativeDialog();
    assert(marker.command === "pcc_pick_and_scan_folder", `Native folder picker command was not invoked. Marker: ${JSON.stringify(marker)}`);
    assert(marker.picker === "dialog.showOpenDialog", `Import did not use Electron native folder picker. Marker: ${JSON.stringify(marker)}`);
    assert(marker.properties?.includes("openDirectory"), `Native picker was not configured for folder selection. Marker: ${JSON.stringify(marker)}`);
    assert(
      dialogOpened || windowNames.includes("Project Command Center"),
      `Packaged app did not expose any native desktop window after clicking Import folder. Windows: ${JSON.stringify(windowNames)}`,
    );
  } finally {
    runtime?.close();
    await stopDesktopApp(app);
    await safeRm(userDataDir);
  }
}

async function runImportSmoke() {
  const folderName = `pcc-smoke-import-${Date.now()}`;
  const smokeFolder = path.join(os.tmpdir(), folderName);
  const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "pcc-desktop-import-smoke-"));
  await fsp.mkdir(path.join(smokeFolder, "src"), { recursive: true });
  await fsp.writeFile(path.join(smokeFolder, "README.md"), `# ${folderName}\n`, "utf8");
  await fsp.writeFile(path.join(smokeFolder, "src", "index.ts"), "export const ok = true;\n", "utf8");

  const app = launchDesktopApp(importPort, userDataDir, { PCC_DESKTOP_SMOKE_FOLDER: smokeFolder });
  let runtime;
  try {
    const page = await connectToFirstPage(importPort);
    runtime = await createCdpClient(page.webSocketDebuggerUrl);
    await waitFor(() => evaluate(runtime, () => {
      const button = document.querySelector("button[aria-label='Import local project folder']");
      if (!button) throw new Error("Import folder button not ready.");
      button?.click();
      return true;
    }));

    const imported = await waitFor(async () => {
      const state = await evaluate(runtime, (expectedName) => {
        const bodyText = document.body.innerText;
        return {
          hasProjectName: bodyText.includes(expectedName),
          headerText: document.querySelector(".topbar h1")?.textContent ?? "",
          bodyText,
          hasBrowserUploadLanguage: /upload|laste opp/i.test(bodyText),
          hasWebFallbackInput: Boolean(document.querySelector("input[type='file'][webkitdirectory]")),
          hasProjectProfile: /Project Profile/i.test(bodyText),
          hasOldImportedOverview: bodyText.includes("Project imported:") || bodyText.includes("Setup progress"),
        };
      }, folderName);
      if (!state.hasProjectName) throw new Error(`Project name not visible yet. State: ${JSON.stringify({ headerText: state.headerText, bodyStart: state.bodyText.slice(0, 400) })}`);
      if (!state.hasProjectProfile) {
        throw new Error(
          `Project Profile layout not visible yet. State: ${JSON.stringify({
            headerText: state.headerText,
            hasOldImportedOverview: state.hasOldImportedOverview,
            bodyStart: state.bodyText.slice(0, 400),
          })}`,
        );
      }
      return state;
    });

    assert(imported.hasProjectName, "Imported folder basename was not visible in the packaged app.");
    assert(imported.headerText.includes(folderName), `Project header did not use folder basename. Header: ${imported.headerText}`);
    assert(!imported.hasBrowserUploadLanguage, "Packaged desktop import rendered browser upload language.");
    assert(!imported.hasWebFallbackInput, "Browser folder input exists after packaged desktop import.");
    assert(imported.hasProjectProfile, "Packaged desktop import did not open the Project Profile layout.");
    assert(!imported.hasOldImportedOverview, "Packaged desktop import returned to the old import result/setup layout.");

    await evaluate(runtime, () => {
      const button = document.querySelector("button[title='Toggle assistant panel']");
      if (!button) throw new Error("Assistant panel toggle not ready.");
      button.click();
      return true;
    });
    const assistantPanel = await waitFor(async () => {
      const state = await evaluate(runtime, () => ({
        hasPanel: Boolean(document.querySelector(".assistant-panel")),
        hasCompactBar: Boolean(document.querySelector(".assistant-bar")),
        gridIsOpen: document.querySelector(".app-shell")?.classList.contains("assistant-panel-open") ?? false,
      }));
      if (!state.hasPanel) throw new Error(`Assistant panel not visible yet. State: ${JSON.stringify(state)}`);
      return state;
    });
    assert(assistantPanel.hasPanel, "Assistant right panel did not open from the desktop shell.");
    assert(assistantPanel.hasCompactBar, "Assistant bottom input bar disappeared after opening the panel.");
    assert(assistantPanel.gridIsOpen, "Assistant panel did not reserve layout space.");
  } finally {
    runtime?.close();
    await stopDesktopApp(app);
    await safeRm(smokeFolder);
    await safeRm(userDataDir);
  }
}

function launchDesktopApp(port, userDataDir, env = {}) {
  return spawn(exePath, [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`], {
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
}

async function connectToFirstPage(port) {
  return waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const pages = await response.json();
    const page = pages.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
    if (!page) throw new Error("No debuggable Electron page yet.");
    return page;
  });
}

async function createCdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });

  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(runtime, pageFunction, arg) {
  const source = `(${pageFunction.toString()})(${JSON.stringify(arg)})`;
  const result = await runtime.send("Runtime.evaluate", {
    expression: source,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function waitFor(callback, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError ?? new Error("Timed out");
}

async function waitForNativeDialog(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const names = listTopLevelWindowNames();
    if (names.some((name) => /Import project folder|Select Folder|Choose folder|Velg mappe|Bla gjennom|Projects/i.test(name))) {
      return true;
    }
    await delay(250);
  }
  return false;
}

function listTopLevelWindowNames() {
  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$children = $desktop.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
if ($children.Count -gt 0) {
  0..(($children.Count)-1) | ForEach-Object {
    $element = $children.Item($_)
    if ($element.Current.Name) { $element.Current.Name }
  }
}
`;
  return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function closeNativeDialog() {
  const script = `
$shell = New-Object -ComObject WScript.Shell
$targets = @('Import project folder', 'Select Folder', 'Choose folder', 'Projects')
foreach ($target in $targets) {
  if ($shell.AppActivate($target)) {
    Start-Sleep -Milliseconds 150
    $shell.SendKeys('{ESC}')
  }
}
`;
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { stdio: "ignore" });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function stopDesktopApp(app) {
  if (app.killed) return;
  app.kill();
  await delay(1000);
}

async function safeRm(targetPath) {
  for (let index = 0; index < 8; index += 1) {
    try {
      await fsp.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (index === 7) throw error;
      await delay(500);
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
