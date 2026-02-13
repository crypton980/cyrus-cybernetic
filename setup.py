"""
Setup configuration for Quantum AI Core v2.0

Quantum AI Core - Comprehensive data science and machine learning framework
with Deep Learning, Explainability, Advanced Visualization, and Enhanced Preprocessing.
"""

from setuptools import setup, find_packages
import os

# Read README if available
readme_path = os.path.join(os.path.dirname(__file__), "README.md")
long_description = ""
if os.path.exists(readme_path):
    with open(readme_path, "r", encoding="utf-8") as fh:
        long_description = fh.read()
else:
    long_description = """
Quantum AI Core v2.0 - Comprehensive data science and machine learning framework.

Features:
- Deep Learning: PyTorch and TensorFlow support (MLP, CNN, LSTM)
- Explainability: SHAP, LIME, Feature Importance, Fairness Metrics
- Advanced Visualization: Clustering, PCA, t-SNE, Training History, Metrics
- Enhanced Preprocessing: Missing Values, Outliers, Scaling, Encoding, EDA

For more information, see the documentation files in the repository.
"""

setup(
    name="quantum-ai-core",
    version="2.0.0",
    author="crypton980",
    description="Quantum AI Core - Comprehensive data science and ML framework",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/crypton980/quantum-ai-core",
    packages=find_packages(where="server", include=["quantum_ai*", "quantum_ai.core_algorithms*"]),
    package_dir={"": "server"},
    py_modules=["quantum_ai_core"],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "numpy>=1.21.0",
        "scipy>=1.7.0",
        "scikit-learn>=1.0.1",
        "networkx>=2.6.0",
        "matplotlib>=3.4.0",
        "pandas>=1.3.0",
        "joblib>=1.0.0",
    ],
    extras_require={
        "deep-learning": [
            "torch>=1.9.0",
            "tensorflow>=2.6.0",
        ],
        "explainability": [
            "shap>=0.40.0",
            "lime>=0.2.0",
        ],
        "visualization": [
            "plotly>=5.0.0",
            "seaborn>=0.11.0",
        ],
        "all": [
            "torch>=1.9.0",
            "tensorflow>=2.6.0",
            "shap>=0.40.0",
            "lime>=0.2.0",
            "plotly>=5.0.0",
            "seaborn>=0.11.0",
        ],
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
        ],
    },
    keywords=[
        "machine learning",
        "deep learning",
        "data science",
        "explainable ai",
        "xai",
        "shap",
        "lime",
        "pytorch",
        "tensorflow",
        "visualization",
        "preprocessing",
        "eda",
    ],
    project_urls={
        "Documentation": "https://github.com/crypton980/quantum-ai-core",
        "Source": "https://github.com/crypton980/quantum-ai-core",
        "Tracker": "https://github.com/crypton980/quantum-ai-core/issues",
    },
)

