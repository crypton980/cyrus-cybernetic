"""
Core Algorithms Package - Root convenience wrapper

Delegates all imports to server/quantum_ai/core_algorithms/ which contains
the actual algorithm implementations. This file exists for standalone usage
outside of the quantum_bridge server context.
"""

import sys
import os
import importlib

_server_ca = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'server', 'quantum_ai', 'core_algorithms'))

if os.path.isdir(_server_ca):
    for _f in os.listdir(_server_ca):
        if _f.endswith('.py') and _f != '__init__.py':
            _mod_name = _f[:-3]
            _mod_path = os.path.join(_server_ca, _f)
            _spec = importlib.util.spec_from_file_location(
                f"core_algorithms.{_mod_name}", _mod_path
            )
            if _spec and _spec.loader:
                _mod = importlib.util.module_from_spec(_spec)
                sys.modules[f"core_algorithms.{_mod_name}"] = _mod
                try:
                    _spec.loader.exec_module(_mod)
                except Exception:
                    pass

    _init_path = os.path.join(_server_ca, '__init__.py')
    if os.path.exists(_init_path):
        _spec = importlib.util.spec_from_file_location(
            "_core_algorithms_server", _init_path
        )
        if _spec and _spec.loader:
            _mod = importlib.util.module_from_spec(_spec)
            try:
                _spec.loader.exec_module(_mod)
                for _name in dir(_mod):
                    if not _name.startswith('_'):
                        globals()[_name] = getattr(_mod, _name)
            except Exception:
                pass
