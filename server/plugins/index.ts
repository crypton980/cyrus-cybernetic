/**
 * CYRUS Plugin System — extensible plugin registry.
 *
 * Allows external modules, integrations, and third-party tools to register
 * themselves with the CYRUS platform without modifying core server code.
 *
 * Plugin interface
 * ----------------
 * Each plugin must implement `CyrusPlugin`:
 *   - `id`        — unique snake_case identifier (e.g. "slack_notifier")
 *   - `name`      — human-readable display name
 *   - `version`   — semver string (e.g. "1.0.0")
 *   - `onEvent`   — optional event handler called by `invokePlugins()`
 *   - `onStartup` — optional lifecycle hook called at registration
 *
 * Registration
 * ------------
 * Call `registerPlugin(plugin)` at startup or in any module that should
 * extend CYRUS.  The registry is process-scoped (singleton).
 *
 * Invocation
 * ----------
 * Call `invokePlugins(eventType, payload)` to fan out an event to all
 * registered plugins that implement `onEvent`.  Errors in individual
 * plugin handlers are caught and logged — they never crash the caller.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CyrusPlugin {
  /** Unique snake_case identifier (e.g. "slack_notifier"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Optional event handler. Invoked by `invokePlugins()`. */
  onEvent?: (eventType: string, payload: Record<string, unknown>) => Promise<void> | void;
  /** Optional startup lifecycle hook. Called once on registration. */
  onStartup?: () => Promise<void> | void;
}

export interface PluginInvocationResult {
  pluginId: string;
  success: boolean;
  error?: string;
}

// ── Registry ───────────────────────────────────────────────────────────────────

const _registry = new Map<string, CyrusPlugin>();

/**
 * Register a plugin with the CYRUS platform.
 *
 * If a plugin with the same `id` is already registered it is silently
 * replaced and a warning is logged.
 *
 * @param plugin - Plugin implementation conforming to `CyrusPlugin`.
 */
export async function registerPlugin(plugin: CyrusPlugin): Promise<void> {
  if (_registry.has(plugin.id)) {
    console.warn(`[Plugins] replacing existing plugin id=${plugin.id}`);
  }

  _registry.set(plugin.id, plugin);
  console.log(`[Plugins] registered id=${plugin.id} name="${plugin.name}" v${plugin.version}`);

  if (typeof plugin.onStartup === "function") {
    try {
      await plugin.onStartup();
    } catch (err) {
      console.error(`[Plugins] onStartup failed for id=${plugin.id}:`, (err as Error).message);
    }
  }
}

/**
 * Unregister a plugin by its `id`.
 *
 * @returns `true` if the plugin was found and removed, `false` otherwise.
 */
export function unregisterPlugin(id: string): boolean {
  const removed = _registry.delete(id);
  if (removed) {
    console.log(`[Plugins] unregistered id=${id}`);
  }
  return removed;
}

/**
 * Return an array of all currently registered plugins.
 */
export function getPlugins(): CyrusPlugin[] {
  return Array.from(_registry.values());
}

/**
 * Return a single plugin by id, or `undefined` if not found.
 */
export function getPlugin(id: string): CyrusPlugin | undefined {
  return _registry.get(id);
}

/**
 * Fan out an event to all registered plugins that implement `onEvent`.
 *
 * Plugin errors are caught individually — a failing plugin does not
 * prevent other plugins from receiving the event.
 *
 * @param eventType - Event category string (e.g. "cognitive.complete").
 * @param payload   - Arbitrary event data.
 * @returns Array of per-plugin invocation results.
 */
export async function invokePlugins(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<PluginInvocationResult[]> {
  const results: PluginInvocationResult[] = [];

  for (const plugin of _registry.values()) {
    if (typeof plugin.onEvent !== "function") {
      continue;
    }
    try {
      await plugin.onEvent(eventType, payload);
      results.push({ pluginId: plugin.id, success: true });
    } catch (err) {
      const message = (err as Error).message;
      console.warn(`[Plugins] onEvent failed plugin=${plugin.id} event=${eventType}:`, message);
      results.push({ pluginId: plugin.id, success: false, error: message });
    }
  }

  return results;
}

/**
 * Return a serialisable summary of all registered plugins (safe to expose
 * via an API endpoint).
 */
export function getPluginManifest(): Array<{
  id: string;
  name: string;
  version: string;
  hasEventHandler: boolean;
  hasStartupHook: boolean;
}> {
  return getPlugins().map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    hasEventHandler: typeof p.onEvent === "function",
    hasStartupHook: typeof p.onStartup === "function",
  }));
}

