import { useState, useEffect } from "react";
import {
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Settings,
} from "lucide-react";

interface KeyStatus {
  configured: boolean;
  maskedKey: string;
  model?: string;
  baseUrl?: string;
}

interface SettingsStatus {
  openai: KeyStatus;
  elevenLabs: KeyStatus;
  newsApi: KeyStatus;
}

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
      <CheckCircle2 className="w-3 h-3" /> Configured
    </span>
  ) : (
    <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
      <AlertCircle className="w-3 h-3" /> Not configured
    </span>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/40 border border-cyan-900/50 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-700 focus:outline-none focus:border-cyan-500 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-600 hover:text-cyan-400"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [newsApiKey, setNewsApiKey] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/keys");
      if (res.ok) {
        const data: SettingsStatus = await res.json();
        setStatus(data);
        // Pre-fill model/baseUrl from current config
        if (data.openai.model) setOpenaiModel(data.openai.model);
        if (data.openai.baseUrl) setOpenaiBaseUrl(data.openai.baseUrl);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      if (openaiKey) body.openaiKey = openaiKey;
      if (openaiModel) body.openaiModel = openaiModel;
      // Only send baseUrl if user explicitly provided or cleared it (truthy or explicitly empty after having a value)
      if (openaiBaseUrl !== "" || (status?.openai.baseUrl && openaiBaseUrl === "")) {
        body.openaiBaseUrl = openaiBaseUrl;
      }
      if (elevenLabsKey) body.elevenLabsKey = elevenLabsKey;
      if (newsApiKey) body.newsApiKey = newsApiKey;

      const res = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        // Clear key inputs after saving (security)
        setOpenaiKey("");
        setElevenLabsKey("");
        setNewsApiKey("");
        setMessage({ type: "success", text: "API keys saved successfully. They are active immediately." });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error ?? "Failed to save settings." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-100 p-6 font-mono">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-cyan-900/50 pb-4">
          <Settings className="w-6 h-6 text-cyan-400" />
          <div>
            <h1 className="text-xl font-bold text-cyan-300">API Configuration</h1>
            <p className="text-xs text-cyan-600">
              Keys are stored encrypted in the database and take effect immediately without a restart.
            </p>
          </div>
          <button
            onClick={loadStatus}
            className="ml-auto text-cyan-600 hover:text-cyan-400"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Status bar */}
        {status && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "OpenAI", info: status.openai },
              { label: "ElevenLabs", info: status.elevenLabs },
              { label: "NewsAPI", info: status.newsApi },
            ].map(({ label, info }) => (
              <div key={label} className="bg-cyan-950/30 border border-cyan-900/40 rounded p-3 space-y-1">
                <div className="text-xs text-cyan-500 font-semibold">{label}</div>
                <StatusBadge configured={info.configured} />
                {info.configured && info.maskedKey && (
                  <div className="text-xs text-cyan-700 font-mono truncate">{info.maskedKey}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
              message.type === "success"
                ? "bg-green-900/30 border border-green-700/50 text-green-300"
                : "bg-red-900/30 border border-red-700/50 text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}

        {/* OpenAI Section */}
        <section className="bg-cyan-950/20 border border-cyan-900/40 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-cyan-300">OpenAI</h2>
            {status && <StatusBadge configured={status.openai.configured} />}
          </div>
          <p className="text-xs text-cyan-600">
            Required for: AI inference, OCR, vision analysis, document analysis, translation, and all CYRUS
            conversational intelligence.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-cyan-500 mb-1">API Key (sk-…)</label>
              <PasswordInput
                value={openaiKey}
                onChange={setOpenaiKey}
                placeholder="Leave blank to keep existing key"
              />
            </div>
            <div>
              <label className="block text-xs text-cyan-500 mb-1">Model (optional)</label>
              <input
                type="text"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                placeholder="gpt-4o"
                className="w-full bg-black/40 border border-cyan-900/50 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-700 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-cyan-500 mb-1">
                Base URL — Azure / proxy (optional)
              </label>
              <input
                type="text"
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                placeholder="https://… (leave blank for OpenAI default)"
                className="w-full bg-black/40 border border-cyan-900/50 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-700 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </section>

        {/* ElevenLabs Section */}
        <section className="bg-cyan-950/20 border border-cyan-900/40 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-cyan-300">ElevenLabs</h2>
            {status && <StatusBadge configured={status.elevenLabs.configured} />}
          </div>
          <p className="text-xs text-cyan-600">
            Required for: CYRUS natural voice synthesis (/api/cyrus/speak, /api/cyrus/speak/stream).
          </p>
          <div>
            <label className="block text-xs text-cyan-500 mb-1">API Key</label>
            <PasswordInput
              value={elevenLabsKey}
              onChange={setElevenLabsKey}
              placeholder="Leave blank to keep existing key"
            />
          </div>
        </section>

        {/* NewsAPI Section */}
        <section className="bg-cyan-950/20 border border-cyan-900/40 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-cyan-300">NewsAPI</h2>
            {status && <StatusBadge configured={status.newsApi.configured} />}
          </div>
          <p className="text-xs text-cyan-600">Required for: live news feed (/api/news).</p>
          <div>
            <label className="block text-xs text-cyan-500 mb-1">API Key</label>
            <PasswordInput
              value={newsApiKey}
              onChange={setNewsApiKey}
              placeholder="Leave blank to keep existing key"
            />
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving…" : "Save API Keys"}
        </button>

        <p className="text-xs text-cyan-700 text-center">
          Keys are stored in the database (plain text — ensure your database is access-controlled).
          Only the last 4 characters are displayed for verification.
        </p>
      </div>
    </div>
  );
}
