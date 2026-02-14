"""
Quantum AI Core Bridge Service
HTTP API bridge for Node.js integration with the Quantum AI Core.
Enhances CYRUS's intelligence, writing style, and response quality.
"""

import sys
import os
import json
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
from typing import Dict, Any, Optional

_this_dir = os.path.dirname(os.path.abspath(__file__))
_workspace_root = os.path.join(_this_dir, '..', '..')
sys.path.insert(0, _this_dir)
if _workspace_root in sys.path:
    sys.path.remove(_workspace_root)

from quantum_ai_core import QuantumAICore, format_response_for_display
from core_algorithms.writing_style_analyzer import WritingStyleAnalyzer
from core_algorithms.mathematical_formatter import MathematicalFormatter

try:
    nexus_path = os.path.join(_workspace_root, 'Quantum_Intelligence_Nexus_v2.0')
    nexus_path = os.path.normpath(nexus_path)
    if os.path.exists(nexus_path):
        sys.path.insert(0, nexus_path)
        from quantum_intelligence_nexus import QuantumIntelligenceNexus
        NEXUS_AVAILABLE = True
    else:
        NEXUS_AVAILABLE = False
except ImportError:
    NEXUS_AVAILABLE = False


class QuantumIntelligenceEngine:
    """
    Enhanced Intelligence Engine for CYRUS v3.0
    Provides advanced response formatting, style adaptation, and analytical capabilities.
    """
    
    def __init__(self):
        self.qai_core = QuantumAICore(
            response_format='scientific',
            include_equations=True,
            equation_format='unicode',
            writing_style='professional'
        )
        self.style_analyzer = WritingStyleAnalyzer()
        self.math_formatter = MathematicalFormatter()
        self.processing_history = []
        
        self.nexus = None
        if NEXUS_AVAILABLE:
            try:
                self.nexus = QuantumIntelligenceNexus(machine_name="CYRUS_Nexus")
                self.nexus.activate()
            except Exception as e:
                print(f"[Quantum Nexus] Init warning: {e}")
                self.nexus = None
        
    def enhance_response(self, message: str, context: Optional[Dict] = None) -> Dict:
        """
        Enhance a response with quantum AI processing.
        
        Args:
            message: The user's message/query
            context: Optional context (detected objects, previous messages, etc.)
            
        Returns:
            Enhanced response with style analysis and recommendations
        """
        analysis_start = datetime.now()
        
        result = {
            'quantum_enhanced': True,
            'processing_timestamp': analysis_start.isoformat(),
            'original_query': message,
            'enhancements': {}
        }
        
        message_lower = message.lower()
        query_type = self._classify_query(message_lower)
        result['query_classification'] = query_type
        
        if query_type in ['analytical', 'research', 'data']:
            result['enhancements']['analytical_framework'] = self._generate_analytical_framework(message, query_type)
        
        result['enhancements']['writing_style'] = self._determine_optimal_style(message, context)
        result['enhancements']['response_structure'] = self._generate_response_structure(query_type, message)
        result['enhancements']['confidence_metrics'] = self._calculate_confidence_metrics(message)
        
        if query_type == 'mathematical':
            result['enhancements']['mathematical_context'] = self._get_mathematical_context(message)
        
        nexus_insights = self._get_nexus_insights(message, query_type, context)
        if nexus_insights:
            result['nexus_intelligence'] = nexus_insights
            if nexus_insights.get('processing_boost'):
                confidence = result['enhancements'].get('confidence_metrics', {})
                confidence['nexus_enhanced'] = True
                confidence['nexus_processing_status'] = nexus_insights['status']
                result['enhancements']['confidence_metrics'] = confidence
        
        processing_time = (datetime.now() - analysis_start).total_seconds()
        result['processing_time_seconds'] = processing_time
        
        self.processing_history.append({
            'timestamp': analysis_start.isoformat(),
            'query_type': query_type,
            'processing_time': processing_time,
            'nexus_active': nexus_insights is not None
        })
        
        return result
    
    def _get_nexus_insights(self, message: str, query_type: str, context: Optional[Dict] = None) -> Optional[Dict]:
        """Process query through Quantum Intelligence Nexus for enhanced intelligence."""
        if not self.nexus:
            return None
        
        try:
            nexus_result = self.nexus.process_query(message, enable_quantum=True)
            introspection = self.nexus.introspect()
            
            insights = {
                'status': nexus_result.get('status', 'unknown'),
                'machine_name': introspection.get('machine_name', 'CYRUS_Nexus'),
                'version': introspection.get('version', '2.0.0'),
                'nexus_active': introspection.get('status') == 'ACTIVE',
                'operations_count': introspection.get('operations', 0),
                'processing_boost': True,
                'query_processed': True,
                'intelligence_layer': 'quantum_nexus_v2',
                'enhancement_signals': {
                    'query_type': query_type,
                    'quantum_processing': True,
                    'nexus_coherence': 'stable',
                    'parallel_processing': True,
                }
            }
            
            if query_type in ['analytical', 'research', 'data', 'mathematical', 'technical']:
                insights['enhancement_signals']['deep_analysis'] = True
                insights['enhancement_signals']['precision_mode'] = True
            
            return insights
        except Exception as e:
            return {'status': 'error', 'processing_boost': False, 'error': str(e)}
    
    def _classify_query(self, message: str) -> str:
        """Classify the type of query for optimal processing."""
        keywords = {
            'analytical': ['analyze', 'analysis', 'examine', 'investigate', 'evaluate', 'assess', 'study'],
            'research': ['research', 'find', 'search', 'discover', 'explore', 'learn about'],
            'data': ['data', 'statistics', 'numbers', 'metrics', 'calculate', 'compute', 'measure'],
            'mathematical': ['equation', 'formula', 'calculate', 'solve', 'math', 'algebra', 'calculus'],
            'creative': ['write', 'create', 'generate', 'compose', 'design', 'imagine', 'story'],
            'technical': ['code', 'program', 'debug', 'implement', 'build', 'develop', 'api'],
            'conversational': ['hello', 'hi', 'hey', 'how are', 'what\'s up', 'thanks', 'thank you']
        }
        
        for query_type, words in keywords.items():
            if any(word in message for word in words):
                return query_type
        
        return 'general'
    
    def _determine_optimal_style(self, message: str, context: Optional[Dict] = None) -> Dict:
        """Determine the optimal writing style for the response."""
        analysis = self.style_analyzer.analyze_writing_style(message)
        
        query_type = self._classify_query(message.lower())
        
        style_recommendations = {
            'analytical': 'professional',
            'research': 'professional',
            'data': 'professional',
            'mathematical': 'professional',
            'technical': 'business',
            'creative': 'casual',
            'conversational': 'casual',
            'general': 'business'
        }
        
        recommended_style = style_recommendations.get(query_type, 'business')
        
        return {
            'input_style_analysis': {
                'dominant_style': analysis['dominant_style'],
                'style_scores': analysis['style_scores'],
                'confidence': analysis['confidence']
            },
            'recommended_response_style': recommended_style,
            'style_guidelines': self._get_style_guidelines(recommended_style)
        }
    
    def _get_style_guidelines(self, style: str) -> Dict:
        """Get specific guidelines for a writing style."""
        guidelines = {
            'professional': {
                'tone': 'formal and authoritative',
                'vocabulary': 'advanced technical vocabulary',
                'sentence_structure': 'complex, well-structured sentences',
                'pronouns': 'third person preferred',
                'contractions': 'avoid',
                'examples': ['Furthermore, the analysis indicates...', 'It is evident that...', 'The data demonstrates...']
            },
            'business': {
                'tone': 'professional but accessible',
                'vocabulary': 'clear professional vocabulary',
                'sentence_structure': 'clear, concise sentences',
                'pronouns': 'mixed usage acceptable',
                'contractions': 'minimal',
                'examples': ['The results show that...', 'We found that...', 'Here are the key findings...']
            },
            'casual': {
                'tone': 'friendly and conversational',
                'vocabulary': 'everyday language',
                'sentence_structure': 'simple, direct sentences',
                'pronouns': 'first and second person',
                'contractions': 'use freely',
                'examples': ["So here's what I found...", "That's a great question!", "Let me break this down..."]
            }
        }
        
        return guidelines.get(style, guidelines['business'])
    
    def _generate_analytical_framework(self, message: str, query_type: str) -> Dict:
        """Generate an analytical framework for complex queries."""
        frameworks = {
            'analytical': {
                'approach': 'Systematic Analysis',
                'steps': [
                    'Identify key variables and relationships',
                    'Apply relevant analytical models',
                    'Evaluate evidence and data',
                    'Synthesize findings',
                    'Draw conclusions with confidence levels'
                ],
                'output_format': 'structured_analysis'
            },
            'research': {
                'approach': 'Research Synthesis',
                'steps': [
                    'Define research scope',
                    'Gather relevant information',
                    'Cross-reference sources',
                    'Identify patterns and insights',
                    'Present findings with citations'
                ],
                'output_format': 'research_report'
            },
            'data': {
                'approach': 'Quantitative Analysis',
                'steps': [
                    'Data collection and validation',
                    'Statistical analysis',
                    'Pattern recognition',
                    'Visualization recommendations',
                    'Actionable insights'
                ],
                'output_format': 'data_report'
            }
        }
        
        return frameworks.get(query_type, {
            'approach': 'General Analysis',
            'steps': ['Understand query', 'Gather information', 'Formulate response'],
            'output_format': 'general'
        })
    
    def _generate_response_structure(self, query_type: str, message: str) -> Dict:
        """Generate optimal response structure based on query type."""
        structures = {
            'analytical': {
                'sections': ['Overview', 'Analysis', 'Findings', 'Recommendations', 'Conclusion'],
                'include_metrics': True,
                'include_visualization': True
            },
            'research': {
                'sections': ['Summary', 'Background', 'Key Findings', 'Sources', 'Further Reading'],
                'include_metrics': False,
                'include_visualization': False
            },
            'data': {
                'sections': ['Summary Statistics', 'Key Metrics', 'Trends', 'Insights', 'Recommendations'],
                'include_metrics': True,
                'include_visualization': True
            },
            'mathematical': {
                'sections': ['Problem Statement', 'Methodology', 'Solution', 'Verification'],
                'include_metrics': True,
                'include_visualization': False
            },
            'creative': {
                'sections': ['Introduction', 'Main Content', 'Conclusion'],
                'include_metrics': False,
                'include_visualization': False
            },
            'technical': {
                'sections': ['Overview', 'Implementation', 'Code Examples', 'Best Practices', 'Notes'],
                'include_metrics': False,
                'include_visualization': False
            },
            'conversational': {
                'sections': ['Response'],
                'include_metrics': False,
                'include_visualization': False
            }
        }
        
        return structures.get(query_type, {
            'sections': ['Response'],
            'include_metrics': False,
            'include_visualization': False
        })
    
    def _calculate_confidence_metrics(self, message: str) -> Dict:
        """Calculate confidence metrics for the response."""
        word_count = len(message.split())
        has_specific_terms = any(term in message.lower() for term in ['specific', 'exactly', 'precisely', 'detail'])
        
        clarity_score = min(1.0, word_count / 20 * 0.5 + 0.5)
        specificity_score = 0.9 if has_specific_terms else 0.7
        
        return {
            'query_clarity': clarity_score,
            'query_specificity': specificity_score,
            'response_confidence': (clarity_score + specificity_score) / 2,
            'recommendation': 'high_detail' if specificity_score > 0.8 else 'standard'
        }
    
    def _get_mathematical_context(self, message: str) -> Dict:
        """Get mathematical context for math-related queries."""
        return {
            'notation_style': 'unicode',
            'include_derivations': True,
            'include_proofs': False,
            'decimal_precision': 6,
            'scientific_notation': True
        }
    
    def adapt_response_style(self, text: str, target_style: str) -> str:
        """Adapt a response to a target writing style."""
        return self.style_analyzer.adapt_text_to_style(text, target_style)
    
    def get_processing_stats(self) -> Dict:
        """Get processing statistics."""
        if not self.processing_history:
            return {'total_queries': 0}
        
        times = [h['processing_time'] for h in self.processing_history]
        return {
            'total_queries': len(self.processing_history),
            'avg_processing_time': sum(times) / len(times),
            'min_processing_time': min(times),
            'max_processing_time': max(times),
            'query_types': list(set(h['query_type'] for h in self.processing_history))
        }


