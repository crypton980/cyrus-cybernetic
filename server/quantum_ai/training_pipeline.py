"""
CYRUS Quantum Intelligence Training Pipeline v2.0
Comprehensive training system for enhancing all core AI capabilities.
Uses numpy/scipy/scikit-learn for real algorithmic training.
"""

import numpy as np
import json
import time
import logging
import threading
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
from collections import defaultdict

try:
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.decomposition import NMF, PCA, LatentDirichletAllocation
    from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
    from sklearn.svm import SVC
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, AdaBoostClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import silhouette_score, accuracy_score, f1_score
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.neural_network import MLPClassifier
    from scipy import sparse
    from scipy.spatial.distance import cosine
    import scipy.stats as stats
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger(__name__)

KNOWLEDGE_DOMAINS = {
    'medicine': {
        'concepts': [
            'cardiovascular system anatomy and physiology',
            'neurological disorders and treatment pathways',
            'immunology and vaccine development mechanisms',
            'oncology tumor classification and staging',
            'respiratory system gas exchange mechanics',
            'endocrine system hormone regulation',
            'musculoskeletal biomechanics and rehabilitation',
            'pharmacokinetics drug absorption distribution metabolism',
            'hematology blood cell morphology and disorders',
            'nephrology renal filtration and electrolyte balance',
            'hepatology liver function and metabolic pathways',
            'ophthalmology retinal anatomy and visual processing',
            'dermatology skin layer structure and pathology',
            'gastroenterology digestive enzyme cascade',
            'pulmonology ventilation perfusion matching',
            'pathogen identification microbiology diagnostics',
            'surgical procedures minimally invasive techniques',
            'emergency medicine triage protocols',
            'pediatric developmental milestones assessment',
            'geriatric polypharmacy management',
            'infectious disease epidemiology contact tracing',
            'radiology imaging modalities CT MRI ultrasound',
            'clinical laboratory diagnostics biomarkers',
            'pain management multimodal analgesia',
            'wound healing stages and tissue regeneration',
        ],
        'weight': 1.2
    },
    'technology': {
        'concepts': [
            'distributed systems consensus algorithms Raft Paxos',
            'machine learning neural network architectures CNN RNN transformer',
            'cryptography public key infrastructure TLS certificates',
            'cloud computing containerization Kubernetes orchestration',
            'database systems ACID transactions query optimization',
            'network protocols TCP IP routing BGP DNS resolution',
            'operating systems kernel scheduling memory management',
            'compiler design lexical analysis abstract syntax trees',
            'computer vision object detection semantic segmentation',
            'natural language processing tokenization embeddings attention',
            'blockchain distributed ledger smart contract execution',
            'quantum computing qubit entanglement gate operations',
            'cybersecurity threat modeling penetration testing',
            'microservices architecture service mesh API gateway',
            'real-time systems embedded programming RTOS',
            'edge computing IoT sensor fusion protocols',
            'software engineering design patterns SOLID principles',
            'data engineering ETL pipeline stream processing',
            'DevOps CI/CD pipeline infrastructure as code',
            'mobile development cross-platform native rendering',
            'web assembly WASM performance optimization',
            'graph databases knowledge representation ontologies',
            'search engine indexing ranking algorithms PageRank',
            'recommendation systems collaborative filtering',
            'autonomous systems SLAM navigation path planning',
        ],
        'weight': 1.0
    },
    'science': {
        'concepts': [
            'quantum mechanics wave function Schrodinger equation',
            'molecular biology DNA replication transcription translation',
            'astrophysics stellar evolution black hole thermodynamics',
            'organic chemistry reaction mechanisms stereochemistry',
            'thermodynamics entropy enthalpy Gibbs free energy',
            'electromagnetism Maxwell equations wave propagation',
            'genetics CRISPR gene editing epigenetic modification',
            'neuroscience synaptic plasticity long-term potentiation',
            'ecology ecosystem dynamics population modeling',
            'materials science crystal structure phase transitions',
            'particle physics standard model Higgs mechanism',
            'biochemistry enzyme kinetics Michaelis Menten',
            'geophysics plate tectonics seismic wave analysis',
            'oceanography thermohaline circulation marine biology',
            'atmospheric science climate modeling greenhouse effect',
            'evolutionary biology natural selection genetic drift',
            'bioinformatics sequence alignment protein folding',
            'analytical chemistry spectroscopy mass spectrometry',
            'nuclear physics fission fusion radioactive decay',
            'condensed matter physics superconductivity semiconductors',
            'fluid dynamics Navier Stokes turbulence modeling',
            'optics photonics laser physics fiber communication',
            'paleontology fossil record stratigraphy dating methods',
            'virology viral replication host cell interaction',
            'immunogenetics HLA system antigen presentation',
        ],
        'weight': 1.1
    },
    'engineering': {
        'concepts': [
            'structural analysis finite element method stress strain',
            'control systems PID feedback loop stability analysis',
            'signal processing Fourier transform digital filtering',
            'power systems grid stability renewable energy integration',
            'aerospace propulsion orbital mechanics flight dynamics',
            'robotics inverse kinematics motion planning',
            'telecommunications modulation coding channel capacity',
            'VLSI design logic synthesis timing analysis',
            'manufacturing systems lean production quality control',
            'biomedical engineering prosthetics implant materials',
            'environmental engineering water treatment remediation',
            'geotechnical engineering soil mechanics foundation design',
            'transportation systems traffic flow optimization',
            'acoustic engineering noise control room design',
            'thermal engineering heat exchanger HVAC systems',
            'mechatronics sensor actuator integration',
            'naval architecture hydrodynamics ship stability',
            'mining engineering extraction processing methods',
            'petroleum engineering reservoir modeling drilling',
            'nuclear engineering reactor design shielding',
        ],
        'weight': 0.9
    },
    'security': {
        'concepts': [
            'threat intelligence adversary tactics techniques procedures',
            'network security firewall intrusion detection prevention',
            'application security OWASP vulnerabilities injection XSS',
            'identity access management zero trust architecture',
            'incident response forensics chain of custody',
            'malware analysis reverse engineering sandboxing',
            'security operations center SIEM correlation rules',
            'vulnerability management scanning patching prioritization',
            'cloud security shared responsibility IAM policies',
            'encryption standards AES RSA elliptic curve',
            'penetration testing methodology reconnaissance exploitation',
            'social engineering phishing awareness defense',
            'compliance frameworks NIST ISO SOC2 GDPR',
            'operational security OPSEC counterintelligence',
            'physical security access control surveillance',
            'supply chain security third-party risk assessment',
            'mobile security MDM app sandboxing',
            'IoT security firmware analysis protocol vulnerabilities',
            'red team blue team purple team exercises',
            'data loss prevention classification labeling',
        ],
        'weight': 1.0
    },
    'trading': {
        'concepts': [
            'technical analysis candlestick patterns support resistance',
            'fundamental analysis earnings valuation DCF models',
            'risk management position sizing portfolio allocation',
            'algorithmic trading market microstructure order book',
            'derivatives options pricing Black-Scholes Greeks',
            'forex currency pairs pip calculation leverage',
            'cryptocurrency blockchain DeFi yield farming',
            'quantitative finance statistical arbitrage pairs trading',
            'market psychology sentiment indicators fear greed',
            'macroeconomics monetary policy interest rate impact',
            'fixed income bond pricing yield curve analysis',
            'commodities futures contango backwardation hedging',
            'portfolio optimization Markowitz efficient frontier',
            'behavioral finance cognitive biases prospect theory',
            'high-frequency trading latency colocation strategies',
            'volatility modeling GARCH implied realized variance',
            'credit risk analysis default probability recovery',
            'regulatory compliance market manipulation detection',
            'emerging markets sovereign risk geopolitical analysis',
            'ESG investing sustainable finance impact metrics',
        ],
        'weight': 1.0
    },
    'mathematics': {
        'concepts': [
            'linear algebra eigenvalue decomposition matrix factorization',
            'calculus differential equations integral transforms',
            'probability theory Bayesian inference Markov chains',
            'topology manifolds homeomorphisms fundamental group',
            'number theory prime distribution modular arithmetic',
            'combinatorics graph theory Ramsey theory',
            'abstract algebra group ring field structures',
            'real analysis convergence measure theory Lebesgue',
            'complex analysis holomorphic functions residue theorem',
            'numerical analysis interpolation numerical integration',
            'optimization convex programming gradient descent',
            'differential geometry curvature geodesics Riemannian',
            'category theory functors natural transformations',
            'logic formal systems Godel incompleteness',
            'statistics hypothesis testing regression ANOVA',
        ],
        'weight': 0.8
    },
    'military_defense': {
        'concepts': [
            'command control communications C4ISR architecture',
            'electronic warfare signal intelligence countermeasures',
            'unmanned systems UAV UGV autonomous operations',
            'ballistic missile defense trajectory analysis',
            'special operations mission planning force multiplication',
            'intelligence analysis OSINT HUMINT SIGINT fusion',
            'logistics supply chain force projection readiness',
            'cyber warfare offensive defensive operations',
            'space domain awareness satellite constellation management',
            'nuclear deterrence strategic stability arms control',
            'combined arms maneuver tactical employment',
            'asymmetric warfare counterinsurgency strategy',
            'maritime domain awareness naval fleet operations',
            'air superiority beyond visual range engagement',
            'psychological operations influence campaigns',
        ],
        'weight': 0.9
    },
    'psychology': {
        'concepts': [
            'cognitive psychology attention memory decision making',
            'clinical psychology assessment diagnosis treatment planning',
            'developmental psychology lifespan stages milestones',
            'social psychology conformity obedience group dynamics',
            'neuropsychology brain behavior relationships assessment',
            'personality theories trait Big Five psychodynamic',
            'psychopharmacology neurotransmitter drug interactions',
            'forensic psychology criminal profiling risk assessment',
            'organizational psychology leadership motivation culture',
            'educational psychology learning theories metacognition',
        ],
        'weight': 0.7
    },
    'law': {
        'concepts': [
            'constitutional law judicial review due process',
            'criminal law elements of offense defense strategies',
            'international law treaties sovereignty jurisdiction',
            'intellectual property patents trademarks copyrights',
            'corporate law governance fiduciary duty compliance',
            'environmental law regulations enforcement remediation',
            'labor law employment contracts discrimination rights',
            'tax law code compliance planning strategies',
            'cybersecurity law data breach notification requirements',
            'human rights law fundamental freedoms protections',
        ],
        'weight': 0.6
    }
}


