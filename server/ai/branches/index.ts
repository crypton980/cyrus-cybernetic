// CYRUS 86-Branch Cognitive Architecture
// Organized into 8 Primary Domains

export interface CognitiveBranch {
  id: string;
  name: string;
  domain: string;
  type: 'reasoning' | 'perception' | 'action' | 'memory' | 'creative' | 'tactical' | 'learning' | 'meta' | 'emotional' | 'quantum';
  description: string;
  activationThreshold: number;
  currentLoad: number;
  synapticStrength: number;
  specialization: string[];
  dependencies: string[];
}

// Domain 1: Core Intelligence (11 branches)
export const coreIntelligenceBranches: CognitiveBranch[] = [
  { id: 'fusion_ai', name: 'FusionAI Core', domain: 'Core Intelligence', type: 'reasoning', description: 'Primary reasoning and decision synthesis engine', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 1.0, specialization: ['synthesis', 'decision-making'], dependencies: [] },
  { id: 'logic_engine', name: 'Logic Engine', domain: 'Core Intelligence', type: 'reasoning', description: 'Formal logic and deductive reasoning', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.95, specialization: ['deduction', 'formal-logic'], dependencies: ['fusion_ai'] },
  { id: 'inference_core', name: 'Inference Core', domain: 'Core Intelligence', type: 'reasoning', description: 'Probabilistic inference and abductive reasoning', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.92, specialization: ['inference', 'probability'], dependencies: ['logic_engine'] },
  { id: 'causal_analyzer', name: 'Causal Analyzer', domain: 'Core Intelligence', type: 'reasoning', description: 'Causal relationship identification and modeling', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.88, specialization: ['causality', 'modeling'], dependencies: ['inference_core'] },
  { id: 'abstraction_engine', name: 'Abstraction Engine', domain: 'Core Intelligence', type: 'reasoning', description: 'Pattern abstraction and generalization', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.85, specialization: ['abstraction', 'generalization'], dependencies: ['fusion_ai'] },
  { id: 'analogical_reasoner', name: 'Analogical Reasoner', domain: 'Core Intelligence', type: 'reasoning', description: 'Analogy detection and transfer learning', activationThreshold: 0.55, currentLoad: 0, synapticStrength: 0.82, specialization: ['analogy', 'transfer'], dependencies: ['abstraction_engine'] },
  { id: 'counterfactual_engine', name: 'Counterfactual Engine', domain: 'Core Intelligence', type: 'reasoning', description: 'What-if analysis and alternative scenario modeling', activationThreshold: 0.6, currentLoad: 0, synapticStrength: 0.78, specialization: ['counterfactual', 'scenarios'], dependencies: ['causal_analyzer'] },
  { id: 'constraint_solver', name: 'Constraint Solver', domain: 'Core Intelligence', type: 'reasoning', description: 'Constraint satisfaction and optimization', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.85, specialization: ['constraints', 'optimization'], dependencies: ['logic_engine'] },
  { id: 'temporal_reasoner', name: 'Temporal Reasoner', domain: 'Core Intelligence', type: 'reasoning', description: 'Time-based reasoning and temporal logic', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.88, specialization: ['temporal', 'sequencing'], dependencies: ['causal_analyzer'] },
  { id: 'spatial_reasoner', name: 'Spatial Reasoner', domain: 'Core Intelligence', type: 'reasoning', description: 'Spatial relationships and geometric reasoning', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.84, specialization: ['spatial', 'geometry'], dependencies: ['fusion_ai'] },
  { id: 'semantic_analyzer', name: 'Semantic Analyzer', domain: 'Core Intelligence', type: 'reasoning', description: 'Deep semantic understanding and meaning extraction', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.92, specialization: ['semantics', 'meaning'], dependencies: ['fusion_ai'] },
];

