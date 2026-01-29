import { useState } from "react";
import { useDeviceControl } from "../hooks/useDeviceControl";
import { CyrusAssistant } from "../components/CyrusAssistant";
import {
  Monitor,
  Mouse,
  Keyboard,
  Camera,
  Play,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  Settings,
} from "lucide-react";

export function DeviceControlPage() {
  const [appName, setAppName] = useState("");
  const [textToType, setTextToType] = useState("");
  const [mouseX, setMouseX] = useState("");
  const [mouseY, setMouseY] = useState("");
  const [shortcutKeys, setShortcutKeys] = useState("");
  const [dryRun, setDryRun] = useState(true);

  const {
    status,
    lastResult,
    pendingConfirm,
    isExecuting,
    isLoading,
    openApp,
    focusApp,
    typeText,
    shortcut,
    moveMouse,
    click,
    takeScreenshot,
    confirmCommand,
    cancelConfirm,
  } = useDeviceControl();

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Device Control</h1>
            <p className="text-gray-400">
              Control device via AppleScript/cliclick (macOS)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Dry Run
            </label>
          </div>
        </header>

        {status && (
          <div
            className={`p-4 rounded-lg border ${
              status.enabled
                ? "bg-green-900/30 border-green-600"
                : "bg-red-900/30 border-red-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5" />
              <div>
                <p className="font-medium">
                  Device Control: {status.enabled ? "Enabled" : "Disabled"}
                </p>
                <p className="text-sm text-gray-400">
                  Platform: {status.platform} | Dry Run Default:{" "}
                  {status.dryRunDefault ? "Yes" : "No"}
                </p>
                {status.allowedApps.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Allowed Apps: {status.allowedApps.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {pendingConfirm && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-400">
                  Confirm Command Execution
                </p>
                <p className="text-sm text-gray-300">
                  Action: {pendingConfirm.command.action}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Token: {pendingConfirm.token.slice(0, 8)}...
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => confirmCommand.mutate()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Confirm
                  </button>
                  <button
                    onClick={cancelConfirm}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-400" />
                Application Control
              </h2>

              <div className="space-y-3">
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Application name (e.g., Safari, Finder)"
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openApp(appName, dryRun)}
                    disabled={!appName.trim() || isExecuting}
                    className="py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    Open App
                  </button>
                  <button
                    onClick={() => focusApp(appName, dryRun)}
                    disabled={!appName.trim() || isExecuting}
                    className="py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    Focus App
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-purple-400" />
                Keyboard Input
              </h2>

              <div className="space-y-3">
                <input
                  type="text"
                  value={textToType}
                  onChange={(e) => setTextToType(e.target.value)}
                  placeholder="Text to type"
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => typeText(textToType, dryRun)}
                  disabled={!textToType.trim() || isExecuting}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  Type Text
                </button>

                <div className="border-t border-gray-700 pt-3 mt-3">
                  <input
                    type="text"
                    value={shortcutKeys}
                    onChange={(e) => setShortcutKeys(e.target.value)}
                    placeholder="Shortcut keys (e.g., cmd,c or ctrl,alt,delete)"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() =>
                      shortcut(
                        shortcutKeys.split(",").map((k) => k.trim()),
                        dryRun
                      )
                    }
                    disabled={!shortcutKeys.trim() || isExecuting}
                    className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    Execute Shortcut
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mouse className="w-5 h-5 text-green-400" />
                Mouse Control
              </h2>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={mouseX}
                    onChange={(e) => setMouseX(e.target.value)}
                    placeholder="X"
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={mouseY}
                    onChange={(e) => setMouseY(e.target.value)}
                    placeholder="Y"
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      moveMouse(parseInt(mouseX), parseInt(mouseY), dryRun)
                    }
                    disabled={!mouseX || !mouseY || isExecuting}
                    className="py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    Move
                  </button>
                  <button
                    onClick={() =>
                      click(parseInt(mouseX), parseInt(mouseY), "left", dryRun)
                    }
                    disabled={!mouseX || !mouseY || isExecuting}
                    className="py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    Click
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-yellow-400" />
                Screenshot
              </h2>

              <button
                onClick={() => takeScreenshot(dryRun)}
                disabled={isExecuting}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                Take Screenshot
              </button>
            </div>

            {lastResult && (
              <div
                className={`bg-gray-900 rounded-xl border p-4 ${
                  lastResult.success ? "border-green-600" : "border-red-600"
                }`}
              >
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  {lastResult.success ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  Last Result
                </h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-400">Status:</span>{" "}
                    {lastResult.success ? "Success" : "Failed"}
                  </p>
                  <p>
                    <span className="text-gray-400">Platform:</span>{" "}
                    {lastResult.platform}
                  </p>
                  <p>
                    <span className="text-gray-400">Dry Run:</span>{" "}
                    {lastResult.dryRun ? "Yes" : "No"}
                  </p>
                  <p className="text-gray-300">{lastResult.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <CyrusAssistant 
        module="systems" 
        context={`User is in device control module. Dry run mode: ${dryRun ? "enabled" : "disabled"}. ${lastResult ? `Last action: ${lastResult.action}` : "No recent actions"}`}
        compact={true}
      />
    </div>
  );
}
