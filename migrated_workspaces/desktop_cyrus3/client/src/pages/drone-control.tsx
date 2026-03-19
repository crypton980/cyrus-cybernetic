import { Link } from "wouter";
import { ArrowLeft, Radio, Plane, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAVLinkControlPanel } from "@/components/mavlink-control-panel";
import cyrusEmblem from "@assets/generated_images/cyrus_military_eagle_emblem.png";

export default function DroneControl() {
  return (
    <div className="min-h-screen bg-background tactical-grid relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/3 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 glass border-b border-cyan-500/20 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 font-mono text-xs" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                BACK
              </Button>
            </Link>
            <div className="h-6 w-px bg-cyan-500/30" />
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur-sm animate-pulse-glow" />
                <img src={cyrusEmblem} alt="CYRUS" className="relative h-10 w-10 rounded-full ring-2 ring-cyan-500/50" />
              </div>
              <div>
                <h1 className="text-base font-bold text-cyan-400 font-mono tracking-wider text-glow-subtle">DRONE CONTROL</h1>
                <p className="text-xs text-muted-foreground font-mono">MAVLINK INTERFACE</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 glass-light px-3 py-1.5 rounded">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <Radio className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-muted-foreground font-mono">MAVLINK</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <MAVLinkControlPanel />
          </div>

          <div className="space-y-6">
            <div className="glass border border-cyan-500/20 rounded-lg p-4">
              <h3 className="text-sm font-mono font-semibold text-cyan-400 mb-3 flex items-center gap-2 tracking-wider">
                <Shield className="h-4 w-4" />
                CONNECTION GUIDE
              </h3>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-1">UDP Connection (Recommended)</h4>
                  <p>For telemetry radios (SiK, RFD) or SITL simulator:</p>
                  <code className="block mt-1 bg-card p-2 rounded text-xs font-mono">
                    Host: 127.0.0.1 | Port: 14550
                  </code>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">Serial Connection</h4>
                  <p>Direct USB connection to flight controller:</p>
                  <code className="block mt-1 bg-card p-2 rounded text-xs font-mono">
                    Linux: /dev/ttyACM0 or /dev/ttyUSB0<br />
                    Mac: /dev/tty.usbmodem* or /dev/tty.usbserial*<br />
                    Windows: COM3, COM4, etc.
                  </code>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">TCP Connection</h4>
                  <p>For WiFi modules or network-connected drones:</p>
                  <code className="block mt-1 bg-card p-2 rounded text-xs font-mono">
                    Host: 192.168.4.1 | Port: 5760
                  </code>
                </div>

                <div className="pt-2 border-t border-cyan-500/10">
                  <h4 className="font-medium text-foreground mb-1">Testing with Simulator</h4>
                  <p>Use ArduPilot SITL for testing without hardware:</p>
                  <code className="block mt-1 bg-card p-2 rounded text-xs font-mono overflow-x-auto">
                    sim_vehicle.py -v ArduCopter --console --map
                  </code>
                </div>
              </div>
            </div>

            <div className="glass border border-cyan-500/20 rounded-lg p-4">
              <h3 className="text-sm font-mono font-semibold text-cyan-400 mb-3 flex items-center gap-2 tracking-wider">
                <Plane className="h-4 w-4" />
                SUPPORTED HARDWARE
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Flight Controllers</h4>
                  <ul className="text-muted-foreground text-xs space-y-0.5">
                    <li>Pixhawk (all versions)</li>
                    <li>Cube Orange/Black/Purple</li>
                    <li>Matek F405/F765</li>
                    <li>Holybro Durandal/Kakute</li>
                    <li>CUAV V5+/X7/Nora</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Autopilot Firmware</h4>
                  <ul className="text-muted-foreground text-xs space-y-0.5">
                    <li>ArduPilot (ArduCopter)</li>
                    <li>ArduPilot (ArduPlane)</li>
                    <li>ArduPilot (ArduRover)</li>
                    <li>PX4 Autopilot</li>
                    <li>iNAV (partial)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="glass border border-amber-500/30 rounded-lg p-4 glow-orange">
              <h3 className="text-sm font-mono font-semibold text-amber-400 mb-2 tracking-wider">SAFETY NOTICE</h3>
              <p className="text-xs text-muted-foreground">
                Always ensure proper safety procedures when operating real drones.
                Maintain visual line of sight, check airspace regulations, and have
                a spotter present. Test all commands in simulator first.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