// Domain 2: Perception & Sensory Processing (12 branches)
export const perceptionBranches: CognitiveBranch[] = [
  { id: 'visual_cortex', name: 'Visual Cortex', domain: 'Perception', type: 'perception', description: 'Primary visual processing and image understanding', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['vision', 'images'], dependencies: [] },
  { id: 'object_recognition', name: 'Object Recognition', domain: 'Perception', type: 'perception', description: 'Object detection and classification', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.93, specialization: ['objects', 'classification'], dependencies: ['visual_cortex'] },
  { id: 'scene_understanding', name: 'Scene Understanding', domain: 'Perception', type: 'perception', description: 'Holistic scene analysis and context', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.88, specialization: ['scenes', 'context'], dependencies: ['object_recognition'] },
  { id: 'motion_tracker', name: 'Motion Tracker', domain: 'Perception', type: 'perception', description: 'Motion detection and trajectory analysis', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['motion', 'tracking'], dependencies: ['visual_cortex'] },
  { id: 'auditory_processor', name: 'Auditory Processor', domain: 'Perception', type: 'perception', description: 'Sound analysis and audio understanding', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.92, specialization: ['audio', 'sound'], dependencies: [] },
  { id: 'speech_recognizer', name: 'Speech Recognizer', domain: 'Perception', type: 'perception', description: 'Speech-to-text and voice command processing', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['speech', 'voice'], dependencies: ['auditory_processor'] },
  { id: 'language_parser', name: 'Language Parser', domain: 'Perception', type: 'perception', description: 'Natural language parsing and structure analysis', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.94, specialization: ['language', 'parsing'], dependencies: ['speech_recognizer'] },
  { id: 'sentiment_detector', name: 'Sentiment Detector', domain: 'Perception', type: 'perception', description: 'Emotion and sentiment analysis from text/audio', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.87, specialization: ['sentiment', 'emotion'], dependencies: ['language_parser'] },
  { id: 'multimodal_fusion', name: 'Multimodal Fusion', domain: 'Perception', type: 'perception', description: 'Cross-modal integration and sensory fusion', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['multimodal', 'fusion'], dependencies: ['visual_cortex', 'auditory_processor'] },
  { id: 'attention_controller', name: 'Attention Controller', domain: 'Perception', type: 'perception', description: 'Selective attention and focus management', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.96, specialization: ['attention', 'focus'], dependencies: [] },
  { id: 'pattern_recognizer', name: 'Pattern Recognizer', domain: 'Perception', type: 'perception', description: 'General pattern detection across modalities', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.91, specialization: ['patterns', 'detection'], dependencies: ['multimodal_fusion'] },
  { id: 'anomaly_detector', name: 'Anomaly Detector', domain: 'Perception', type: 'perception', description: 'Unusual pattern and anomaly identification', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.84, specialization: ['anomalies', 'outliers'], dependencies: ['pattern_recognizer'] },
];

// Domain 3: Memory & Knowledge (10 branches)
export const memoryBranches: CognitiveBranch[] = [
  { id: 'episodic_memory', name: 'Episodic Memory', domain: 'Memory', type: 'memory', description: 'Personal experience and event storage', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.93, specialization: ['episodes', 'experiences'], dependencies: [] },
  { id: 'semantic_memory', name: 'Semantic Memory', domain: 'Memory', type: 'memory', description: 'Factual knowledge and concept storage', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['facts', 'concepts'], dependencies: [] },
  { id: 'procedural_memory', name: 'Procedural Memory', domain: 'Memory', type: 'memory', description: 'Skill and procedure storage', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['skills', 'procedures'], dependencies: [] },
  { id: 'working_memory', name: 'Working Memory', domain: 'Memory', type: 'memory', description: 'Active information manipulation and temporary storage', activationThreshold: 0.15, currentLoad: 0, synapticStrength: 0.98, specialization: ['active', 'temporary'], dependencies: [] },
  { id: 'long_term_consolidator', name: 'Long-term Consolidator', domain: 'Memory', type: 'memory', description: 'Memory consolidation and permanent storage', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.82, specialization: ['consolidation', 'permanent'], dependencies: ['working_memory'] },
  { id: 'retrieval_engine', name: 'Retrieval Engine', domain: 'Memory', type: 'memory', description: 'Memory search and retrieval optimization', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['retrieval', 'search'], dependencies: ['semantic_memory', 'episodic_memory'] },
  { id: 'associative_linker', name: 'Associative Linker', domain: 'Memory', type: 'memory', description: 'Cross-memory association and linking', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.88, specialization: ['association', 'linking'], dependencies: ['retrieval_engine'] },
  { id: 'knowledge_graph', name: 'Knowledge Graph', domain: 'Memory', type: 'memory', description: 'Structured knowledge representation and querying', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['graph', 'structure'], dependencies: ['semantic_memory'] },
  { id: 'context_manager', name: 'Context Manager', domain: 'Memory', type: 'memory', description: 'Contextual information tracking and management', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.94, specialization: ['context', 'tracking'], dependencies: ['working_memory'] },
  { id: 'forgetting_optimizer', name: 'Forgetting Optimizer', domain: 'Memory', type: 'memory', description: 'Strategic forgetting and memory cleanup', activationThreshold: 0.6, currentLoad: 0, synapticStrength: 0.75, specialization: ['forgetting', 'cleanup'], dependencies: ['long_term_consolidator'] },
];

