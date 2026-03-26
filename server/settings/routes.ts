import { Router } from "express";
import {
  getSettingsStatus,
  setSetting,
  deleteSetting,
} from "./service";

const router = Router();

// GET /api/settings/keys — returns masked key status (no plaintext values)
router.get("/keys", async (_req, res) => {
  try {
    const status = await getSettingsStatus();
    res.json(status);
  } catch (err) {
    console.error("[Settings] GET /keys error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// POST /api/settings/keys — update one or more API keys
// Body: { openaiKey?, openaiModel?, openaiBaseUrl?, elevenLabsKey?, newsApiKey? }
router.post("/keys", async (req, res) => {
  try {
    const {
      openaiKey,
      openaiModel,
      openaiBaseUrl,
      elevenLabsKey,
      newsApiKey,
    } = req.body as {
      openaiKey?: string;
      openaiModel?: string;
      openaiBaseUrl?: string;
      elevenLabsKey?: string;
      newsApiKey?: string;
    };

    const tasks: Promise<void>[] = [];
    let openaiChanged = false;

    if (openaiKey !== undefined) {
      if (openaiKey.trim()) {
        tasks.push(setSetting("openai_api_key", openaiKey.trim()));
      } else {
        tasks.push(deleteSetting("openai_api_key"));
      }
      openaiChanged = true;
    }
    if (openaiModel !== undefined) {
      if (openaiModel.trim()) {
        tasks.push(setSetting("openai_model", openaiModel.trim()));
      } else {
        tasks.push(deleteSetting("openai_model"));
      }
      openaiChanged = true;
    }
    if (openaiBaseUrl !== undefined) {
      if (openaiBaseUrl.trim()) {
        tasks.push(setSetting("openai_base_url", openaiBaseUrl.trim()));
      } else {
        tasks.push(deleteSetting("openai_base_url"));
      }
      openaiChanged = true;
    }
    if (elevenLabsKey !== undefined) {
      if (elevenLabsKey.trim()) {
        tasks.push(setSetting("elevenlabs_api_key", elevenLabsKey.trim()));
      } else {
        tasks.push(deleteSetting("elevenlabs_api_key"));
      }
    }
    if (newsApiKey !== undefined) {
      if (newsApiKey.trim()) {
        tasks.push(setSetting("news_api_key", newsApiKey.trim()));
      } else {
        tasks.push(deleteSetting("news_api_key"));
      }
    }

    await Promise.all(tasks);

    // Refresh the OpenAI singleton in routes.ts so new key takes effect immediately
    if (openaiChanged) {
      try {
        const { refreshOpenAIClient } = await import("../routes");
        await refreshOpenAIClient();
      } catch {
        // routes module may not be loaded yet
      }
    }

    const status = await getSettingsStatus();
    res.json({ success: true, status });
  } catch (err) {
    console.error("[Settings] POST /keys error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
