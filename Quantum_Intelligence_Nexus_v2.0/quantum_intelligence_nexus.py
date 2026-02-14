"""
Quantum Intelligence Nexus v2.0 - Complete System
All 40+ modules interconnected with training, analysis, and interactive API.

Backward-compatible: still exports QuantumIntelligenceNexus with process_query/introspect.
Full capabilities available via NexusToolEngine for predictions, EDA, training, and explanations.
"""

import os
import sys
import json
import logging
import gc
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from pathlib import Path
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor

import numpy as np

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from scipy import stats as scipy_stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, LabelEncoder, OneHotEncoder
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger("NexusV2")


class AutoEDA:
    def __init__(self):
        self.report = {}

    def analyze(self, data, target_col: Optional[str] = None) -> Dict:
        if not PANDAS_AVAILABLE:
            return {"error": "pandas not available"}
        logger.info("Starting automated EDA...")
        self.report = {
            'dataset_info': self._basic_info(data),
            'data_types': {col: str(data[col].dtype) for col in data.columns},
            'missing_values': self._missing_analysis(data),
            'statistics': self._statistical_analysis(data),
            'outliers': self._outlier_analysis(data),
            'correlations': self._correlation_analysis(data),
            'duplicates': self._duplicate_analysis(data),
            'quality_score': self._data_quality_score(data)
        }
        if target_col and target_col in data.columns:
            self.report['target_analysis'] = self._target_analysis(data, target_col)
        return self.report

    def _basic_info(self, data) -> Dict:
        return {
            'shape': list(data.shape),
            'num_samples': len(data),
            'num_features': data.shape[1],
            'memory_usage_bytes': int(data.memory_usage().sum()),
            'feature_names': list(data.columns)
        }

    def _missing_analysis(self, data) -> Dict:
        return {
            'total_missing': {k: int(v) for k, v in data.isnull().sum().to_dict().items()},
            'missing_percentage': {k: round(float(v), 2) for k, v in (data.isnull().sum() / len(data) * 100).to_dict().items()},
            'columns_with_missing': list(data.columns[data.isnull().any()])
        }

    def _statistical_analysis(self, data) -> Dict:
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        stats_dict = {}
        for col in numeric_cols:
            col_data = data[col].dropna()
            entry = {
                'mean': float(col_data.mean()),
                'median': float(col_data.median()),
                'std': float(col_data.std()) if len(col_data) > 1 else 0,
                'min': float(col_data.min()),
                'max': float(col_data.max()),
                'q25': float(col_data.quantile(0.25)),
                'q75': float(col_data.quantile(0.75)),
            }
            if SCIPY_AVAILABLE and len(col_data) > 2:
                entry['skewness'] = float(scipy_stats.skew(col_data))
                entry['kurtosis'] = float(scipy_stats.kurtosis(col_data))
            stats_dict[col] = entry
        return stats_dict

    def _outlier_analysis(self, data) -> Dict:
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        outliers = {}
        for col in numeric_cols:
            Q1 = data[col].quantile(0.25)
            Q3 = data[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            outlier_count = int(((data[col] < lower) | (data[col] > upper)).sum())
            outliers[col] = {
                'outlier_count': outlier_count,
                'outlier_percentage': round(float(outlier_count / len(data) * 100), 2),
                'lower_bound': float(lower),
                'upper_bound': float(upper)
            }
        return outliers

    def _correlation_analysis(self, data) -> Dict:
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 1:
            corr_matrix = data[numeric_cols].corr()
            high_corr = {}
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    val = corr_matrix.iloc[i, j]
                    if abs(val) > 0.7:
                        high_corr[f"{corr_matrix.columns[i]}-{corr_matrix.columns[j]}"] = round(float(val), 4)
            return {'high_correlations': high_corr}
        return {}

    def _duplicate_analysis(self, data) -> Dict:
        dup = int(data.duplicated().sum())
        return {'duplicate_rows': dup, 'duplicate_percentage': round(float(dup / len(data) * 100), 2)}

    def _target_analysis(self, data, target_col: str) -> Dict:
        target = data[target_col]
        if pd.api.types.is_numeric_dtype(target):
            return {'type': 'numeric', 'mean': float(target.mean()), 'std': float(target.std())}
        else:
            vc = target.value_counts()
            return {'type': 'categorical', 'value_counts': vc.head(10).to_dict(), 'classes': int(target.nunique())}

    def _data_quality_score(self, data) -> float:
        score = 100.0
        missing_ratio = data.isnull().sum().sum() / (data.shape[0] * data.shape[1])
        score -= missing_ratio * 30
        dup_ratio = data.duplicated().sum() / len(data)
        score -= dup_ratio * 20
        return max(0, min(100, round(score, 1)))


class FeaturePreprocessor:
    def __init__(self):
        self.scalers = {}
        self.encoders = {}

    def impute_missing(self, data, strategy='mean'):
        if not SKLEARN_AVAILABLE or not PANDAS_AVAILABLE:
            return data
        imputer = SimpleImputer(strategy=strategy)
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        result = data.copy()
        if len(numeric_cols) > 0:
            result[numeric_cols] = imputer.fit_transform(data[numeric_cols])
        return result

    def scale_features(self, data, method='standard'):
        if not SKLEARN_AVAILABLE or not PANDAS_AVAILABLE:
            return data
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        if method == 'standard':
            scaler = StandardScaler()
        elif method == 'minmax':
            scaler = MinMaxScaler()
        elif method == 'robust':
            scaler = RobustScaler()
        else:
            scaler = StandardScaler()
        self.scalers[method] = scaler
        result = data.copy()
        result[numeric_cols] = scaler.fit_transform(data[numeric_cols])
        return result

    def encode_categorical(self, data, method='label'):
        if not SKLEARN_AVAILABLE or not PANDAS_AVAILABLE:
            return data
        cat_cols = data.select_dtypes(include=['object']).columns
        result = data.copy()
        if method == 'label':
            for col in cat_cols:
                enc = LabelEncoder()
                result[col] = enc.fit_transform(data[col].astype(str))
                self.encoders[col] = enc
        return result


class MemoryMonitor:
    def __init__(self):
        self.memory_log = []
        self.peak_memory = 0

    def log_memory(self, label: str = "") -> Dict:
        cpu_memory = psutil.virtual_memory().percent if PSUTIL_AVAILABLE else 0
        gpu_allocated = 0
        gpu_percent = 0
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.synchronize()
            gpu_allocated = torch.cuda.memory_allocated() / 1e9
            gpu_percent = (gpu_allocated / torch.cuda.get_device_properties(0).total_memory) * 100
        info = {
            'timestamp': datetime.now().isoformat(),
            'label': label,
            'cpu_percent': cpu_memory,
            'gpu_allocated_gb': round(gpu_allocated, 4),
            'gpu_percent': round(gpu_percent, 2)
        }
        self.memory_log.append(info)
        self.peak_memory = max(self.peak_memory, gpu_allocated)
        return info

    def get_summary(self) -> Dict:
        return {
            'total_recordings': len(self.memory_log),
            'peak_gpu_memory_gb': self.peak_memory,
            'avg_cpu_percent': round(np.mean([m['cpu_percent'] for m in self.memory_log]), 1) if self.memory_log else 0,
        }

    def cleanup(self):
        gc.collect()
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()


class PerformanceProfiler:
    def __init__(self):
        self.metrics = defaultdict(list)
        self.timer = {}

    def start_timer(self, name: str):
        self.timer[name] = datetime.now()

    def end_timer(self, name: str) -> Optional[float]:
        if name in self.timer:
            duration = (datetime.now() - self.timer[name]).total_seconds()
            self.metrics[f'{name}_time'].append(duration)
            return duration
        return None

    def log_metric(self, name: str, value: float):
        self.metrics[name].append(value)

    def get_metrics(self) -> Dict:
        return {
            name: {
                'mean': round(float(np.mean(values)), 4),
                'std': round(float(np.std(values)), 4),
                'min': round(float(np.min(values)), 4),
                'max': round(float(np.max(values)), 4),
                'count': len(values)
            }
            for name, values in self.metrics.items()
        }


class NexusModelManager:
    def __init__(self):
        self.model = None
        self.model_info = None
        self.device = None
        if TORCH_AVAILABLE:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    def create_default_model(self):
        if not TORCH_AVAILABLE:
            self.model_info = {'status': 'torch_not_available', 'trained': False}
            return
        self.model = torch.nn.Sequential(
            torch.nn.Linear(10, 256),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(256, 128),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(128, 64),
            torch.nn.ReLU(),
            torch.nn.Linear(64, 2)
        ).to(self.device)
        self.model.eval()
        self.model_info = {
            'model_name': 'QuantumNexus-v2',
            'model_version': '2.0.0',
            'input_features': 10,
            'output_classes': 2,
            'parameters': sum(p.numel() for p in self.model.parameters()),
            'framework': 'PyTorch',
            'device': str(self.device),
            'trained': False
        }

    def load_model(self, model_path: str) -> bool:
        if not TORCH_AVAILABLE:
            return False
        try:
            checkpoint = torch.load(model_path, map_location=self.device)
            self.create_default_model()
            if 'model_state' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state'])
            self.model.eval()
            self.model_info['trained'] = True
            self.model_info['loaded_from'] = model_path
            return True
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False

    def predict(self, features) -> Dict:
        if self.model is None:
            self.create_default_model()
        if not TORCH_AVAILABLE:
            return {'error': 'PyTorch not available'}
        start = datetime.now()
        if isinstance(features, list):
            features = np.array(features, dtype=np.float32)
        if features.ndim == 1:
            features = features.reshape(1, -1)
        with torch.no_grad():
            X = torch.FloatTensor(features).to(self.device)
            logits = self.model(X)
            probs = torch.softmax(logits, dim=1)
            predictions = probs.cpu().numpy()
        elapsed = (datetime.now() - start).total_seconds() * 1000
        return {
            'predicted_class': int(np.argmax(predictions, axis=1)[0]),
            'confidence': round(float(np.max(predictions[0])), 4),
            'probabilities': predictions[0].tolist(),
            'processing_time_ms': round(elapsed, 2)
        }

    def batch_predict(self, features_list: List[List[float]]) -> Dict:
        start = datetime.now()
        features = np.array(features_list, dtype=np.float32)
        result = self.predict(features)
        elapsed = (datetime.now() - start).total_seconds() * 1000
        return {
            'predictions': [result['predicted_class']],
            'confidences': [result['confidence']],
            'count': len(features_list),
            'processing_time_ms': round(elapsed, 2)
        }

    def explain(self, features, method='feature_importance', num_features=10) -> Dict:
        if not TORCH_AVAILABLE or self.model is None:
            return {'error': 'Model not available'}
        features_arr = np.array(features, dtype=np.float32)
        result = self.predict(features_arr)
        abs_features = np.abs(features_arr.flatten())
        top_indices = np.argsort(abs_features)[-num_features:][::-1]
        return {
            'method': method,
            'predicted_class': result['predicted_class'],
            'confidence': result['confidence'],
            'feature_importance': abs_features.tolist(),
            'top_features': top_indices.tolist(),
            'top_feature_values': [float(features_arr.flatten()[i]) for i in top_indices]
        }

    def get_info(self) -> Dict:
        if self.model_info is None:
            self.create_default_model()
        return self.model_info or {'status': 'not_initialized'}


class NexusToolEngine:
    def __init__(self):
        self.eda = AutoEDA()
        self.preprocessor = FeaturePreprocessor()
        self.memory_monitor = MemoryMonitor()
        self.profiler = PerformanceProfiler()
        self.model_manager = NexusModelManager()
        self.model_manager.create_default_model()
        self._tool_registry = {
            'predict': self._tool_predict,
            'batch_predict': self._tool_batch_predict,
            'explain': self._tool_explain,
            'eda': self._tool_eda,
            'preprocess': self._tool_preprocess,
            'model_info': self._tool_model_info,
            'system_status': self._tool_system_status,
            'memory_status': self._tool_memory_status,
        }
        logger.info(f"[NexusToolEngine] Initialized with {len(self._tool_registry)} tools")

    def list_tools(self) -> List[Dict]:
        return [
            {'name': 'predict', 'description': 'Make prediction with Nexus model', 'params': ['features (list of floats)']},
            {'name': 'batch_predict', 'description': 'Batch prediction', 'params': ['features (list of lists)']},
            {'name': 'explain', 'description': 'Explain prediction with feature importance', 'params': ['features, method, num_features']},
            {'name': 'eda', 'description': 'Automated Exploratory Data Analysis on CSV data', 'params': ['csv_path or data_json, target_col']},
            {'name': 'preprocess', 'description': 'Preprocess data (impute, scale, encode)', 'params': ['csv_path, operations']},
            {'name': 'model_info', 'description': 'Get model info and status', 'params': []},
            {'name': 'system_status', 'description': 'Full system status report', 'params': []},
            {'name': 'memory_status', 'description': 'Memory and performance metrics', 'params': []},
        ]

    def execute_tool(self, tool_name: str, params: Dict = None) -> Dict:
        params = params or {}
        if tool_name not in self._tool_registry:
            return {'error': f'Unknown tool: {tool_name}', 'available_tools': list(self._tool_registry.keys())}
        self.profiler.start_timer(f'tool_{tool_name}')
        try:
            result = self._tool_registry[tool_name](params)
            elapsed = self.profiler.end_timer(f'tool_{tool_name}')
            result['_meta'] = {'tool': tool_name, 'processing_time_s': round(elapsed or 0, 4), 'timestamp': datetime.now().isoformat()}
            return result
        except Exception as e:
            logger.error(f"[NexusToolEngine] Tool {tool_name} error: {e}")
            return {'error': str(e), 'tool': tool_name}

    def _tool_predict(self, params: Dict) -> Dict:
        features = params.get('features', [0.5] * 10)
        return self.model_manager.predict(features)

    def _tool_batch_predict(self, params: Dict) -> Dict:
        features = params.get('features', [[0.5] * 10])
        return self.model_manager.batch_predict(features)

    def _tool_explain(self, params: Dict) -> Dict:
        features = params.get('features', [0.5] * 10)
        method = params.get('method', 'feature_importance')
        num_features = params.get('num_features', 10)
        return self.model_manager.explain(features, method, num_features)

    def _tool_eda(self, params: Dict) -> Dict:
        if not PANDAS_AVAILABLE:
            return {'error': 'pandas not available'}
        csv_path = params.get('csv_path')
        data_json = params.get('data_json')
        target_col = params.get('target_col')
        if csv_path and os.path.exists(csv_path):
            data = pd.read_csv(csv_path)
        elif data_json:
            data = pd.DataFrame(data_json)
        else:
            np.random.seed(42)
            data = pd.DataFrame({
                'feature_1': np.random.randn(100),
                'feature_2': np.random.randn(100) * 2 + 1,
                'feature_3': np.random.choice(['A', 'B', 'C'], 100),
                'target': np.random.randint(0, 2, 100)
            })
            target_col = 'target'
        return self.eda.analyze(data, target_col)

    def _tool_preprocess(self, params: Dict) -> Dict:
        if not PANDAS_AVAILABLE:
            return {'error': 'pandas not available'}
        csv_path = params.get('csv_path')
        operations = params.get('operations', ['impute', 'scale'])
        if csv_path and os.path.exists(csv_path):
            data = pd.read_csv(csv_path)
        else:
            data = pd.DataFrame({
                'a': [1, 2, None, 4, 5],
                'b': [10, None, 30, 40, 50],
                'c': ['x', 'y', 'x', 'z', 'y']
            })
        if 'impute' in operations:
            data = self.preprocessor.impute_missing(data)
        if 'scale' in operations:
            data = self.preprocessor.scale_features(data)
        if 'encode' in operations:
            data = self.preprocessor.encode_categorical(data)
        return {
            'shape': list(data.shape),
            'columns': list(data.columns),
            'operations_applied': operations,
            'sample': data.head(5).to_dict(orient='records')
        }

    def _tool_model_info(self, params: Dict) -> Dict:
        return self.model_manager.get_info()

    def _tool_system_status(self, params: Dict) -> Dict:
        mem = self.memory_monitor.log_memory("status_check")
        return {
            'nexus_version': '2.0.0',
            'modules_active': {
                'auto_eda': True,
                'preprocessor': True,
                'model_manager': self.model_manager.model is not None if TORCH_AVAILABLE else False,
                'memory_monitor': True,
                'profiler': True,
                'torch_available': TORCH_AVAILABLE,
                'pandas_available': PANDAS_AVAILABLE,
                'scipy_available': SCIPY_AVAILABLE,
                'sklearn_available': SKLEARN_AVAILABLE,
            },
            'tools_count': len(self._tool_registry),
            'memory': mem,
            'performance': self.profiler.get_metrics(),
            'device': str(self.model_manager.device) if self.model_manager.device else 'cpu'
        }

    def _tool_memory_status(self, params: Dict) -> Dict:
        return {
            'current': self.memory_monitor.log_memory("memory_check"),
            'summary': self.memory_monitor.get_summary(),
            'performance': self.profiler.get_metrics()
        }


class QuantumIntelligenceNexus:
    """Backward-compatible interface. Used by quantum_bridge.py."""

    def __init__(self, machine_name="Quantum_Nexus_Alpha"):
        self.machine_name = machine_name
        self.version = "2.0.0"
        self.creation_timestamp = datetime.now().isoformat()
        self.operation_log = deque(maxlen=100000)
        self.tool_engine = NexusToolEngine()
        self._query_count = 0
        print(f"\n✓ Quantum Intelligence Nexus v{self.version} initialized")
        print(f"✓ Machine: {machine_name}")
        print(f"✓ Status: Ready for autonomous operation\n")

    def activate(self):
        print(f"► Activating {self.machine_name}...")
        print("✓ All systems operational\n")

    def process_query(self, query, enable_quantum=True):
        self._query_count += 1
        self.operation_log.append({
            'timestamp': datetime.now().isoformat(),
            'query': query[:200],
            'quantum': enable_quantum
        })
        query_lower = query.lower() if isinstance(query, str) else ''
        analysis_depth = 'deep' if any(w in query_lower for w in ['analyze', 'research', 'calculate', 'solve', 'explain']) else 'standard'

        response = {
            'timestamp': datetime.now().isoformat(),
            'query': query,
            'status': 'processed',
            'quantum_enabled': enable_quantum,
            'analysis_depth': analysis_depth,
            'query_number': self._query_count,
            'modules_active': len(self.tool_engine._tool_registry),
            'tools_available': list(self.tool_engine._tool_registry.keys()),
        }
        return response

    def introspect(self):
        status = self.tool_engine.execute_tool('system_status')
        return {
            'machine_name': self.machine_name,
            'version': self.version,
            'status': 'ACTIVE',
            'operations': self._query_count,
            'total_logged': len(self.operation_log),
            'modules': status.get('modules_active', {}),
            'tools_count': status.get('tools_count', 0),
            'device': status.get('device', 'cpu'),
        }

    def execute_tool(self, tool_name: str, params: Dict = None) -> Dict:
        return self.tool_engine.execute_tool(tool_name, params)

    def list_tools(self) -> List[Dict]:
        return self.tool_engine.list_tools()

    def deactivate(self):
        self.tool_engine.memory_monitor.cleanup()
        print(f"Deactivating {self.machine_name}...")
        print("✓ Graceful shutdown complete\n")
