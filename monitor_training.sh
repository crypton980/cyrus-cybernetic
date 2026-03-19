#!/bin/bash
# Quantum Intelligence Nexus - Training Monitoring Script
# Usage: ./monitor_training.sh [terminal_number]

TERMINAL=${1:-1}

case $TERMINAL in
  1)
    echo "=== Terminal 1: Watching Training Logs ==="
    echo "Press Ctrl+C to stop"
    echo ""
    # Find most recent log file
    LATEST_LOG=$(ls -t logs/nexus_training_*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
      echo "Monitoring: $LATEST_LOG"
      tail -f "$LATEST_LOG"
    else
      echo "No log files found. Waiting for training to start..."
      while [ ! -f logs/nexus_training_*.log ]; do
        sleep 1
      done
      LATEST_LOG=$(ls -t logs/nexus_training_*.log | head -1)
      tail -f "$LATEST_LOG"
    fi
    ;;
  2)
    echo "=== Terminal 2: Monitoring GPU (MPS) ==="
    echo "Press Ctrl+C to stop"
    echo ""
    echo "Note: On macOS, we use MPS (Metal Performance Shaders), not CUDA"
    echo "Monitoring PyTorch MPS usage..."
    echo ""
    while true; do
      clear
      echo "=== MPS GPU Monitoring ==="
      echo "Time: $(date)"
      echo ""
      python3 << 'PYEOF'
import torch
if torch.backends.mps.is_available():
    print("✓ MPS Available: Yes")
    print("✓ MPS Built: Yes")
    print("✓ MPS Device: mps")
else:
    print("✗ MPS Not Available")
PYEOF
      echo ""
      echo "System Memory:"
      vm_stat | head -10
      echo ""
      echo "CPU Usage:"
      top -l 1 | grep "CPU usage" | head -1
      sleep 2
    done
    ;;
  3)
    echo "=== Terminal 3: System Resources ==="
    echo "Using 'top' (htop not available by default on macOS)"
    echo "Press 'q' to quit"
    echo ""
    top -o cpu -n 20
    ;;
  *)
    echo "Usage: $0 [1|2|3]"
    echo "  1 - Watch training logs"
    echo "  2 - Monitor GPU/MPS"
    echo "  3 - Check system resources"
    exit 1
    ;;
esac
