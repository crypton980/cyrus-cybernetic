import { useState } from 'react';
import { useDrone } from '../hooks/useDrone';
import {
  Plane,
  Wifi,
  WifiOff,
  Battery,
  Compass,
  MapPin,
  Gauge,
  Clock,
  Satellite,
  Signal,
  Power,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlertTriangle,
  Play,
  Pause,
  Target,
  Navigation,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export function DronePage() {
  const {
    state,
    simulationMode,
    missions,
    activeMission,
    isLoading,
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

  const [takeoffAltitude, setTakeoffAltitude] = useState(10);
  const [newMissionName, setNewMissionName] = useState('');
  const [showMissionForm, setShowMissionForm] = useState(false);

  const handleConnect = () => {
    connect.mutate({ connectionType: 'wifi' });
  };

  const formatFlightTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'AUTO': return 'bg-purple-500';
      case 'GUIDED': return 'bg-blue-500';
      case 'RTL': return 'bg-orange-500';
      case 'LAND': return 'bg-yellow-500';
      case 'LOITER': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Drone Control</h1>
              <p className="text-xs text-gray-400 flex items-center gap-2">
                {simulationMode && (
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">SIMULATION</span>
                )}
                MAVLink Protocol Interface
              </p>
            </div>
          </div>
          
          {state?.connected ? (
            <button
              onClick={() => disconnect.mutate()}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-400 transition-colors"
            >
              <WifiOff className="w-4 h-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connect.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-xl text-green-400 transition-colors disabled:opacity-50"
            >
              {connect.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              Connect
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-auto">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-400" />
              Telemetry Dashboard
            </h3>
            
            {!state?.connected ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <WifiOff className="w-12 h-12 mb-3 opacity-50" />
                <p>Drone not connected</p>
                <p className="text-sm text-gray-600">Click Connect to establish link</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Battery className="w-3 h-3" />
                    Battery
                  </div>
                  <p className={`text-2xl font-bold ${getBatteryColor(state.battery)}`}>
                    {state.battery.toFixed(0)}%
                  </p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <ArrowUp className="w-3 h-3" />
                    Altitude
                  </div>
                  <p className="text-2xl font-bold text-white">{state.altitude.toFixed(1)}m</p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Gauge className="w-3 h-3" />
                    Speed
                  </div>
                  <p className="text-2xl font-bold text-white">{state.speed.toFixed(1)} m/s</p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Compass className="w-3 h-3" />
                    Heading
                  </div>
                  <p className="text-2xl font-bold text-white">{state.heading}°</p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <MapPin className="w-3 h-3" />
                    Position
                  </div>
                  <p className="text-sm font-mono text-white">
                    {state.latitude.toFixed(6)}, {state.longitude.toFixed(6)}
                  </p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Satellite className="w-3 h-3" />
                    GPS
                  </div>
                  <p className="text-2xl font-bold text-white">{state.satellites} sats</p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Signal className="w-3 h-3" />
                    Signal
                  </div>
                  <p className="text-2xl font-bold text-green-400">{state.signalStrength.toFixed(0)}%</p>
                </div>
                
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    Flight Time
                  </div>
                  <p className="text-2xl font-bold text-white">{formatFlightTime(state.flightTime)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-purple-400" />
              Flight Controls
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => state?.armed ? disarm.mutate() : arm.mutate()}
                disabled={!state?.connected || arm.isPending || disarm.isPending}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  state?.armed
                    ? 'bg-green-500/20 border-green-500/50 text-green-400'
                    : 'bg-gray-800/40 border-gray-700/30 text-gray-400 hover:bg-gray-700/40'
                } disabled:opacity-50`}
              >
                <Power className="w-6 h-6" />
                <span className="text-sm">{state?.armed ? 'ARMED' : 'ARM'}</span>
              </button>
              
              <button
                onClick={() => takeoff.mutate(takeoffAltitude)}
                disabled={!state?.connected || !state?.armed || takeoff.isPending}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all disabled:opacity-50"
              >
                <ArrowUp className="w-6 h-6" />
                <span className="text-sm">Takeoff</span>
              </button>
              
              <button
                onClick={() => land.mutate()}
                disabled={!state?.connected || land.isPending}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 transition-all disabled:opacity-50"
              >
                <ArrowDown className="w-6 h-6" />
                <span className="text-sm">Land</span>
              </button>
              
              <button
                onClick={() => returnToLaunch.mutate()}
                disabled={!state?.connected || returnToLaunch.isPending}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-6 h-6" />
                <span className="text-sm">RTL</span>
              </button>
            </div>
            
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Takeoff Alt:</label>
                <input
                  type="number"
                  value={takeoffAltitude}
                  onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
                  className="w-20 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-white text-sm"
                  min={5}
                  max={100}
                />
                <span className="text-sm text-gray-500">m</span>
              </div>
              
              {state?.mode && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Mode:</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium text-white ${getModeColor(state.mode)}`}>
                    {state.mode}
                  </span>
                </div>
              )}
            </div>
            
            <button
              onClick={() => emergencyStop.mutate()}
              disabled={!state?.connected}
              className="w-full mt-4 flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold transition-colors disabled:opacity-50"
            >
              <AlertTriangle className="w-5 h-5" />
              EMERGENCY STOP
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                Missions
              </h3>
              <button
                onClick={() => setShowMissionForm(!showMissionForm)}
                className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {showMissionForm && (
              <div className="mb-4 p-3 bg-gray-800/30 border border-gray-700/30 rounded-lg">
                <input
                  type="text"
                  value={newMissionName}
                  onChange={(e) => setNewMissionName(e.target.value)}
                  placeholder="Mission name..."
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white mb-2"
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
                  className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm transition-colors"
                >
                  Create Demo Mission
                </button>
              </div>
            )}
            
            {missions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No missions created</p>
              </div>
            ) : (
              <div className="space-y-2">
                {missions.map((mission) => (
                  <div
                    key={mission.id}
                    className="p-3 bg-gray-800/30 border border-gray-700/30 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">{mission.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        mission.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        mission.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        mission.status === 'aborted' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {mission.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{mission.waypoints.length} waypoints</p>
                    
                    {mission.status === 'pending' && (
                      <button
                        onClick={() => startMission.mutate(mission.id)}
                        disabled={!state?.connected || !state?.armed}
                        className="w-full py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-sm transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 inline mr-1" />
                        Start
                      </button>
                    )}
                    
                    {mission.status === 'active' && (
                      <button
                        onClick={() => abortMission.mutate()}
                        className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm transition-colors"
                      >
                        <XCircle className="w-3 h-3 inline mr-1" />
                        Abort
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4 text-orange-400" />
              Flight Modes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {['STABILIZE', 'LOITER', 'GUIDED', 'AUTO', 'RTL', 'LAND'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode.mutate(mode as any)}
                  disabled={!state?.connected}
                  className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                    state?.mode === mode
                      ? `${getModeColor(mode)} text-white`
                      : 'bg-gray-800/40 text-gray-400 hover:bg-gray-700/40'
                  } disabled:opacity-50`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
