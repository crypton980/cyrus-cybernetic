import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);
function isEnabled() {
    return process.env.DEVICE_CONTROL_ENABLED === "true";
}
function allowlist() {
    const raw = process.env.DEVICE_ALLOWLIST_APPS || "";
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function isAllowedApp(name, bundleId) {
    const list = allowlist();
    if (list.length === 0)
        return true;
    const target = (bundleId || name || "").toLowerCase();
    return list.some((a) => target.includes(a.toLowerCase()));
}
async function runAppleScript(script) {
    await execFileAsync("osascript", ["-e", script]);
}
async function hasBinary(bin) {
    try {
        await execFileAsync("which", [bin]);
        return true;
    }
    catch {
        return false;
    }
}
async function screenshot(path) {
    await execFileAsync("screencapture", ["-x", path]);
}
export async function executeDeviceCommand(cmd) {
    const platform = os.platform();
    const dryRun = cmd.dryRun ?? true; // default to dry-run
    if (!isEnabled()) {
        return { success: false, detail: "Device control disabled by configuration", platform, dryRun };
    }
    if (!isAllowedApp(cmd.appName, cmd.bundleId)) {
        return { success: false, detail: "Target app not in allowlist", platform, dryRun };
    }
    // Only macOS implementation; others return unsupported
    if (platform !== "darwin") {
        return { success: false, detail: `Platform ${platform} not supported`, platform, dryRun };
    }
    try {
        switch (cmd.action) {
            case "open_app": {
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would open ${cmd.appName}`, platform, dryRun };
                if (!cmd.appName)
                    return { success: false, detail: "appName required", platform, dryRun };
                await runAppleScript(`tell application "${cmd.appName}" to activate`);
                return { success: true, detail: `Opened ${cmd.appName}`, platform, dryRun };
            }
            case "focus_app": {
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would focus ${cmd.appName}`, platform, dryRun };
                if (!cmd.appName)
                    return { success: false, detail: "appName required", platform, dryRun };
                await runAppleScript(`tell application "${cmd.appName}" to activate`);
                return { success: true, detail: `Focused ${cmd.appName}`, platform, dryRun };
            }
            case "keystroke": {
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would send keystroke`, platform, dryRun };
                if (!cmd.keys || cmd.keys.length === 0)
                    return { success: false, detail: "keys required", platform, dryRun };
                const key = cmd.keys[0];
                await runAppleScript(`tell application "System Events" to keystroke "${key}"`);
                return { success: true, detail: `Sent keystroke ${key}`, platform, dryRun };
            }
            case "text": {
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would type text`, platform, dryRun };
                if (!cmd.text)
                    return { success: false, detail: "text required", platform, dryRun };
                await runAppleScript(`tell application "System Events" to keystroke "${cmd.text.replace(/"/g, '\\"')}"`);
                return { success: true, detail: `Typed text`, platform, dryRun };
            }
            case "shortcut": {
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would send shortcut`, platform, dryRun };
                if (!cmd.shortcut || cmd.shortcut.length === 0)
                    return { success: false, detail: "shortcut required", platform, dryRun };
                const keys = cmd.shortcut.map((k) => k.replace(/"/g, '\\"')).join(" & \"\" & ");
                await runAppleScript(`tell application "System Events" to keystroke {${keys}}`);
                return { success: true, detail: `Shortcut sent`, platform, dryRun };
            }
            case "pointer_move":
            case "pointer_click":
            case "pointer_drag":
            case "scroll": {
                const hasCliclick = await hasBinary("cliclick");
                if (!hasCliclick) {
                    return { success: false, detail: `${cmd.action} requires 'cliclick' binary`, platform, dryRun };
                }
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would ${cmd.action}`, platform, dryRun };
                // Build cliclick command
                const action = (() => {
                    switch (cmd.action) {
                        case "pointer_move":
                            if (typeof cmd.x === "number" && typeof cmd.y === "number")
                                return ["m:" + cmd.x + "," + cmd.y];
                            if (typeof cmd.dx === "number" && typeof cmd.dy === "number")
                                return ["dd:" + cmd.dx + "," + cmd.dy];
                            throw new Error("pointer_move requires x/y or dx/dy");
                        case "pointer_click":
                            return [cmd.button === "right" ? "rc:." : "c:."];
                        case "pointer_drag":
                            if (typeof cmd.x === "number" && typeof cmd.y === "number")
                                return ["dc:.", "m:" + cmd.x + "," + cmd.y, "uc:."];
                            throw new Error("pointer_drag requires x/y");
                        case "scroll":
                            if (typeof cmd.dy !== "number")
                                throw new Error("scroll requires dy");
                            // Positive dy scrolls up in cliclick via 'w' negative values scroll down
                            return ["w:" + cmd.dy];
                        default:
                            return [];
                    }
                })();
                await execFileAsync("cliclick", action);
                return { success: true, detail: `${cmd.action} executed`, platform, dryRun };
            }
            case "screenshot": {
                if (dryRun)
                    return { success: true, detail: `[dry-run] Would take screenshot`, platform, dryRun };
                const tmpFile = `/tmp/device-shot-${Date.now()}.png`;
                await screenshot(tmpFile);
                return { success: true, detail: `Screenshot saved to ${tmpFile}`, platform, dryRun };
            }
            default:
                return { success: false, detail: "Unknown action", platform, dryRun };
        }
    }
    catch (err) {
        return { success: false, detail: err?.message || "execution failed", platform, dryRun };
    }
}