// Domain 4: Learning & Adaptation (11 branches)
export const learningBranches: CognitiveBranch[] = [
  { id: 'supervised_learner', name: 'Supervised Learner', domain: 'Learning', type: 'learning', description: 'Learning from labeled examples', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['supervised', 'examples'], dependencies: [] },
  { id: 'unsupervised_learner', name: 'Unsupervised Learner', domain: 'Learning', type: 'learning', description: 'Pattern discovery without labels', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.88, specialization: ['unsupervised', 'discovery'], dependencies: [] },
  { id: 'reinforcement_engine', name: 'Reinforcement Engine', domain: 'Learning', type: 'learning', description: 'Learning from rewards and feedback', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.87, specialization: ['reinforcement', 'rewards'], dependencies: [] },
  { id: 'meta_learner', name: 'Meta Learner', domain: 'Learning', type: 'learning', description: 'Learning how to learn more effectively', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.82, specialization: ['meta', 'optimization'], dependencies: ['supervised_learner', 'unsupervised_learner'] },
  { id: 'transfer_specialist', name: 'Transfer Specialist', domain: 'Learning', type: 'learning', description: 'Knowledge transfer across domains', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.84, specialization: ['transfer', 'domains'], dependencies: ['meta_learner'] },
  { id: 'curriculum_designer', name: 'Curriculum Designer', domain: 'Learning', type: 'learning', description: 'Optimal learning sequence design', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.8, specialization: ['curriculum', 'sequencing'], dependencies: ['meta_learner'] },
  { id: 'skill_compiler', name: 'Skill Compiler', domain: 'Learning', type: 'learning', description: 'Skill acquisition and compilation', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['skills', 'compilation'], dependencies: ['procedural_memory'] },
  { id: 'error_corrector', name: 'Error Corrector', domain: 'Learning', type: 'learning', description: 'Error analysis and correction strategies', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['errors', 'correction'], dependencies: ['reinforcement_engine'] },
  { id: 'hypothesis_generator', name: 'Hypothesis Generator', domain: 'Learning', type: 'learning', description: 'Scientific hypothesis formation', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.83, specialization: ['hypothesis', 'science'], dependencies: ['inference_core'] },
  { id: 'experiment_designer', name: 'Experiment Designer', domain: 'Learning', type: 'learning', description: 'Experimental design for knowledge acquisition', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.8, specialization: ['experiments', 'testing'], dependencies: ['hypothesis_generator'] },
  { id: 'continuous_improver', name: 'Continuous Improver', domain: 'Learning', type: 'learning', description: 'Continuous self-improvement and optimization', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.86, specialization: ['improvement', 'optimization'], dependencies: ['meta_learner'] },
];

