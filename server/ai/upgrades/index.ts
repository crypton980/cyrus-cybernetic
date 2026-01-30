export { vectorKnowledgeBase, type VectorDocument, type SemanticSearchResult, type RAGContext } from './vector-knowledge-base';
export { emotionalCognition, type EmotionState, type SentimentAnalysis, type EmotionalContext, type CrisisIndicators } from './emotional-cognition';
export { universalLanguage, type LanguageDetection, type TranslationResult, type MultilingualContext } from './universal-language';
export { decentralizedIntelligence, type DistributedTask, type TaskResult, type WorkerNode, type ClusterStats } from './decentralized-intelligence';
export { ethicalGovernance, type EthicalAssessment, type ContentModerationResult, type EthicalConcern } from './ethical-governance';
export { selfEvolution, type EvolutionMetrics, type KnowledgeSynthesis, type MetaLearningInsight } from './self-evolution-enhanced';

export interface AdvancedUpgradesStatus {
  vectorKnowledgeBase: {
    active: boolean;
    documentsLoaded: number;
    domains: string[];
  };
  emotionalCognition: {
    active: boolean;
    emotionsAnalyzed: number;
    averageValence: number;
  };
  universalLanguage: {
    active: boolean;
    supportedLanguages: number;
    translationsPerformed: number;
  };
  decentralizedIntelligence: {
    active: boolean;
    workers: number;
    tasksCompleted: number;
    throughput: number;
  };
  ethicalGovernance: {
    active: boolean;
    constraintsActive: number;
    moderationRate: number;
  };
  selfEvolution: {
    active: boolean;
    evolutionCycle: number;
    knowledgeSynthesized: number;
    metaInsights: number;
  };
}

import { vectorKnowledgeBase } from './vector-knowledge-base';
import { emotionalCognition } from './emotional-cognition';
import { universalLanguage } from './universal-language';
import { decentralizedIntelligence } from './decentralized-intelligence';
import { ethicalGovernance } from './ethical-governance';
import { selfEvolution } from './self-evolution-enhanced';

export function getAdvancedUpgradesStatus(): AdvancedUpgradesStatus {
  const vkbStats = vectorKnowledgeBase.getStats();
  const emotionStats = emotionalCognition.getEmotionStats();
  const diStats = decentralizedIntelligence.getStats();
  const ethicsStats = ethicalGovernance.getModerationStats();

  return {
    vectorKnowledgeBase: {
      active: true,
      documentsLoaded: vkbStats.totalDocuments,
      domains: vkbStats.domains
    },
    emotionalCognition: {
      active: true,
      emotionsAnalyzed: emotionStats.totalAnalyzed,
      averageValence: emotionStats.averageValence
    },
    universalLanguage: {
      active: true,
      supportedLanguages: universalLanguage.getSupportedLanguages().length,
      translationsPerformed: 0
    },
    decentralizedIntelligence: {
      active: true,
      workers: diStats.totalWorkers,
      tasksCompleted: diStats.tasksCompleted,
      throughput: diStats.throughput
    },
    ethicalGovernance: {
      active: true,
      constraintsActive: 5,
      moderationRate: ethicsStats.approvalRate
    },
    selfEvolution: {
      active: true,
      evolutionCycle: selfEvolution.getEvolutionCycle(),
      knowledgeSynthesized: selfEvolution.getSynthesizedKnowledge().length,
      metaInsights: selfEvolution.getMetaInsights().length
    }
  };
}

console.log('[Advanced Upgrades] All 6 upgrade modules initialized:');
console.log('  - Vector Knowledge Base (Semantic Memory & RAG)');
console.log('  - Emotional Cognition (Advanced Sentiment & Empathy)');
console.log('  - Universal Language (196+ Language Translation)');
console.log('  - Decentralized Intelligence (Parallel Processing)');
console.log('  - Ethical Governance (Safety & Moderation)');
console.log('  - Self-Evolution Enhanced (Knowledge Synthesis & Meta-Learning)');
