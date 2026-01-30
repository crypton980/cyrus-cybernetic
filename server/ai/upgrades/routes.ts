import { type Express } from "express";
import { 
  vectorKnowledgeBase, 
  emotionalCognition, 
  universalLanguage, 
  decentralizedIntelligence,
  ethicalGovernance,
  selfEvolution,
  getAdvancedUpgradesStatus
} from "./index";

export function registerAdvancedUpgradeRoutes(app: Express): void {
  console.log('[Advanced Upgrades] Registering API routes');

  app.get("/api/upgrades/status", async (req, res) => {
    try {
      const status = getAdvancedUpgradesStatus();
      res.json({
        success: true,
        upgrades: status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error fetching upgrades status:", error);
      res.status(500).json({ error: "Failed to fetch upgrades status" });
    }
  });

  app.post("/api/upgrades/knowledge/search", async (req, res) => {
    try {
      const { query, topK = 5, domain, minImportance } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const results = await vectorKnowledgeBase.semanticSearch(query, topK, { domain, minImportance });
      
      res.json({
        success: true,
        query,
        results: results.map(r => ({
          content: r.document.content,
          similarity: r.similarity,
          relevance: r.relevanceScore,
          domain: r.document.metadata.domain,
          source: r.document.metadata.source
        })),
        count: results.length
      });
    } catch (error: any) {
      console.error("Error in semantic search:", error);
      res.status(500).json({ error: "Semantic search failed" });
    }
  });

  app.post("/api/upgrades/knowledge/add", async (req, res) => {
    try {
      const { content, domain, source, importance, tags } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const id = await vectorKnowledgeBase.addDocument(content, {
        domain: domain || "user_provided",
        source: source || "api",
        importance: importance || 0.7,
        tags: tags || []
      });

      res.json({ success: true, documentId: id });
    } catch (error: any) {
      console.error("Error adding knowledge:", error);
      res.status(500).json({ error: "Failed to add knowledge" });
    }
  });

  app.post("/api/upgrades/knowledge/context", async (req, res) => {
    try {
      const { query, topK = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const context = await vectorKnowledgeBase.retrieveContext(query, { topK });
      
      res.json({
        success: true,
        ...context
      });
    } catch (error: any) {
      console.error("Error retrieving context:", error);
      res.status(500).json({ error: "Context retrieval failed" });
    }
  });

  app.get("/api/upgrades/knowledge/stats", async (req, res) => {
    try {
      const stats = vectorKnowledgeBase.getStats();
      res.json({ success: true, ...stats });
    } catch (error: any) {
      console.error("Error fetching knowledge stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/upgrades/emotion/analyze", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const emotion = await emotionalCognition.analyzeEmotion(text);
      const sentiment = await emotionalCognition.analyzeSentiment(text);
      const crisis = emotionalCognition.detectCrisis(text);

      res.json({
        success: true,
        emotion,
        sentiment,
        crisis,
        empathyResponse: emotionalCognition.getEmpathyResponse(emotion.primary)
      });
    } catch (error: any) {
      console.error("Error analyzing emotion:", error);
      res.status(500).json({ error: "Emotion analysis failed" });
    }
  });

  app.post("/api/upgrades/emotion/context", async (req, res) => {
    try {
      const { conversationHistory } = req.body;
      
      if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ error: "Conversation history array is required" });
      }

      const context = await emotionalCognition.getEmotionalContext(conversationHistory);
      
      res.json({
        success: true,
        ...context
      });
    } catch (error: any) {
      console.error("Error getting emotional context:", error);
      res.status(500).json({ error: "Failed to get emotional context" });
    }
  });

  app.get("/api/upgrades/emotion/stats", async (req, res) => {
    try {
      const stats = emotionalCognition.getEmotionStats();
      res.json({ success: true, ...stats });
    } catch (error: any) {
      console.error("Error fetching emotion stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/upgrades/language/detect", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const detection = await universalLanguage.detectLanguage(text);
      
      res.json({
        success: true,
        ...detection
      });
    } catch (error: any) {
      console.error("Error detecting language:", error);
      res.status(500).json({ error: "Language detection failed" });
    }
  });

  app.post("/api/upgrades/language/translate", async (req, res) => {
    try {
      const { text, targetLanguage, sourceLanguage, preserveTone, formalityLevel, domain } = req.body;
      
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "Text and target language are required" });
      }

      const result = await universalLanguage.translate(text, targetLanguage, {
        sourceLanguage,
        preserveTone,
        formalityLevel,
        domain
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error("Error translating:", error);
      res.status(500).json({ error: "Translation failed" });
    }
  });

  app.post("/api/upgrades/language/simplify", async (req, res) => {
    try {
      const { text, domain } = req.body;
      
      if (!text || !domain) {
        return res.status(400).json({ error: "Text and domain are required" });
      }

      const result = await universalLanguage.simplifyTerminology(text, domain);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error("Error simplifying:", error);
      res.status(500).json({ error: "Simplification failed" });
    }
  });

  app.get("/api/upgrades/language/supported", async (req, res) => {
    try {
      const languages = universalLanguage.getSupportedLanguages();
      res.json({ 
        success: true, 
        languages,
        count: languages.length 
      });
    } catch (error: any) {
      console.error("Error fetching languages:", error);
      res.status(500).json({ error: "Failed to fetch languages" });
    }
  });

  app.post("/api/upgrades/distributed/submit", async (req, res) => {
    try {
      const { type, payload, priority, timeout } = req.body;
      
      if (!type || !payload) {
        return res.status(400).json({ error: "Type and payload are required" });
      }

      const result = await decentralizedIntelligence.submitTask(type, payload, { priority, timeout });
      
      res.json({
        success: result.success,
        taskId: result.taskId,
        result: result.result,
        processingTime: result.processingTime,
        workerId: result.workerId
      });
    } catch (error: any) {
      console.error("Error submitting task:", error);
      res.status(500).json({ error: "Task submission failed" });
    }
  });

  app.get("/api/upgrades/distributed/status", async (req, res) => {
    try {
      const stats = decentralizedIntelligence.getStats();
      const workers = decentralizedIntelligence.getWorkerStatus();
      const queue = decentralizedIntelligence.getQueueStatus();

      res.json({
        success: true,
        stats,
        workers,
        queue
      });
    } catch (error: any) {
      console.error("Error fetching distributed status:", error);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  app.post("/api/upgrades/distributed/scale", async (req, res) => {
    try {
      const { workers } = req.body;
      
      if (typeof workers !== 'number' || workers < 1 || workers > 16) {
        return res.status(400).json({ error: "Workers must be a number between 1 and 16" });
      }

      await decentralizedIntelligence.scaleWorkers(workers);
      
      res.json({ 
        success: true, 
        message: `Scaled to ${workers} workers`,
        currentWorkers: decentralizedIntelligence.getWorkerStatus().length
      });
    } catch (error: any) {
      console.error("Error scaling workers:", error);
      res.status(500).json({ error: "Failed to scale workers" });
    }
  });

  app.post("/api/upgrades/ethics/assess", async (req, res) => {
    try {
      const { content, userIntent } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const assessment = await ethicalGovernance.assessEthics(content, { userIntent });
      
      res.json({
        success: true,
        ...assessment
      });
    } catch (error: any) {
      console.error("Error assessing ethics:", error);
      res.status(500).json({ error: "Ethical assessment failed" });
    }
  });

  app.post("/api/upgrades/ethics/moderate", async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const result = await ethicalGovernance.moderateContent(content);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error("Error moderating content:", error);
      res.status(500).json({ error: "Content moderation failed" });
    }
  });

  app.post("/api/upgrades/ethics/check-constraints", async (req, res) => {
    try {
      const { content, context } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const result = await ethicalGovernance.checkSafetyConstraints(content, context);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error("Error checking constraints:", error);
      res.status(500).json({ error: "Constraint check failed" });
    }
  });

  app.get("/api/upgrades/ethics/principles", async (req, res) => {
    try {
      const principles = ethicalGovernance.getActivePrinciples();
      const stats = ethicalGovernance.getModerationStats();
      
      res.json({
        success: true,
        principles,
        stats
      });
    } catch (error: any) {
      console.error("Error fetching principles:", error);
      res.status(500).json({ error: "Failed to fetch principles" });
    }
  });

  app.get("/api/upgrades/evolution/metrics", async (req, res) => {
    try {
      const metrics = await selfEvolution.getEvolutionMetrics();
      
      res.json({
        success: true,
        metrics,
        cycle: selfEvolution.getEvolutionCycle()
      });
    } catch (error: any) {
      console.error("Error fetching evolution metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/upgrades/evolution/report", async (req, res) => {
    try {
      const report = await selfEvolution.generateEvolutionReport();
      
      res.json({
        success: true,
        ...report
      });
    } catch (error: any) {
      console.error("Error generating evolution report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.post("/api/upgrades/evolution/synthesize", async (req, res) => {
    try {
      const syntheses = await selfEvolution.synthesizeKnowledge();
      
      res.json({
        success: true,
        syntheses,
        count: syntheses.length
      });
    } catch (error: any) {
      console.error("Error synthesizing knowledge:", error);
      res.status(500).json({ error: "Knowledge synthesis failed" });
    }
  });

  app.post("/api/upgrades/evolution/trigger-cycle", async (req, res) => {
    try {
      await selfEvolution.forceEvolutionCycle();
      
      res.json({
        success: true,
        message: "Evolution cycle triggered",
        cycle: selfEvolution.getEvolutionCycle()
      });
    } catch (error: any) {
      console.error("Error triggering evolution:", error);
      res.status(500).json({ error: "Failed to trigger evolution" });
    }
  });

  app.get("/api/upgrades/evolution/insights", async (req, res) => {
    try {
      const insights = selfEvolution.getMetaInsights();
      const synthesized = selfEvolution.getSynthesizedKnowledge();
      
      res.json({
        success: true,
        insights,
        synthesizedKnowledge: synthesized.slice(0, 20),
        insightCount: insights.length,
        synthesizedCount: synthesized.length
      });
    } catch (error: any) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  console.log('[Advanced Upgrades] API routes registered successfully');
}