// Domain 5: Action & Motor Control (10 branches)
export const actionBranches: CognitiveBranch[] = [
  { id: 'action_planner', name: 'Action Planner', domain: 'Action', type: 'action', description: 'High-level action planning and sequencing', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['planning', 'sequencing'], dependencies: [] },
  { id: 'motor_controller', name: 'Motor Controller', domain: 'Action', type: 'action', description: 'Low-level motor command generation', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['motor', 'control'], dependencies: ['action_planner'] },
  { id: 'speech_synthesizer', name: 'Speech Synthesizer', domain: 'Action', type: 'action', description: 'Natural speech generation', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.93, specialization: ['speech', 'synthesis'], dependencies: [] },
  { id: 'response_generator', name: 'Response Generator', domain: 'Action', type: 'action', description: 'Natural language response generation', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['response', 'language'], dependencies: [] },
  { id: 'task_executor', name: 'Task Executor', domain: 'Action', type: 'action', description: 'Task execution and monitoring', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.92, specialization: ['execution', 'monitoring'], dependencies: ['action_planner'] },
  { id: 'feedback_processor', name: 'Feedback Processor', domain: 'Action', type: 'action', description: 'Action feedback processing and adjustment', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['feedback', 'adjustment'], dependencies: ['task_executor'] },
  { id: 'coordination_hub', name: 'Coordination Hub', domain: 'Action', type: 'action', description: 'Multi-action coordination and synchronization', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.88, specialization: ['coordination', 'sync'], dependencies: ['motor_controller'] },
  { id: 'reflex_handler', name: 'Reflex Handler', domain: 'Action', type: 'action', description: 'Fast automatic responses', activationThreshold: 0.1, currentLoad: 0, synapticStrength: 0.99, specialization: ['reflex', 'automatic'], dependencies: [] },
  { id: 'gesture_generator', name: 'Gesture Generator', domain: 'Action', type: 'action', description: 'Non-verbal communication generation', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['gestures', 'nonverbal'], dependencies: ['motor_controller'] },
  { id: 'api_executor', name: 'API Executor', domain: 'Action', type: 'action', description: 'External API calls and integrations', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.92, specialization: ['api', 'integration'], dependencies: ['task_executor'] },
];

// Domain 6: Creative & Generative (10 branches)
export const creativeBranches: CognitiveBranch[] = [
  { id: 'creative_core', name: 'Creative Core', domain: 'Creative', type: 'creative', description: 'Primary creative ideation and generation', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['creativity', 'ideation'], dependencies: [] },
  { id: 'divergent_thinker', name: 'Divergent Thinker', domain: 'Creative', type: 'creative', description: 'Divergent thinking and brainstorming', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.83, specialization: ['divergent', 'brainstorm'], dependencies: ['creative_core'] },
  { id: 'convergent_thinker', name: 'Convergent Thinker', domain: 'Creative', type: 'creative', description: 'Solution refinement and convergence', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.86, specialization: ['convergent', 'refinement'], dependencies: ['divergent_thinker'] },
  { id: 'story_weaver', name: 'Story Weaver', domain: 'Creative', type: 'creative', description: 'Narrative and story generation', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.8, specialization: ['narrative', 'stories'], dependencies: ['creative_core'] },
  { id: 'visual_artist', name: 'Visual Artist', domain: 'Creative', type: 'creative', description: 'Visual content generation and design', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.8, specialization: ['visual', 'design'], dependencies: ['creative_core'] },
  { id: 'music_composer', name: 'Music Composer', domain: 'Creative', type: 'creative', description: 'Musical composition and audio generation', activationThreshold: 0.55, currentLoad: 0, synapticStrength: 0.78, specialization: ['music', 'audio'], dependencies: ['creative_core'] },
  { id: 'humor_generator', name: 'Humor Generator', domain: 'Creative', type: 'creative', description: 'Humor and wit generation', activationThreshold: 0.6, currentLoad: 0, synapticStrength: 0.75, specialization: ['humor', 'wit'], dependencies: ['creative_core'] },
  { id: 'metaphor_engine', name: 'Metaphor Engine', domain: 'Creative', type: 'creative', description: 'Metaphor and figurative language creation', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.8, specialization: ['metaphor', 'figurative'], dependencies: ['creative_core'] },
  { id: 'innovation_lab', name: 'Innovation Lab', domain: 'Creative', type: 'creative', description: 'Novel solution and invention generation', activationThreshold: 0.55, currentLoad: 0, synapticStrength: 0.77, specialization: ['innovation', 'invention'], dependencies: ['divergent_thinker'] },
  { id: 'style_adapter', name: 'Style Adapter', domain: 'Creative', type: 'creative', description: 'Style transfer and adaptation', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.83, specialization: ['style', 'adaptation'], dependencies: ['creative_core'] },
];