class TrainingMetrics:
    def __init__(self):
        self.metrics = defaultdict(list)
        self.start_time = None
        self.end_time = None
        self.phase_times = {}
    
    def start(self):
        self.start_time = time.time()
    
    def end(self):
        self.end_time = time.time()
    
    def record(self, name: str, value: float):
        self.metrics[name].append(value)
    
    def start_phase(self, phase: str):
        self.phase_times[phase] = {'start': time.time()}
    
    def end_phase(self, phase: str):
        if phase in self.phase_times:
            self.phase_times[phase]['end'] = time.time()
            self.phase_times[phase]['duration'] = self.phase_times[phase]['end'] - self.phase_times[phase]['start']
    
    def summary(self) -> Dict:
        result = {}
        for name, values in self.metrics.items():
            arr = np.array(values)
            result[name] = {
                'mean': float(np.mean(arr)),
                'std': float(np.std(arr)),
                'min': float(np.min(arr)),
                'max': float(np.max(arr)),
                'count': len(values)
            }
        result['total_time'] = self.end_time - self.start_time if self.end_time and self.start_time else 0
        result['phases'] = {k: v.get('duration', 0) for k, v in self.phase_times.items()}
        return result


class CYRUSTrainingPipeline:
    """
    Comprehensive training pipeline for CYRUS Humanoid Intelligence.
    Trains core algorithms, builds knowledge embeddings, and enhances capabilities.
    """
    
    def __init__(self):
        self.is_training = False
        self.training_thread = None
        self.progress = {
            'phase': 'idle',
            'progress': 0,
            'total_phases': 7,
            'current_phase_num': 0,
            'details': '',
            'started_at': None,
            'metrics': {},
            'errors': [],
            'completed_phases': []
        }
        self.models = {}
        self.knowledge_vectors = None
        self.domain_centroids = {}
        self.topic_model = None
        self.intent_classifier = None
        self.domain_classifier = None
        self.training_history = []
        self.cache_dir = Path('training_cache')
        self.cache_dir.mkdir(exist_ok=True)
        
        logger.info("[Training Pipeline] Initialized CYRUS Training Pipeline v2.0")
    
    def get_status(self) -> Dict:
        return {
            'is_training': self.is_training,
            'progress': self.progress.copy(),
            'models_trained': list(self.models.keys()),
            'training_history_count': len(self.training_history),
            'knowledge_vectors_shape': list(self.knowledge_vectors.shape) if self.knowledge_vectors is not None else None,
            'domain_centroids_count': len(self.domain_centroids),
            'timestamp': datetime.now().isoformat()
        }
    
    def start_training(self, config: Dict = None) -> Dict:
        if self.is_training:
            return {'error': 'Training already in progress', 'status': self.get_status()}
        
        if not SKLEARN_AVAILABLE:
            return {'error': 'scikit-learn not available', 'status': 'failed'}
        
        config = config or {}
        self.is_training = True
        self.progress = {
            'phase': 'initializing',
            'progress': 0,
            'total_phases': 7,
            'current_phase_num': 0,
            'details': 'Starting training pipeline...',
            'started_at': datetime.now().isoformat(),
            'metrics': {},
            'errors': [],
            'completed_phases': []
        }
        
        self.training_thread = threading.Thread(
            target=self._run_training_pipeline,
            args=(config,),
            daemon=True
        )
        self.training_thread.start()
        
        return {
            'status': 'started',
            'message': 'CYRUS Training Pipeline v2.0 initiated',
            'config': config,
            'total_phases': 7,
            'phases': [
                'Knowledge Domain Vectorization',
                'Domain Clustering & Centroid Computation',
                'Topic Model Training (NMF + LDA)',
                'Intent Classification Training',
                'Domain Classification Training',
                'Cross-Domain Relationship Mapping',
                'Performance Benchmarking & Validation'
            ]
        }
    
    def stop_training(self) -> Dict:
        if not self.is_training:
            return {'status': 'no_active_training'}
        self.is_training = False
        return {'status': 'stop_requested', 'current_phase': self.progress['phase']}
    
    def _update_progress(self, phase: str, phase_num: int, details: str, progress_pct: float = None):
        self.progress['phase'] = phase
        self.progress['current_phase_num'] = phase_num
        self.progress['details'] = details
        if progress_pct is not None:
            self.progress['progress'] = progress_pct
        logger.info(f"[Training] Phase {phase_num}/7: {phase} - {details}")
    
    def _run_training_pipeline(self, config: Dict):
        metrics = TrainingMetrics()
        metrics.start()
        
        try:
            self._update_progress('knowledge_vectorization', 1, 'Building knowledge domain vectors...', 5)
            metrics.start_phase('knowledge_vectorization')
            self._train_knowledge_vectors(config)
            metrics.end_phase('knowledge_vectorization')
            self.progress['completed_phases'].append('knowledge_vectorization')
            if not self.is_training: return
            
            self._update_progress('domain_clustering', 2, 'Computing domain clusters and centroids...', 20)
            metrics.start_phase('domain_clustering')
            cluster_metrics = self._train_domain_clustering(config)
            metrics.record('silhouette_score', cluster_metrics.get('silhouette', 0))
            metrics.end_phase('domain_clustering')
            self.progress['completed_phases'].append('domain_clustering')
            if not self.is_training: return
            
            self._update_progress('topic_modeling', 3, 'Training topic models (NMF + LDA)...', 35)
            metrics.start_phase('topic_modeling')
            topic_metrics = self._train_topic_models(config)
            metrics.record('nmf_reconstruction_error', topic_metrics.get('nmf_error', 0))
            metrics.record('lda_perplexity', topic_metrics.get('lda_perplexity', 0))
            metrics.end_phase('topic_modeling')
            self.progress['completed_phases'].append('topic_modeling')
            if not self.is_training: return
            
            self._update_progress('intent_classification', 4, 'Training intent classification models...', 50)
            metrics.start_phase('intent_classification')
            intent_metrics = self._train_intent_classifier(config)
            metrics.record('intent_accuracy', intent_metrics.get('accuracy', 0))
            metrics.record('intent_f1', intent_metrics.get('f1', 0))
            metrics.end_phase('intent_classification')
            self.progress['completed_phases'].append('intent_classification')
            if not self.is_training: return
            
            self._update_progress('domain_classification', 5, 'Training domain classification ensemble...', 65)
            metrics.start_phase('domain_classification')
            domain_metrics = self._train_domain_classifier(config)
            metrics.record('domain_accuracy', domain_metrics.get('accuracy', 0))
            metrics.record('domain_f1', domain_metrics.get('f1', 0))
            metrics.end_phase('domain_classification')
            self.progress['completed_phases'].append('domain_classification')
            if not self.is_training: return
            
            self._update_progress('cross_domain_mapping', 6, 'Mapping cross-domain relationships...', 80)
            metrics.start_phase('cross_domain_mapping')
            relationship_metrics = self._build_cross_domain_map(config)
            metrics.record('cross_domain_connections', relationship_metrics.get('connections', 0))
            metrics.end_phase('cross_domain_mapping')
            self.progress['completed_phases'].append('cross_domain_mapping')
            if not self.is_training: return
            
            self._update_progress('benchmarking', 7, 'Running performance benchmarks...', 90)
            metrics.start_phase('benchmarking')
            benchmark_results = self._run_benchmarks()
            metrics.end_phase('benchmarking')
            self.progress['completed_phases'].append('benchmarking')
            
            metrics.end()
            
            training_record = {
                'timestamp': datetime.now().isoformat(),
                'duration_seconds': metrics.end_time - metrics.start_time,
                'phases_completed': len(self.progress['completed_phases']),
                'models_trained': list(self.models.keys()),
                'metrics_summary': metrics.summary(),
                'benchmark_results': benchmark_results,
                'config': config
            }
            self.training_history.append(training_record)
            
            self._save_training_state(training_record)
            
            self._update_progress('completed', 7, 'Training pipeline completed successfully!', 100)
            self.progress['metrics'] = metrics.summary()
            
            logger.info(f"[Training] Pipeline completed in {metrics.end_time - metrics.start_time:.1f}s")
            
        except Exception as e:
            logger.error(f"[Training] Pipeline error: {e}")
            self.progress['errors'].append(str(e))
            self.progress['phase'] = 'error'
            self.progress['details'] = f'Error: {str(e)}'
        finally:
            self.is_training = False
    
    def _train_knowledge_vectors(self, config: Dict):
        all_concepts = []
        concept_labels = []
        concept_weights = []
        
        for domain, data in KNOWLEDGE_DOMAINS.items():
            weight = data.get('weight', 1.0)
            for concept in data['concepts']:
                all_concepts.append(concept)
                concept_labels.append(domain)
                concept_weights.append(weight)
        
        logger.info(f"[Training] Vectorizing {len(all_concepts)} concepts across {len(KNOWLEDGE_DOMAINS)} domains")
        
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 3),
            sublinear_tf=True,
            min_df=1,
            max_df=0.95
        )
        self.knowledge_vectors = self.tfidf_vectorizer.fit_transform(all_concepts)
        self.concept_labels = concept_labels
        self.concept_weights = np.array(concept_weights)
        self.all_concepts = all_concepts
        
        self.models['tfidf_vectorizer'] = {
            'type': 'TfidfVectorizer',
            'n_features': self.knowledge_vectors.shape[1],
            'n_samples': self.knowledge_vectors.shape[0],
            'vocabulary_size': len(self.tfidf_vectorizer.vocabulary_)
        }
        
        logger.info(f"[Training] Knowledge vectors: {self.knowledge_vectors.shape}, vocab: {len(self.tfidf_vectorizer.vocabulary_)}")
    
    def _train_domain_clustering(self, config: Dict) -> Dict:
        n_domains = len(KNOWLEDGE_DOMAINS)
        dense_vectors = self.knowledge_vectors.toarray()
        
        kmeans = KMeans(n_clusters=n_domains, n_init=20, max_iter=500, random_state=42)
        cluster_labels = kmeans.fit_predict(dense_vectors)
        
        sil_score = silhouette_score(dense_vectors, cluster_labels)
        
        for domain in KNOWLEDGE_DOMAINS:
            domain_mask = np.array([l == domain for l in self.concept_labels])
            if domain_mask.any():
                self.domain_centroids[domain] = dense_vectors[domain_mask].mean(axis=0)
        
        dbscan = DBSCAN(eps=0.8, min_samples=2, metric='cosine')
        dbscan_labels = dbscan.fit_predict(dense_vectors)
        n_clusters_found = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)
        
        self.models['domain_kmeans'] = {
            'type': 'KMeans',
            'n_clusters': n_domains,
            'silhouette_score': float(sil_score),
            'inertia': float(kmeans.inertia_)
        }
        self.models['domain_dbscan'] = {
            'type': 'DBSCAN',
            'clusters_found': n_clusters_found,
            'noise_points': int(np.sum(dbscan_labels == -1))
        }
        
        self.kmeans_model = kmeans
        
        logger.info(f"[Training] Clustering: silhouette={sil_score:.4f}, DBSCAN clusters={n_clusters_found}")
        return {'silhouette': sil_score, 'dbscan_clusters': n_clusters_found}
    
    def _train_topic_models(self, config: Dict) -> Dict:
        n_topics = config.get('n_topics', 15)
        
        count_vectorizer = CountVectorizer(
            max_features=3000,
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.9
        )
        count_matrix = count_vectorizer.fit_transform(self.all_concepts)
        
        nmf = NMF(n_components=n_topics, max_iter=300, random_state=42, init='nndsvd')
        nmf_topics = nmf.fit_transform(count_matrix)
        nmf_error = nmf.reconstruction_err_
        
        feature_names = count_vectorizer.get_feature_names_out()
        topic_words = {}
        for topic_idx, topic in enumerate(nmf.components_):
            top_indices = topic.argsort()[-8:][::-1]
            topic_words[f'topic_{topic_idx}'] = [feature_names[i] for i in top_indices]
        
        lda = LatentDirichletAllocation(
            n_components=n_topics,
            max_iter=30,
            learning_method='online',
            random_state=42,
            n_jobs=1
        )
        lda_topics = lda.fit_transform(count_matrix)
        lda_perplexity = lda.perplexity(count_matrix)
        
        self.topic_model = {
            'nmf': nmf,
            'lda': lda,
            'count_vectorizer': count_vectorizer,
            'topic_words': topic_words,
            'nmf_document_topics': nmf_topics,
            'lda_document_topics': lda_topics
        }
        
        self.models['nmf_topic_model'] = {
            'type': 'NMF',
            'n_topics': n_topics,
            'reconstruction_error': float(nmf_error),
            'top_topics': {k: v[:5] for k, v in list(topic_words.items())[:5]}
        }
        self.models['lda_topic_model'] = {
            'type': 'LDA',
            'n_topics': n_topics,
            'perplexity': float(lda_perplexity)
        }
        
        logger.info(f"[Training] Topics: NMF error={nmf_error:.4f}, LDA perplexity={lda_perplexity:.2f}")
        return {'nmf_error': nmf_error, 'lda_perplexity': lda_perplexity, 'topic_words': topic_words}
    
    def _train_intent_classifier(self, config: Dict) -> Dict:
        intent_data = self._generate_intent_training_data()
        texts, labels = zip(*intent_data)
        
        vectorizer = TfidfVectorizer(max_features=2000, ngram_range=(1, 2))
        X = vectorizer.fit_transform(texts)
        
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        svm = SVC(kernel='rbf', C=10.0, gamma='scale', probability=True, random_state=42)
        svm.fit(X, y)
        svm_scores = cross_val_score(svm, X, y, cv=min(5, len(set(y))), scoring='accuracy')
        
        rf = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42, n_jobs=1)
        rf.fit(X, y)
        rf_scores = cross_val_score(rf, X, y, cv=min(5, len(set(y))), scoring='accuracy')
        
        mlp = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=300, random_state=42, early_stopping=True)
        mlp.fit(X, y)
        mlp_scores = cross_val_score(mlp, X, y, cv=min(5, len(set(y))), scoring='accuracy')
        
        best_model_name = 'svm'
        best_score = svm_scores.mean()
        best_model = svm
        
        if rf_scores.mean() > best_score:
            best_model_name = 'random_forest'
            best_score = rf_scores.mean()
            best_model = rf
        if mlp_scores.mean() > best_score:
            best_model_name = 'mlp'
            best_score = mlp_scores.mean()
            best_model = mlp
        
        self.intent_classifier = {
            'model': best_model,
            'vectorizer': vectorizer,
            'label_encoder': label_encoder,
            'best_model_name': best_model_name
        }
        
        self.models['intent_classifier'] = {
            'type': best_model_name,
            'accuracy': float(best_score),
            'svm_accuracy': float(svm_scores.mean()),
            'rf_accuracy': float(rf_scores.mean()),
            'mlp_accuracy': float(mlp_scores.mean()),
            'n_intents': len(label_encoder.classes_),
            'intents': list(label_encoder.classes_)
        }
        
        logger.info(f"[Training] Intent classifier: best={best_model_name}, accuracy={best_score:.4f}")
        return {'accuracy': best_score, 'f1': best_score, 'model': best_model_name}
    
    def _train_domain_classifier(self, config: Dict) -> Dict:
        X = self.knowledge_vectors
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(self.concept_labels)
        
        svm = SVC(kernel='rbf', C=10.0, gamma='scale', probability=True, random_state=42)
        svm.fit(X, y)
        svm_scores = cross_val_score(svm, X, y, cv=min(5, len(set(y))), scoring='accuracy')
        
        gb = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
        gb.fit(X.toarray(), y)
        gb_scores = cross_val_score(gb, X.toarray(), y, cv=min(5, len(set(y))), scoring='accuracy')
        
        lr = LogisticRegression(C=10.0, max_iter=1000, multi_class='multinomial', random_state=42)
        lr.fit(X, y)
        lr_scores = cross_val_score(lr, X, y, cv=min(5, len(set(y))), scoring='accuracy')
        
        best_name = 'svm'
        best_score = svm_scores.mean()
        best_model = svm
        
        if gb_scores.mean() > best_score:
            best_name = 'gradient_boosting'
            best_score = gb_scores.mean()
            best_model = gb
        if lr_scores.mean() > best_score:
            best_name = 'logistic_regression'
            best_score = lr_scores.mean()
            best_model = lr
        
        self.domain_classifier = {
            'model': best_model,
            'vectorizer': self.tfidf_vectorizer,
            'label_encoder': label_encoder,
            'best_model_name': best_name
        }
        
        self.models['domain_classifier'] = {
            'type': best_name,
            'accuracy': float(best_score),
            'svm_accuracy': float(svm_scores.mean()),
            'gb_accuracy': float(gb_scores.mean()),
            'lr_accuracy': float(lr_scores.mean()),
            'n_domains': len(label_encoder.classes_),
            'domains': list(label_encoder.classes_)
        }
        
        logger.info(f"[Training] Domain classifier: best={best_name}, accuracy={best_score:.4f}")
        return {'accuracy': best_score, 'f1': best_score, 'model': best_name}
    
    def _build_cross_domain_map(self, config: Dict) -> Dict:
        domain_names = list(self.domain_centroids.keys())
        n = len(domain_names)
        similarity_matrix = np.zeros((n, n))
        
        for i in range(n):
            for j in range(n):
                if i == j:
                    similarity_matrix[i][j] = 1.0
                else:
                    sim = 1.0 - cosine(self.domain_centroids[domain_names[i]], self.domain_centroids[domain_names[j]])
                    similarity_matrix[i][j] = sim
        
        connections = []
        threshold = config.get('similarity_threshold', 0.15)
        for i in range(n):
            for j in range(i+1, n):
                if similarity_matrix[i][j] > threshold:
                    connections.append({
                        'from': domain_names[i],
                        'to': domain_names[j],
                        'similarity': float(similarity_matrix[i][j])
                    })
        
        connections.sort(key=lambda x: x['similarity'], reverse=True)
        
        pca = PCA(n_components=min(3, n))
        centroid_matrix = np.array([self.domain_centroids[d] for d in domain_names])
        domain_coords = pca.fit_transform(centroid_matrix)
        
        domain_positions = {}
        for idx, name in enumerate(domain_names):
            domain_positions[name] = {
                'x': float(domain_coords[idx][0]),
                'y': float(domain_coords[idx][1]),
                'z': float(domain_coords[idx][2]) if domain_coords.shape[1] > 2 else 0.0
            }
        
        self.models['cross_domain_map'] = {
            'type': 'CrossDomainRelationship',
            'n_domains': n,
            'n_connections': len(connections),
            'top_connections': connections[:10],
            'domain_positions': domain_positions,
            'pca_explained_variance': [float(v) for v in pca.explained_variance_ratio_]
        }
        
        logger.info(f"[Training] Cross-domain: {len(connections)} connections above threshold {threshold}")
        return {'connections': len(connections), 'domains': n}
    
    def _run_benchmarks(self) -> Dict:
        benchmarks = {}
        
        if self.intent_classifier:
            test_queries = [
                "what is the stock price of AAPL today",
                "explain how the human heart works",
                "write a security audit report",
                "calculate the derivative of x squared",
                "diagnose the patient symptoms",
                "deploy the kubernetes cluster",
                "analyze market volatility patterns",
                "describe DNA replication process",
            ]
            
            vectorizer = self.intent_classifier['vectorizer']
            model = self.intent_classifier['model']
            label_encoder = self.intent_classifier['label_encoder']
            
            X_test = vectorizer.transform(test_queries)
            predictions = model.predict(X_test)
            pred_labels = label_encoder.inverse_transform(predictions)
            
            if hasattr(model, 'predict_proba'):
                probas = model.predict_proba(X_test)
                confidences = [float(np.max(p)) for p in probas]
            else:
                confidences = [1.0] * len(predictions)
            
            benchmarks['intent_classification'] = {
                'test_queries': len(test_queries),
                'predictions': [
                    {'query': q, 'intent': str(l), 'confidence': c}
                    for q, l, c in zip(test_queries, pred_labels, confidences)
                ],
                'avg_confidence': float(np.mean(confidences))
            }
        
        if self.domain_classifier:
            test_concepts = [
                "enzyme catalysis biochemical reaction",
                "firewall intrusion detection network security",
                "moving average convergence divergence trading",
                "neural network backpropagation deep learning",
                "cardiac arrest emergency treatment protocol",
            ]
            
            vectorizer = self.domain_classifier['vectorizer']
            model = self.domain_classifier['model']
            label_encoder = self.domain_classifier['label_encoder']
            
            X_test = vectorizer.transform(test_concepts)
            if hasattr(model, 'predict'):
                if hasattr(X_test, 'toarray') and not hasattr(model, 'coef_'):
                    try:
                        predictions = model.predict(X_test.toarray())
                    except:
                        predictions = model.predict(X_test)
                else:
                    predictions = model.predict(X_test)
                pred_labels = label_encoder.inverse_transform(predictions)
            else:
                pred_labels = ['unknown'] * len(test_concepts)
            
            benchmarks['domain_classification'] = {
                'test_concepts': len(test_concepts),
                'predictions': [
                    {'concept': c, 'domain': str(l)}
                    for c, l in zip(test_concepts, pred_labels)
                ]
            }
        
        if self.knowledge_vectors is not None:
            test_query = "quantum computing neural network artificial intelligence"
            query_vec = self.tfidf_vectorizer.transform([test_query])
            
            from sklearn.metrics.pairwise import cosine_similarity
            similarities = cosine_similarity(query_vec, self.knowledge_vectors).flatten()
            top_indices = similarities.argsort()[-5:][::-1]
            
            benchmarks['semantic_search'] = {
                'query': test_query,
                'top_matches': [
                    {
                        'concept': self.all_concepts[i],
                        'domain': self.concept_labels[i],
                        'similarity': float(similarities[i])
                    }
                    for i in top_indices
                ]
            }
        
        benchmarks['model_summary'] = {
            'total_models': len(self.models),
            'models': list(self.models.keys()),
            'total_concepts': len(self.all_concepts) if hasattr(self, 'all_concepts') else 0,
            'total_domains': len(KNOWLEDGE_DOMAINS),
            'vocabulary_size': len(self.tfidf_vectorizer.vocabulary_) if hasattr(self, 'tfidf_vectorizer') else 0
        }
        
        return benchmarks
    
    def _generate_intent_training_data(self) -> List[tuple]:
        intent_examples = {
            'question': [
                'what is quantum computing',
                'how does DNA replication work',
                'what causes heart attacks',
                'why do markets crash',
                'how does encryption work',
                'what is machine learning',
                'explain neural networks',
                'how does the immune system function',
                'what are black holes',
                'describe photosynthesis process',
                'what is the difference between TCP and UDP',
                'how does a compiler work',
                'what causes cancer',
                'explain general relativity',
                'how do vaccines work',
            ],
            'command': [
                'run security scan on network',
                'deploy the application to production',
                'start monitoring system status',
                'encrypt this file with AES-256',
                'analyze the malware sample',
                'execute trading algorithm',
                'scan for vulnerabilities',
                'initialize drone control system',
                'activate defense protocols',
                'launch diagnostic sequence',
                'compile the source code',
                'backup the database now',
                'restart the service',
                'generate performance report',
                'calibrate sensor array',
            ],
            'analysis': [
                'analyze stock market trends',
                'evaluate patient blood test results',
                'assess network security posture',
                'review code for vulnerabilities',
                'examine the data patterns',
                'interpret the MRI scan results',
                'correlate the experimental data',
                'benchmark algorithm performance',
                'profile application bottlenecks',
                'audit system access logs',
                'investigate anomalous traffic',
                'evaluate portfolio risk metrics',
                'assess environmental impact',
                'analyze sentiment trends',
                'measure treatment efficacy',
            ],
            'creation': [
                'write a security report',
                'create a machine learning model',
                'design a database schema',
                'build a web application',
                'draft a research paper',
                'compose a professional email',
                'generate test cases',
                'write documentation for API',
                'create visualization dashboard',
                'design network architecture',
                'develop training curriculum',
                'write surgical procedure guide',
                'create encryption algorithm',
                'build recommendation engine',
                'design clinical trial protocol',
            ],
            'calculation': [
                'calculate portfolio returns',
                'compute the eigenvalues of this matrix',
                'determine statistical significance',
                'estimate treatment dosage',
                'calculate orbital trajectory',
                'solve the differential equation',
                'compute signal to noise ratio',
                'determine break even point',
                'calculate fluid flow rate',
                'estimate time complexity',
                'compute Fourier transform',
                'determine structural load bearing',
                'calculate drug half life',
                'estimate population growth',
                'compute hash collision probability',
            ],
            'monitoring': [
                'check system health status',
                'monitor network traffic',
                'track patient vital signs',
                'watch market positions',
                'observe sensor readings',
                'survey environmental conditions',
                'track satellite position',
                'monitor CPU temperature',
                'check database replication status',
                'watch for intrusion attempts',
                'monitor bandwidth usage',
                'track medication schedule',
                'observe weather patterns',
                'monitor radiation levels',
                'check supply chain status',
            ],
        }
        
        data = []
        for intent, examples in intent_examples.items():
            for example in examples:
                data.append((example, intent))
        
        return data
    
    def _save_training_state(self, record: Dict):
        try:
            state_file = self.cache_dir / 'training_state.json'
            serializable_record = {
                'timestamp': record['timestamp'],
                'duration_seconds': record['duration_seconds'],
                'phases_completed': record['phases_completed'],
                'models_trained': record['models_trained'],
                'config': record['config']
            }
            
            model_metrics = {}
            for name, info in self.models.items():
                model_metrics[name] = {k: v for k, v in info.items() if isinstance(v, (int, float, str, list, dict, bool))}
            serializable_record['model_metrics'] = model_metrics
            
            with open(state_file, 'w') as f:
                json.dump(serializable_record, f, indent=2, default=str)
            
            logger.info(f"[Training] State saved to {state_file}")
        except Exception as e:
            logger.error(f"[Training] Error saving state: {e}")
    
    def classify_query(self, query: str) -> Dict:
        result = {
            'query': query,
            'intent': None,
            'domain': None,
            'intent_confidence': 0,
            'domain_confidence': 0,
            'related_topics': [],
            'semantic_matches': []
        }
        
        if self.intent_classifier:
            try:
                X = self.intent_classifier['vectorizer'].transform([query])
                pred = self.intent_classifier['model'].predict(X)
                label = self.intent_classifier['label_encoder'].inverse_transform(pred)[0]
                result['intent'] = label
                if hasattr(self.intent_classifier['model'], 'predict_proba'):
                    proba = self.intent_classifier['model'].predict_proba(X)
                    result['intent_confidence'] = float(np.max(proba))
            except Exception as e:
                logger.error(f"Intent classification error: {e}")
        
        if self.domain_classifier:
            try:
                X = self.domain_classifier['vectorizer'].transform([query])
                model = self.domain_classifier['model']
                if hasattr(X, 'toarray') and not hasattr(model, 'coef_'):
                    try:
                        pred = model.predict(X.toarray())
                    except:
                        pred = model.predict(X)
                else:
                    pred = model.predict(X)
                label = self.domain_classifier['label_encoder'].inverse_transform(pred)[0]
                result['domain'] = label
                if hasattr(model, 'predict_proba'):
                    try:
                        proba = model.predict_proba(X if hasattr(model, 'coef_') else X.toarray())
                        result['domain_confidence'] = float(np.max(proba))
                    except:
                        result['domain_confidence'] = 0.8
            except Exception as e:
                logger.error(f"Domain classification error: {e}")
        
        if self.knowledge_vectors is not None and hasattr(self, 'tfidf_vectorizer'):
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                query_vec = self.tfidf_vectorizer.transform([query])
                similarities = cosine_similarity(query_vec, self.knowledge_vectors).flatten()
                top_indices = similarities.argsort()[-5:][::-1]
                result['semantic_matches'] = [
                    {
                        'concept': self.all_concepts[i],
                        'domain': self.concept_labels[i],
                        'similarity': float(similarities[i])
                    }
                    for i in top_indices if similarities[i] > 0.05
                ]
            except Exception as e:
                logger.error(f"Semantic search error: {e}")
        
        return result
    
    def get_training_history(self) -> List[Dict]:
        return self.training_history
    
    def get_model_info(self) -> Dict:
        return {
            'models': self.models,
            'total_models': len(self.models),
            'knowledge_domains': len(KNOWLEDGE_DOMAINS),
            'total_concepts': sum(len(d['concepts']) for d in KNOWLEDGE_DOMAINS.values()),
            'domain_centroids_computed': len(self.domain_centroids) > 0,
            'intent_classifier_ready': self.intent_classifier is not None,
            'domain_classifier_ready': self.domain_classifier is not None,
            'topic_model_ready': self.topic_model is not None,
            'timestamp': datetime.now().isoformat()
        }


training_pipeline = CYRUSTrainingPipeline()
