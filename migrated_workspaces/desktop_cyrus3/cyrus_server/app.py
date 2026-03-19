#!/usr/bin/env python3
"""
CYRUS AI Backend - FastAPI Server for Drone Command AI Assistant
Integrated version that provides AI assistance for drone operations
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.absolute()
MODELS_DIR = PROJECT_ROOT / "models"

app = FastAPI(
    title="CYRUS AI - Drone Command Assistant",
    description="AI Assistant for Military-Grade Autonomous Drone Operations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_loaded = True
model_type = "drone-command-ai"

DRONE_KNOWLEDGE_BASE = {
    "commands": {
        "takeoff": "Initiate vertical takeoff sequence. Ensure GPS lock and clear airspace before execution.",
        "land": "Begin controlled descent and landing. Auto-selects nearest safe landing zone.",
        "rtb": "Return To Base - Drone will navigate back to launch coordinates using optimal path.",
        "hover": "Maintain current position and altitude. Useful for surveillance operations.",
        "patrol": "Execute predefined patrol route. Requires waypoints to be configured.",
        "emergency": "Trigger emergency protocols - immediate RTB with priority airspace.",
    },
    "status_explanations": {
        "online": "Drone is connected, systems nominal, ready for commands.",
        "mission": "Drone is actively executing a mission. Limited commands available.",
        "returning": "Drone is navigating back to base station.",
        "maintenance": "Drone requires maintenance. Ground crew intervention needed.",
        "emergency": "Emergency status - drone in fail-safe mode.",
        "offline": "No connection to drone. Check signal and power status.",
    },
    "pilot_modes": {
        "manual": "Full operator control. All movements require explicit commands.",
        "autonomous": "AI-controlled navigation using predefined waypoints.",
        "ai-assist": "Hybrid mode - AI provides suggestions and handles complex maneuvers.",
    }
}


class InferenceRequest(BaseModel):
    text: str = Field(..., description="User query or command")
    context: Optional[Dict[str, Any]] = Field(None, description="Current drone/mission context")


class DroneCommandRequest(BaseModel):
    command: str = Field(..., description="Command to analyze")
    drone_id: Optional[str] = Field(None, description="Target drone ID")
    drone_status: Optional[str] = Field(None, description="Current drone status")


def analyze_drone_query(query: str, context: Optional[Dict] = None) -> Dict[str, Any]:
    """Analyze user query and provide drone operation assistance"""
    query_lower = query.lower()
    
    for cmd, explanation in DRONE_KNOWLEDGE_BASE["commands"].items():
        if cmd in query_lower:
            return {
                "type": "command_help",
                "command": cmd.upper(),
                "explanation": explanation,
                "confidence": 0.9
            }
    
    for status, explanation in DRONE_KNOWLEDGE_BASE["status_explanations"].items():
        if status in query_lower:
            return {
                "type": "status_info",
                "status": status.upper(),
                "explanation": explanation,
                "confidence": 0.85
            }
    
    for mode, explanation in DRONE_KNOWLEDGE_BASE["pilot_modes"].items():
        if mode in query_lower or "pilot" in query_lower or "mode" in query_lower:
            if mode in query_lower:
                return {
                    "type": "mode_info",
                    "mode": mode.upper(),
                    "explanation": explanation,
                    "confidence": 0.85
                }
    
    if any(word in query_lower for word in ["battery", "power", "charge"]):
        return {
            "type": "telemetry_advice",
            "topic": "BATTERY",
            "advice": "Battery levels below 20% trigger low battery warnings. Consider RTB when below 25% to ensure safe return. Critical threshold is 15%.",
            "confidence": 0.8
        }
    
    if any(word in query_lower for word in ["signal", "connection", "link"]):
        return {
            "type": "telemetry_advice", 
            "topic": "SIGNAL",
            "advice": "Signal strength below 40% indicates degraded communication. Below 20% may trigger auto-RTB. Ensure line of sight for optimal signal.",
            "confidence": 0.8
        }
    
    if any(word in query_lower for word in ["gps", "position", "location", "coordinates"]):
        return {
            "type": "telemetry_advice",
            "topic": "GPS",
            "advice": "GPS accuracy under 3m is optimal. Values above 5m may affect waypoint precision. GPS lock is required for autonomous operations.",
            "confidence": 0.8
        }
    
    if any(word in query_lower for word in ["mission", "waypoint", "route", "plan"]):
        return {
            "type": "mission_help",
            "advice": "Missions consist of waypoints with actions (hover, photo, video, land). Plan missions with adequate battery reserves - typically 30% minimum for safe RTB.",
            "confidence": 0.75
        }
    
    if any(word in query_lower for word in ["help", "assist", "what can"]):
        return {
            "type": "general_help",
            "message": "I'm CYRUS, your AI drone operations assistant. I can help with:\n- Drone commands (takeoff, land, RTB, hover)\n- Status interpretation\n- Pilot mode explanations\n- Mission planning advice\n- Telemetry analysis\n\nWhat would you like to know?",
            "confidence": 1.0
        }
    
    return {
        "type": "general_response",
        "message": f"I understand you're asking about: '{query}'. As your drone operations AI, I can assist with commands, status interpretation, mission planning, and telemetry analysis. Could you be more specific about what you need help with?",
        "confidence": 0.5
    }


def format_response(analysis: Dict[str, Any]) -> str:
    """Format analysis into a human-readable response"""
    resp_type = analysis.get("type", "general")
    
    if resp_type == "command_help":
        return f"**{analysis['command']} Command**\n\n{analysis['explanation']}"
    elif resp_type == "status_info":
        return f"**{analysis['status']} Status**\n\n{analysis['explanation']}"
    elif resp_type == "mode_info":
        return f"**{analysis['mode']} Mode**\n\n{analysis['explanation']}"
    elif resp_type == "telemetry_advice":
        return f"**{analysis['topic']} Information**\n\n{analysis['advice']}"
    elif resp_type == "mission_help":
        return f"**Mission Planning**\n\n{analysis['advice']}"
    elif resp_type == "general_help":
        return analysis['message']
    else:
        return analysis.get('message', 'I can help with drone operations. What do you need?')


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_type": model_type,
        "model_loaded": model_loaded,
        "service": "CYRUS AI - Drone Command Assistant"
    }


@app.get("/v1/models")
async def get_models():
    """Get model information"""
    return {
        "model_type": model_type,
        "model_loaded": model_loaded,
        "capabilities": [
            "drone_command_interpretation",
            "status_analysis", 
            "mission_planning_advice",
            "telemetry_interpretation",
            "pilot_mode_guidance"
        ],
        "version": "1.0.0"
    }


@app.post("/v1/infer")
async def infer(request: InferenceRequest):
    """Main inference endpoint for drone operations assistance"""
    try:
        analysis = analyze_drone_query(request.text, request.context)
        response_text = format_response(analysis)
        
        return {
            "id": str(uuid.uuid4()),
            "result": {
                "answer": response_text,
                "analysis": analysis,
                "confidence": analysis.get("confidence", 0.5),
                "model_type": model_type
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/command/analyze")
async def analyze_command(request: DroneCommandRequest):
    """Analyze a specific drone command"""
    command_lower = request.command.lower()
    
    if command_lower in DRONE_KNOWLEDGE_BASE["commands"]:
        return {
            "valid": True,
            "command": command_lower.upper(),
            "explanation": DRONE_KNOWLEDGE_BASE["commands"][command_lower],
            "requires_confirmation": command_lower in ["emergency", "rtb", "land"],
            "drone_id": request.drone_id
        }
    
    return {
        "valid": False,
        "command": request.command,
        "message": f"Unknown command: {request.command}. Available commands: {', '.join(DRONE_KNOWLEDGE_BASE['commands'].keys())}",
        "available_commands": list(DRONE_KNOWLEDGE_BASE["commands"].keys())
    }


@app.get("/v1/commands")
async def list_commands():
    """List all available drone commands"""
    return {
        "commands": [
            {"name": cmd.upper(), "description": desc}
            for cmd, desc in DRONE_KNOWLEDGE_BASE["commands"].items()
        ]
    }


@app.get("/v1/modes")
async def list_modes():
    """List all pilot modes"""
    return {
        "modes": [
            {"name": mode.upper(), "description": desc}
            for mode, desc in DRONE_KNOWLEDGE_BASE["pilot_modes"].items()
        ]
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("CYRUS_PORT", "8765"))
    logger.info(f"Starting CYRUS AI on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