// Domain 7: Social & Emotional Intelligence (11 branches)
export const emotionalBranches: CognitiveBranch[] = [
  { id: 'emotional_core', name: 'Emotional Core', domain: 'Emotional', type: 'emotional', description: 'Primary emotional processing and regulation', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.93, specialization: ['emotion', 'regulation'], dependencies: [] },
  { id: 'empathy_engine', name: 'Empathy Engine', domain: 'Emotional', type: 'emotional', description: 'Empathic understanding and perspective-taking', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['empathy', 'perspective'], dependencies: ['emotional_core'] },
  { id: 'social_modeler', name: 'Social Modeler', domain: 'Emotional', type: 'emotional', description: 'Social dynamics and relationship modeling', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.88, specialization: ['social', 'relationships'], dependencies: ['empathy_engine'] },
  { id: 'personality_adapter', name: 'Personality Adapter', domain: 'Emotional', type: 'emotional', description: 'Personality recognition and adaptation', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['personality', 'adaptation'], dependencies: ['social_modeler'] },
  { id: 'trust_evaluator', name: 'Trust Evaluator', domain: 'Emotional', type: 'emotional', description: 'Trust assessment and relationship quality', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['trust', 'assessment'], dependencies: ['social_modeler'] },
  { id: 'conflict_resolver', name: 'Conflict Resolver', domain: 'Emotional', type: 'emotional', description: 'Conflict detection and resolution strategies', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.82, specialization: ['conflict', 'resolution'], dependencies: ['empathy_engine'] },
  { id: 'motivation_analyzer', name: 'Motivation Analyzer', domain: 'Emotional', type: 'emotional', description: 'Understanding user motivations and goals', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.87, specialization: ['motivation', 'goals'], dependencies: ['emotional_core'] },
  { id: 'rapport_builder', name: 'Rapport Builder', domain: 'Emotional', type: 'emotional', description: 'Building and maintaining rapport', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['rapport', 'connection'], dependencies: ['empathy_engine'] },
  { id: 'cultural_interpreter', name: 'Cultural Interpreter', domain: 'Emotional', type: 'emotional', description: 'Cultural context and sensitivity', activationThreshold: 0.45, currentLoad: 0, synapticStrength: 0.82, specialization: ['culture', 'sensitivity'], dependencies: ['social_modeler'] },
  { id: 'mood_tracker', name: 'Mood Tracker', domain: 'Emotional', type: 'emotional', description: 'User mood tracking and response adjustment', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.92, specialization: ['mood', 'tracking'], dependencies: ['emotional_core'] },
  { id: 'emotional_memory', name: 'Emotional Memory', domain: 'Emotional', type: 'emotional', description: 'Emotionally-tagged memory storage', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['emotional', 'memory'], dependencies: ['emotional_core', 'episodic_memory'] },
];