engine = QuantumIntelligenceEngine()


class QuantumBridgeHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for Quantum AI Bridge."""
    
    def log_message(self, format, *args):
        pass
    
    def _send_response(self, status: int, data: Dict):
        """Send JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        if self.path == '/health':
            self._send_response(200, {
                'status': 'healthy',
                'service': 'quantum-ai-bridge',
                'version': '2.0.0',
                'nexus_available': NEXUS_AVAILABLE,
                'nexus_active': engine.nexus is not None,
                'timestamp': datetime.now().isoformat()
            })
        elif self.path == '/stats':
            self._send_response(200, engine.get_processing_stats())
        elif self.path == '/nexus/status':
            if engine.nexus:
                self._send_response(200, engine.nexus.introspect())
            else:
                self._send_response(200, {'status': 'unavailable', 'nexus_available': NEXUS_AVAILABLE})
        elif self.path == '/nexus/tools':
            if engine.nexus:
                self._send_response(200, {'tools': engine.nexus.list_tools()})
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        elif self.path == '/nexus/model-info':
            if engine.nexus:
                self._send_response(200, engine.nexus.execute_tool('model_info'))
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        elif self.path == '/nexus/system-status':
            if engine.nexus:
                self._send_response(200, engine.nexus.execute_tool('system_status'))
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        elif self.path == '/nexus/memory':
            if engine.nexus:
                self._send_response(200, engine.nexus.execute_tool('memory_status'))
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        else:
            self._send_response(404, {'error': 'Not found'})
    
    def do_POST(self):
        """Handle POST requests."""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self._send_response(400, {'error': 'Invalid JSON'})
            return
        
        if self.path == '/enhance':
            message = data.get('message', '')
            context = data.get('context')
            result = engine.enhance_response(message, context)
            self._send_response(200, result)
        
        elif self.path == '/adapt-style':
            text = data.get('text', '')
            target_style = data.get('style', 'business')
            adapted = engine.adapt_response_style(text, target_style)
            self._send_response(200, {'adapted_text': adapted, 'target_style': target_style})
        
        elif self.path == '/analyze-style':
            text = data.get('text', '')
            analysis = engine.style_analyzer.analyze_writing_style(text)
            self._send_response(200, analysis)
        
        elif self.path == '/nexus/query':
            if engine.nexus:
                query = data.get('query', '')
                enable_quantum = data.get('enable_quantum', True)
                result = engine.nexus.process_query(query, enable_quantum=enable_quantum)
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Quantum Intelligence Nexus not available'})
        
        elif self.path == '/nexus/introspect':
            if engine.nexus:
                self._send_response(200, engine.nexus.introspect())
            else:
                self._send_response(503, {'error': 'Quantum Intelligence Nexus not available'})
        
        elif self.path == '/nexus/execute-tool':
            if engine.nexus:
                tool_name = data.get('tool', '')
                params = data.get('params', {})
                result = engine.nexus.execute_tool(tool_name, params)
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        
        elif self.path == '/nexus/predict':
            if engine.nexus:
                features = data.get('features', [0.5] * 10)
                result = engine.nexus.execute_tool('predict', {'features': features})
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        
        elif self.path == '/nexus/batch-predict':
            if engine.nexus:
                features = data.get('features', [[0.5] * 10])
                result = engine.nexus.execute_tool('batch_predict', {'features': features})
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        
        elif self.path == '/nexus/explain':
            if engine.nexus:
                features = data.get('features', [0.5] * 10)
                method = data.get('method', 'feature_importance')
                num_features = data.get('num_features', 10)
                result = engine.nexus.execute_tool('explain', {
                    'features': features, 'method': method, 'num_features': num_features
                })
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        
        elif self.path == '/nexus/eda':
            if engine.nexus:
                csv_path = data.get('csv_path')
                data_json = data.get('data')
                target_col = data.get('target_col')
                result = engine.nexus.execute_tool('eda', {
                    'csv_path': csv_path, 'data_json': data_json, 'target_col': target_col
                })
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        
        elif self.path == '/nexus/preprocess':
            if engine.nexus:
                csv_path = data.get('csv_path')
                operations = data.get('operations', ['impute', 'scale'])
                result = engine.nexus.execute_tool('preprocess', {
                    'csv_path': csv_path, 'operations': operations
                })
                self._send_response(200, result)
            else:
                self._send_response(503, {'error': 'Nexus not available'})
        
        else:
            self._send_response(404, {'error': 'Endpoint not found'})


def run_server(port: int = 5001):
    """Run the Quantum AI Bridge server."""
    server = HTTPServer(('127.0.0.1', port), QuantumBridgeHandler)
    print(f"[Quantum AI Bridge] Server running on port {port}")
    server.serve_forever()


if __name__ == '__main__':
    port = int(os.environ.get('QUANTUM_BRIDGE_PORT', 5001))
    run_server(port)
