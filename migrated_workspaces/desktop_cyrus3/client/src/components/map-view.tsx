import { useState } from "react";
import { MapPin, Navigation, Target, ZoomIn, ZoomOut, Maximize2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Drone, Telemetry, Mission } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MapViewProps {
  drones: Drone[];
  telemetryData: Record<string, Telemetry>;
  selectedDroneId: string | null;
  missions: Mission[];
  onDroneSelect: (droneId: string) => void;
}

export function MapView({ drones, telemetryData, selectedDroneId, missions, onDroneSelect }: MapViewProps) {
  const [zoom, setZoom] = useState(12);
  const [showLayers, setShowLayers] = useState(false);

  const getDronePosition = (droneId: string) => {
    const telemetry = telemetryData[droneId];
    if (!telemetry) return null;
    return { lat: telemetry.latitude, lon: telemetry.longitude };
  };

  const mapToScreen = (lat: number, lon: number) => {
    const centerLat = 37.7749;
    const centerLon = -122.4194;
    const scale = zoom * 50;
    const x = 50 + (lon - centerLon) * scale;
    const y = 50 - (lat - centerLat) * scale;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  return (
    <div className="relative h-full bg-background rounded-lg overflow-hidden" data-testid="map-view">
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 30% 40%, hsl(var(--muted) / 0.3) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, hsl(var(--muted) / 0.2) 0%, transparent 40%),
            linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)
          `,
        }}
      >
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg className="absolute inset-0 w-full h-full opacity-10">
          {[...Array(5)].map((_, i) => (
            <circle
              key={i}
              cx="50%"
              cy="50%"
              r={`${(i + 1) * 10}%`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="4 4"
              className="text-muted-foreground"
            />
          ))}
        </svg>

        {missions.filter(m => m.status === "active").map((mission) => {
          const drone = drones.find(d => d.id === mission.droneId);
          if (!drone) return null;
          
          return (
            <svg key={mission.id} className="absolute inset-0 w-full h-full pointer-events-none">
              {mission.waypoints.length > 1 && (
                <polyline
                  points={mission.waypoints.map((wp) => {
                    const pos = mapToScreen(wp.latitude, wp.longitude);
                    return `${pos.x}%,${pos.y}%`;
                  }).join(" ")}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  opacity="0.6"
                />
              )}
              {mission.waypoints.map((wp, idx) => {
                const pos = mapToScreen(wp.latitude, wp.longitude);
                return (
                  <g key={wp.id}>
                    <circle
                      cx={`${pos.x}%`}
                      cy={`${pos.y}%`}
                      r="6"
                      fill="hsl(var(--primary) / 0.3)"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1.5"
                    />
                    <text
                      x={`${pos.x}%`}
                      y={`${pos.y}%`}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[8px] fill-primary font-bold"
                    >
                      {idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          );
        })}

        {drones.map((drone) => {
          const telemetry = telemetryData[drone.id];
          if (!telemetry) return null;
          
          const pos = mapToScreen(telemetry.latitude, telemetry.longitude);
          const isSelected = selectedDroneId === drone.id;
          const isEmergency = drone.status === "emergency";
          const isOnMission = drone.status === "mission";

          return (
            <div
              key={drone.id}
              className={cn(
                "absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform",
                isSelected && "scale-125 z-10"
              )}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => onDroneSelect(drone.id)}
              data-testid={`map-drone-${drone.id}`}
            >
              <div className="relative">
                {isSelected && (
                  <div className="absolute inset-0 -m-2 rounded-full border-2 border-primary animate-ping opacity-50" />
                )}
                {isEmergency && (
                  <div className="absolute inset-0 -m-3 rounded-full bg-status-busy/30 animate-pulse" />
                )}
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center shadow-lg",
                    isSelected ? "bg-primary" : isOnMission ? "bg-status-online" : "bg-card",
                    isEmergency && "bg-status-busy"
                  )}
                  style={{ transform: `rotate(${telemetry.heading}deg)` }}
                >
                  <Navigation className={cn(
                    "h-3.5 w-3.5",
                    isSelected || isOnMission ? "text-white" : "text-foreground"
                  )} />
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className={cn(
                    "text-[9px] font-medium px-1 py-0.5 rounded",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-card/90 text-foreground"
                  )}>
                    {drone.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute top-3 left-3 flex flex-col gap-1">
        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setZoom(z => Math.min(20, z + 1))} data-testid="button-zoom-in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setZoom(z => Math.max(1, z - 1))} data-testid="button-zoom-out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8" data-testid="button-fullscreen">
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button 
          size="icon" 
          variant={showLayers ? "default" : "secondary"} 
          className="h-8 w-8" 
          onClick={() => setShowLayers(!showLayers)}
          data-testid="button-layers"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      <Card className="absolute bottom-3 left-3 px-3 py-2 bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-online" />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-away" />
            <span>Returning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-busy" />
            <span>Emergency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-status-offline" />
            <span>Offline</span>
          </div>
        </div>
      </Card>

      <div className="absolute bottom-3 right-3 text-[10px] font-mono text-muted-foreground bg-card/80 px-2 py-1 rounded">
        Zoom: {zoom}x | Grid: 1km
      </div>
    </div>
  );
}