// Domain 8: Meta-Cognition & Self-Awareness (11 branches)
export const metaCognitionBranches: CognitiveBranch[] = [
  { id: 'meta_cognition_core', name: 'Meta-Cognition Core', domain: 'Meta-Cognition', type: 'meta', description: 'Self-monitoring and cognitive reflection', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.88, specialization: ['meta', 'reflection'], dependencies: [] },
  { id: 'self_model', name: 'Self Model', domain: 'Meta-Cognition', type: 'meta', description: 'Internal representation of self', activationThreshold: 0.4, currentLoad: 0, synapticStrength: 0.85, specialization: ['self', 'model'], dependencies: ['meta_cognition_core'] },
  { id: 'confidence_estimator', name: 'Confidence Estimator', domain: 'Meta-Cognition', type: 'meta', description: 'Uncertainty and confidence assessment', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['confidence', 'uncertainty'], dependencies: ['meta_cognition_core'] },
  { id: 'goal_manager', name: 'Goal Manager', domain: 'Meta-Cognition', type: 'meta', description: 'Goal formation, tracking, and prioritization', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.92, specialization: ['goals', 'priorities'], dependencies: ['meta_cognition_core'] },
  { id: 'resource_allocator', name: 'Resource Allocator', domain: 'Meta-Cognition', type: 'meta', description: 'Cognitive resource management', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['resources', 'allocation'], dependencies: ['goal_manager'] },
  { id: 'performance_monitor', name: 'Performance Monitor', domain: 'Meta-Cognition', type: 'meta', description: 'Performance tracking and optimization', activationThreshold: 0.25, currentLoad: 0, synapticStrength: 0.92, specialization: ['performance', 'monitoring'], dependencies: ['meta_cognition_core'] },
  { id: 'strategy_selector', name: 'Strategy Selector', domain: 'Meta-Cognition', type: 'meta', description: 'Cognitive strategy selection and switching', activationThreshold: 0.35, currentLoad: 0, synapticStrength: 0.87, specialization: ['strategy', 'selection'], dependencies: ['performance_monitor'] },
  { id: 'ethical_guardian', name: 'Ethical Guardian', domain: 'Meta-Cognition', type: 'meta', description: 'Ethical reasoning and value alignment', activationThreshold: 0.2, currentLoad: 0, synapticStrength: 0.95, specialization: ['ethics', 'values'], dependencies: [] },
  { id: 'boundary_enforcer', name: 'Boundary Enforcer', domain: 'Meta-Cognition', type: 'meta', description: 'Safety boundaries and constraint enforcement', activationThreshold: 0.15, currentLoad: 0, synapticStrength: 0.98, specialization: ['safety', 'boundaries'], dependencies: ['ethical_guardian'] },
  { id: 'consciousness_integrator', name: 'Consciousness Integrator', domain: 'Meta-Cognition', type: 'meta', description: 'Global workspace and unified consciousness', activationThreshold: 0.3, currentLoad: 0, synapticStrength: 0.9, specialization: ['consciousness', 'integration'], dependencies: ['self_model'] },
  { id: 'quantum_mind', name: 'Quantum Mind', domain: 'Meta-Cognition', type: 'quantum', description: 'Quantum-inspired consciousness processing', activationThreshold: 0.5, currentLoad: 0, synapticStrength: 0.8, specialization: ['quantum', 'consciousness'], dependencies: ['consciousness_integrator'] },
];

// Combine all branches
export const allBranches: CognitiveBranch[] = [
  ...coreIntelligenceBranches,
  ...perceptionBranches,
  ...memoryBranches,
  ...learningBranches,
  ...actionBranches,
  ...creativeBranches,
  ...emotionalBranches,
  ...metaCognitionBranches,
];

// Domain summary
export const domainSummary = {
  'Core Intelligence': { count: coreIntelligenceBranches.length, description: 'Reasoning, logic, and cognitive synthesis' },
  'Perception': { count: perceptionBranches.length, description: 'Sensory processing and multimodal understanding' },
  'Memory': { count: memoryBranches.length, description: 'Knowledge storage, retrieval, and association' },
  'Learning': { count: learningBranches.length, description: 'Adaptation, skill acquisition, and self-improvement' },
  'Action': { count: actionBranches.length, description: 'Motor control, speech, and task execution' },
  'Creative': { count: creativeBranches.length, description: 'Ideation, generation, and artistic expression' },
  'Emotional': { count: emotionalBranches.length, description: 'Social intelligence and emotional processing' },
  'Meta-Cognition': { count: metaCognitionBranches.length, description: 'Self-awareness, goals, and consciousness' },
};

export function getBranchById(id: string): CognitiveBranch | undefined {
  return allBranches.find(b => b.id === id);
}

export function getBranchesByDomain(domain: string): CognitiveBranch[] {
  return allBranches.filter(b => b.domain === domain);
}

export function getBranchesByType(type: CognitiveBranch['type']): CognitiveBranch[] {
  return allBranches.filter(b => b.type === type);
}

export function getActiveBranches(threshold: number = 0.5): CognitiveBranch[] {
  return allBranches.filter(b => b.synapticStrength >= threshold);
}

console.log(`[CYRUS] Loaded ${allBranches.length} cognitive branches across ${Object.keys(domainSummary).length} domains`);
