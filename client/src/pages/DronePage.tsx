import { useState } from 'react';
import { useDrone } from '../hooks/useDrone';
import { CyrusHumanoid } from '../components/CyrusHumanoid';
import { SystemDatabaseWidget } from '../components/SystemDatabaseWidget';
import {
  Plane,
  Wifi,
  WifiOff,
  Battery,
  Compass,
  MapPin,
  Gauge,
  Power,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlertOctagon,
  Play,
  Square,
  Target,
  Plus,
  Loader2,
  Navigation,
  Signal,
  Clock,
  AlertTriangle,
  Radio,
  Usb,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';

type ConnectionType = 'udp' | 'tcp' | 'serial';

export function DronePage() {
  const {
    state,
    simulationMode,
    missions,
    activeMission,
    connect,
    disconnect,
    arm,
    disarm,
    takeoff,
    land,
    returnToLaunch,
    emergencyStop,
    setMode,
    createMission,
    startMission,
    abortMission,
  } = useDrone();

  const [connectionType, setConnectionType] = useState<ConnectionType>('udp');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('14550');
  const [takeoffAltitude, setTakeoffAltitude] = useState(10);
  const [newMissionName, setNewMissionName] = useState('');
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [showConnectionGuide, setShowConnectionGuide] = useState(true);

  const formatFlightTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConnect = () => {
    // Map UI connection type to backend-supported types
    // UDP/TCP are network-based connections, mapped to 'wifi'
    // Serial stays as 'serial'
    const backendType = connectionType === 'serial' ? 'serial' : 'wifi';
    connect.mutate({ 
      connectionType: backendType as 'serial' | 'wifi' | 'mavlink', 
      host, 
      port: parseInt(port) 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-black text-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-800 rounded-xl flex items-center justify-center border border-cyan-500/30">
                <Plane className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-lg font-bold">
                  <span className="text-cyan-400">CYRUS</span>{" "}
                  <span className="text-white">Drone Control</span>
                </h1>
                <p className="text-xs text-gray-400">Real MAVLink Interface</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-300">MAVLink Protocol</span>
          </div>
        </header>

        {!state?.connected ? (
          <>
            {/* Real MAVLink Drone Connection */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <Radio className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold">Real MAVLink Drone Connection</h2>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <WifiOff className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Disconnected</span>
              </div>

              {/* Connection Type Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setConnectionType('udp')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    connectionType === 'udp'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  UDP
                </button>
                <button
                  onClick={() => setConnectionType('tcp')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    connectionType === 'tcp'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  TCP
                </button>
                <button
                  onClick={() => setConnectionType('serial')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    connectionType === 'serial'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Usb className="w-4 h-4" />
                  Serial
                </button>
              </div>

              {/* Host/IP and Port Inputs */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Host/IP</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="127.0.0.1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Port</label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="14550"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Standard MAVLink UDP port is 14550. For SITL simulators, use 14555.
              </p>

              {/* Connect Button */}
              <button
                onClick={handleConnect}
                disabled={connect.isPending}
                className="w-full flex items-center justify-center gap-2 py-4 bg-cyan-600 hover:bg-cyan-700 text-white text-base font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {connect.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wifi className="w-5 h-5" />
                )}
                Connect to Drone
              </button>
            </div>

            {/* Real Drone Control Notice */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-2">Real Drone Control</h3>
                  <p className="text-sm text-gray-400 mb-2">
                    This panel controls actual drones via MAVLink protocol. Ensure you have:
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                    <li>ArduPilot or PX4 flight controller</li>
                    <li>Proper connection (USB, telemetry radio, or WiFi)</li>
                    <li>Clear airspace and safety procedures</li>
                    <li>For testing: Use ArduPilot SITL simulator</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Connection Guide */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <button
                onClick={() => setShowConnectionGuide(!showConnectionGuide)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Signal className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold">Connection Guide</h3>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showConnectionGuide ? 'rotate-180' : ''}`} />
              </button>
              
              {showConnectionGuide && (
                <div className="px-4 pb-4 space-y-4">
                  {/* UDP Connection */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">UDP Connection (Recommended)</h4>
                    <p className="text-xs text-gray-400 mb-2">For telemetry radios (SiK, RFD) or SITL simulator:</p>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <code className="text-xs text-gray-300 font-mono">Host: 127.0.0.1 | Port: 14550</code>
                    </div>
                  </div>

                  {/* Serial Connection */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">Serial Connection</h4>
                    <p className="text-xs text-gray-400 mb-2">Direct USB connection to flight controller:</p>
                    <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                      <code className="text-xs text-gray-300 font-mono block">Linux: /dev/ttyACM0 or /dev/ttyUSB0</code>
                      <code className="text-xs text-gray-300 font-mono block">Mac: /dev/tty.usbmodem* or /dev/tty.usbserial*</code>
                      <code className="text-xs text-gray-300 font-mono block">Windows: COM3, COM4, etc.</code>
                    </div>
                  </div>

                  {/* TCP Connection */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">TCP Connection</h4>
                    <p className="text-xs text-gray-400 mb-2">For WiFi modules or network-connected drones:</p>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <code className="text-xs text-gray-300 font-mono">Host: 192.168.4.1 | Port: 5760</code>
                    </div>
                  </div>

                  {/* Testing with Simulator */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-2">Testing with Simulator</h4>
                    <p className="text-xs text-gray-400 mb-2">Use ArduPilot SITL for testing without hardware:</p>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <code className="text-xs text-gray-300 font-mono">sim_vehicle.py -v ArduCopter --console --map</code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Supported Hardware */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Plane className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold">Supported Hardware</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs text-gray-400 mb-2">Flight Controllers</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>Pixhawk (all versions)</li>
                    <li>Cube Orange/Black/Purple</li>
                    <li>Matek F405/F765</li>
                    <li>Holybro Durandal/Kakute</li>
                    <li>CUAV V5+/X7/Nora</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs text-gray-400 mb-2">Autopilot Firmware</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>ArduPilot (ArduCopter)</li>
                    <li>ArduPilot (ArduPlane)</li>
                    <li>ArduPilot (ArduRover)</li>
                    <li>PX4 Autopilot</li>
                    <li>iNAV (partial)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Safety Notice */}
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertOctagon className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-red-400">Safety Notice</h3>
              </div>
              <p className="text-sm text-gray-400">
                Always ensure proper safety procedures when operating real drones. Maintain visual line of sight, check airspace regulations, and have a spotter present. Test all commands in simulator first.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Connected State - Telemetry */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400">Connected</span>
                  {simulationMode && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">SIM</span>
                  )}
                </div>
                <button
                  onClick={() => disconnect.mutate()}
                  className="px-4 py-2 bg-red-600/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-600/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Battery className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Battery</span>
                  </div>
                  <p className={`text-xl font-bold ${state.battery > 30 ? 'text-green-400' : 'text-red-400'}`}>
                    {state.battery.toFixed(0)}%
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUp className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Altitude</span>
                  </div>
                  <p className="text-xl font-bold">{state.altitude.toFixed(1)} m</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Speed</span>
                  </div>
                  <p className="text-xl font-bold">{state.speed.toFixed(1)} m/s</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Compass className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Heading</span>
                  </div>
                  <p className="text-xl font-bold">{state.heading}°</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Latitude</span>
                  </div>
                  <p className="text-lg font-mono">{state.latitude.toFixed(6)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Navigation className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Longitude</span>
                  </div>
                  <p className="text-lg font-mono">{state.longitude.toFixed(6)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Signal className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Satellites</span>
                  </div>
                  <p className={`text-xl font-bold ${state.satellites >= 6 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {state.satellites} GPS
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Flight Time</span>
                  </div>
                  <p className="text-xl font-mono">{formatFlightTime(state.flightTime)}</p>
                </div>
              </div>
            </div>

            {/* Flight Controls */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-4">Flight Control</h3>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <button
                  onClick={() => state?.armed ? disarm.mutate() : arm.mutate()}
                  disabled={!state?.connected}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-colors ${
                    state?.armed ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
                  } disabled:opacity-30`}
                >
                  <Power className="w-6 h-6" />
                  <span className="text-xs font-semibold">{state?.armed ? 'Armed' : 'Arm'}</span>
                </button>
                <button
                  onClick={() => takeoff.mutate(takeoffAltitude)}
                  disabled={!state?.connected || !state?.armed}
                  className="flex flex-col items-center gap-2 py-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30"
                >
                  <ArrowUp className="w-6 h-6" />
                  <span className="text-xs font-semibold">Takeoff</span>
                </button>
                <button
                  onClick={() => land.mutate()}
                  disabled={!state?.connected}
                  className="flex flex-col items-center gap-2 py-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30"
                >
                  <ArrowDown className="w-6 h-6" />
                  <span className="text-xs font-semibold">Land</span>
                </button>
                <button
                  onClick={() => returnToLaunch.mutate()}
                  disabled={!state?.connected}
                  className="flex flex-col items-center gap-2 py-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30"
                >
                  <RotateCcw className="w-6 h-6" />
                  <span className="text-xs font-semibold">RTL</span>
                </button>
              </div>

              {/* Takeoff Altitude */}
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-400">Takeoff Altitude:</span>
                <input
                  type="number"
                  value={takeoffAltitude}
                  onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center"
                  min={5}
                  max={100}
                />
                <span className="text-sm text-gray-500">meters</span>
              </div>

              {/* Emergency Stop */}
              <button
                onClick={() => emergencyStop.mutate()}
                disabled={!state?.connected}
                className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-30"
              >
                <AlertOctagon className="w-5 h-5" />
                Emergency Stop
              </button>
            </div>

            {/* Flight Modes */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">Flight Mode</h3>
              <div className="grid grid-cols-3 gap-2">
                {['STABILIZE', 'LOITER', 'GUIDED', 'AUTO', 'RTL', 'LAND'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setMode.mutate(mode as any)}
                    disabled={!state?.connected}
                    className={`py-3 text-sm font-semibold rounded-lg transition-colors ${
                      state?.mode === mode
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                    } disabled:opacity-30`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Missions */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Missions</h3>
                <button
                  onClick={() => setShowMissionForm(!showMissionForm)}
                  className="p-2 text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {showMissionForm && (
                <div className="mb-4 p-4 bg-gray-800 rounded-lg">
                  <input
                    type="text"
                    value={newMissionName}
                    onChange={(e) => setNewMissionName(e.target.value)}
                    placeholder="Mission name..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-3"
                  />
                  <button
                    onClick={() => {
                      if (newMissionName) {
                        createMission.mutate({
                          name: newMissionName,
                          waypoints: [
                            { latitude: -24.6282, longitude: 25.9231, altitude: 20, action: 'waypoint' },
                            { latitude: -24.6290, longitude: 25.9240, altitude: 25, action: 'waypoint' },
                            { latitude: -24.6285, longitude: 25.9235, altitude: 20, action: 'rtl' },
                          ]
                        });
                        setNewMissionName('');
                        setShowMissionForm(false);
                      }
                    }}
                    className="w-full py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    Create Mission
                  </button>
                </div>
              )}

              {missions.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No missions created</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {missions.map((mission) => (
                    <div key={mission.id} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{mission.name}</span>
                        <span className={`text-xs font-semibold uppercase ${
                          mission.status === 'active' ? 'text-green-400' :
                          mission.status === 'completed' ? 'text-cyan-400' :
                          mission.status === 'aborted' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>{mission.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{mission.waypoints.length} waypoints</p>
                      
                      {mission.status === 'pending' && (
                        <button
                          onClick={() => startMission.mutate(mission.id)}
                          disabled={!state?.connected || !state?.armed}
                          className="w-full py-2 bg-green-600/20 text-green-400 text-sm font-semibold rounded-lg hover:bg-green-600/30 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" /> Start
                        </button>
                      )}
                      
                      {mission.status === 'active' && (
                        <button
                          onClick={() => abortMission.mutate()}
                          className="w-full py-2 bg-red-600/20 text-red-400 text-sm font-semibold rounded-lg hover:bg-red-600/30 transition-colors flex items-center justify-center gap-2"
                        >
                          <Square className="w-4 h-4" /> Abort
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <CyrusHumanoid 
        module="aerospace" 
        context={`User is in aerospace/drone control module. ${state?.connected ? `Drone connected. Mode: ${state.mode}. Armed: ${state.armed}. Battery: ${state.battery}%` : "Drone not connected"}. ${simulationMode ? "Running in simulation mode." : ""}`}
        compact={true}
      />
      <div className="mt-6">
        <SystemDatabaseWidget sourceModule="drone" />
      </div>
    </div>
  );
}

function Globe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
