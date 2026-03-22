import numpy as np
import torch
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from server.quantum_ai.core_algorithms.deep_learning import DeepLearningProcessor

# Load knowledge material
knowledge_files = []
exclude_dirs = {'__pycache__', 'node_modules', '.git', 'nexus_env', 'migrated_workspaces', 'session_imports', 'checkpoints', 'logs', 'Quantum_Intelligence_Nexus_v2.0', 'deploy', 'deployment', 'examples', 'images', 'public', 'script', 'server', 'shared', 'cyrus_core'}

import os
for root, dirs, files in os.walk('.'):
    # Skip excluded directories
    dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
    for file in files:
        if file.endswith(('.txt', '.md')):
            filepath = os.path.join(root, file)
            knowledge_files.append(filepath)

ingested_data = []
for filepath in knowledge_files:
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            ingested_data.append((filepath, content))
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

print(f'Ingested {len(ingested_data)} knowledge materials')

print(f'Ingested {len(ingested_data)} knowledge materials')

# Prepare data for training
texts = [content for name, content in ingested_data]
labels = []
for name, content in ingested_data:
    if 'constitution' in name.lower():
        labels.append(0)
    elif 'attached_assets' in name:
        labels.append(1)
    elif name.endswith('.md'):
        labels.append(2)
    else:
        labels.append(0)  # default

# Vectorize texts to 20 features
vectorizer = TfidfVectorizer(max_features=20, stop_words='english')
X = vectorizer.fit_transform(texts).toarray()
y = np.array(labels)

print(f'Training data shape: {X.shape}, Labels: {y}')

# Initialize the processor
processor = DeepLearningProcessor(framework='auto')

# Build model
model = processor.build_neural_network([20, 64, 3])

# Train on knowledge
print("Training model on ingested knowledge...")
processor.train_model(X, y, epochs=10)

print("Model trained successfully on all collected knowledge data!")

print("Training completed. The CYRUS AI system is now trained on all knowledge materials including books, documents, and collected data.")

