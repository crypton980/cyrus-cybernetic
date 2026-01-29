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
  Radio,
  Crosshair,
  Activity,
  Zap,
  Shield,
  Wind,
  Thermometer,
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-emerald-400';
    if (level > 30) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBatteryBg = (level: number) => {
    if (level > 60) return 'from-emerald-500 to-emerald-600';
    if (level > 30) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  };

  const getModeStyle = (mode: string, isActive: boolean) => {
    if (!isActive) return 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06] border-white/[0.06]';
    switch (mode) {
      case 'AUTO': return 'bg-gradient-to-r from-purple-500/30 to-violet-500/30 text-purple-300 border-purple-500/50';
      case 'GUIDED': return 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-cyan-300 border-cyan-500/50';
      case 'RTL': return 'bg-gradient-to-r from-orange-500/30 to-amber-500/30 text-amber-300 border-amber-500/50';
      case 'LAND': return 'bg-gradient-to-r from-yellow-500/30 to-lime-500/30 text-yellow-300 border-yellow-500/50';
      case 'LOITER': return 'bg-gradient-to-r from-teal-500/30 to-emerald-500/30 text-teal-300 border-teal-500/50';
      default: return 'bg-gradient-to-r from-gray-500/30 to-slate-500/30 text-gray-300 border-gray-500/50';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 lg:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl blur-xl opacity-40" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 flex items-center justify-center shadow-2xl">
              <Plane className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">Aerospace Command</h1>
              {simulationMode && (
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-amber-500/30">
                  SIM MODE
                </span>
              )}
            </div>
            <p className="text-sm text-white/40 flex items-center gap-2 mt-0.5">
              <Radio className="w-3.5 h-3.5" />
              MAVLink Protocol v2.0 Interface
            </p>
          </div>
        </div>
        
        {state?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 transition-all duration-300 group"
          >
            <WifiOff className="w-4 h-4 group-hover:animate-pulse" />
            <span className="font-medium">Disconnect</span>
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connect.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/30 rounded-xl text-emerald-400 transition-all duration-300 disabled:opacity-50 group"
          >
            {connect.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4 group-hover:animate-pulse" />
            )}
            <span className="font-medium">Establish Link</span>
          </button>
        )}
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-6 overflow-auto">
        <div className="xl:col-span-3 space-y-4 lg:space-y-6">
          <div className="rounded-2xl border border-white/[0.06] p-5 lg:p-6" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90 tracking-wide">Telemetry Dashboard</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Real-time sensor data</p>
                </div>
              </div>
              {state?.connected && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live Feed</span>
                </div>
              )}
            </div>
            
            {!state?.connected ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30">
                <div className="relative">
                  <WifiOff className="w-16 h-16 mb-4 opacity-30" />
                  <div className="absolute inset-0 animate-ping opacity-20">
                    <WifiOff className="w-16 h-16" />
                  </div>
                </div>
                <p className="text-lg font-medium text-white/50">No Active Link</p>
                <p className="text-sm text-white/30 mt-1">Establish connection to receive telemetry</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                <TelemetryCard 
                  icon={Battery} 
                  label="Battery" 
                  value={`${state.battery.toFixed(0)}%`}
                  color={getBatteryColor(state.battery)}
                  bgGradient={getBatteryBg(state.battery)}
                  showBar
                  barValue={state.battery}
                />
                <TelemetryCard 
                  icon={ArrowUp} 
                  label="Altitude" 
                  value={`${state.altitude.toFixed(1)}m`}
                  color="text-cyan-400"
                  bgGradient="from-cyan-500 to-blue-600"
                  subValue="MSL"
                />
                <TelemetryCard 
                  icon={Gauge} 
                  label="Airspeed" 
                  value={`${state.speed.toFixed(1)}`}
                  color="text-violet-400"
                  bgGradient="from-violet-500 to-purple-600"
                  subValue="m/s"
                />
                <TelemetryCard 
                  icon={Compass} 
                  label="Heading" 
                  value={`${state.heading}°`}
                  color="text-orange-400"
                  bgGradient="from-orange-500 to-red-600"
                  subValue={getHeadingDirection(state.heading)}
                />
                <TelemetryCard 
                  icon={MapPin} 
                  label="Position" 
                  value={`${state.latitude.toFixed(4)}`}
                  color="text-emerald-400"
                  bgGradient="from-emerald-500 to-teal-600"
                  subValue={`${state.longitude.toFixed(4)}`}
                  isCoord
                />
                <TelemetryCard 
                  icon={Satellite} 
                  label="GPS Lock" 
                  value={`${state.satellites}`}
                  color="text-blue-400"
                  bgGradient="from-blue-500 to-indigo-600"
                  subValue="satellites"
                />
                <TelemetryCard 
                  icon={Signal} 
                  label="Signal" 
                  value={`${state.signalStrength.toFixed(0)}%`}
                  color="text-green-400"
                  bgGradient="from-green-500 to-emerald-600"
                  showBar
                  barValue={state.signalStrength}
                />
                <TelemetryCard 
                  icon={Clock} 
                  label="Flight Time" 
                  value={formatFlightTime(state.flightTime)}
                  color="text-amber-400"
                  bgGradient="from-amber-500 to-orange-600"
                  subValue="elapsed"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.06] p-5 lg:p-6" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
                <Navigation className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90 tracking-wide">Flight Control Matrix</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Primary command interface</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-5">
              <FlightButton
                onClick={() => state?.armed ? disarm.mutate() : arm.mutate()}
                disabled={!state?.connected || arm.isPending || disarm.isPending}
                active={state?.armed}
                icon={Power}
                label={state?.armed ? 'ARMED' : 'ARM'}
                activeColor="from-emerald-500 to-green-600"
                glowColor="emerald"
              />
              <FlightButton
                onClick={() => takeoff.mutate(takeoffAltitude)}
                disabled={!state?.connected || !state?.armed || takeoff.isPending}
                icon={ArrowUp}
                label="TAKEOFF"
                activeColor="from-cyan-500 to-blue-600"
                glowColor="cyan"
              />
              <FlightButton
                onClick={() => land.mutate()}
                disabled={!state?.connected || land.isPending}
                icon={ArrowDown}
                label="LAND"
                activeColor="from-amber-500 to-orange-600"
                glowColor="amber"
              />
              <FlightButton
                onClick={() => returnToLaunch.mutate()}
                disabled={!state?.connected || returnToLaunch.isPending}
                icon={RotateCcw}
                label="RTL"
                activeColor="from-orange-500 to-red-600"
                glowColor="orange"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-4 mb-5">
              <div className="flex items-center gap-3">
                <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Alt:</label>
                <div className="relative">
                  <input
                    type="number"
                    value={takeoffAltitude}
                    onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
                    className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    min={5}
                    max={100}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">m</span>
                </div>
              </div>
              
              {state?.mode && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Mode:</span>
                  <span className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wider border ${getModeStyle(state.mode, true)}`}>
                    {state.mode}
                  </span>
                </div>
              )}
            </div>
            
            <button
              onClick={() => emergencyStop.mutate()}
              disabled={!state?.connected}
              className="w-full relative group overflow-hidden flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-white transition-all disabled:opacity-30"
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                boxShadow: state?.connected ? '0 0 40px rgba(220, 38, 38, 0.3)' : 'none'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <AlertTriangle className="w-5 h-5" />
              <span className="tracking-widest">EMERGENCY STOP</span>
            </button>
          </div>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">Missions</h3>
              </div>
              <button
                onClick={() => setShowMissionForm(!showMissionForm)}
                className="p-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-white/50 hover:text-white transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {showMissionForm && (
              <div className="mb-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <input
                  type="text"
                  value={newMissionName}
                  onChange={(e) => setNewMissionName(e.target.value)}
                  placeholder="Mission identifier..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white mb-3 focus:border-cyan-500/50 focus:outline-none transition-all placeholder:text-white/20"
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
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm font-medium transition-all"
                >
                  Initialize Mission
                </button>
              </div>
            )}
            
            {missions.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No Active Missions</p>
                <p className="text-xs text-white/20 mt-1">Create a flight plan to begin</p>
              </div>
            ) : (
              <div className="space-y-2">
                {missions.map((mission) => (
                  <div
                    key={mission.id}
                    className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white/90">{mission.name}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        mission.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        mission.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        mission.status === 'aborted' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        'bg-white/[0.05] text-white/40 border border-white/[0.1]'
                      }`}>
                        {mission.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mb-3 flex items-center gap-2">
                      <Crosshair className="w-3 h-3" />
                      {mission.waypoints.length} waypoints defined
                    </p>
                    
                    {mission.status === 'pending' && (
                      <button
                        onClick={() => startMission.mutate(mission.id)}
                        disabled={!state?.connected || !state?.armed}
                        className="w-full py-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        <Play className="w-3 h-3" />
                        Execute
                      </button>
                    )}
                    
                    {mission.status === 'active' && (
                      <button
                        onClick={() => abortMission.mutate()}
                        className="w-full py-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 hover:from-red-500/30 hover:to-rose-500/30 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-3 h-3" />
                        Abort Mission
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(12, 12, 18, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
                <Compass className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-white/90">Flight Modes</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['STABILIZE', 'LOITER', 'GUIDED', 'AUTO', 'RTL', 'LAND'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode.mutate(mode as any)}
                  disabled={!state?.connected}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold tracking-wider transition-all border ${getModeStyle(mode, state?.mode === mode)} disabled:opacity-30`}
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

function TelemetryCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  bgGradient, 
  subValue, 
  showBar, 
  barValue,
  isCoord 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  color: string; 
  bgGradient: string;
  subValue?: string; 
  showBar?: boolean; 
  barValue?: number;
  isCoord?: boolean;
}) {
  return (
    <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-all group">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${bgGradient} opacity-80`}>
          <Icon className="w-3 h-3 text-white" />
        </div>
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-mono font-bold ${isCoord ? 'text-lg' : 'text-2xl'} ${color} tracking-tight`}>
        {value}
      </div>
      {subValue && (
        <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">{subValue}</p>
      )}
      {showBar && barValue !== undefined && (
        <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${bgGradient} rounded-full transition-all duration-500`}
            style={{ width: `${barValue}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FlightButton({
  onClick,
  disabled,
  active,
  icon: Icon,
  label,
  activeColor,
  glowColor
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon: any;
  label: string;
  activeColor: string;
  glowColor: string;
}) {
  const glowStyles: Record<string, string> = {
    emerald: '0 0 30px rgba(16, 185, 129, 0.4)',
    cyan: '0 0 30px rgba(6, 182, 212, 0.4)',
    amber: '0 0 30px rgba(245, 158, 11, 0.4)',
    orange: '0 0 30px rgba(249, 115, 22, 0.4)',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex flex-col items-center gap-3 p-5 rounded-xl border transition-all duration-300 ${
        active
          ? `bg-gradient-to-br ${activeColor} border-white/20 text-white`
          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
      style={active ? { boxShadow: glowStyles[glowColor] } : undefined}
    >
      <Icon className={`w-6 h-6 transition-transform duration-300 ${!disabled && 'group-hover:scale-110'}`} />
      <span className="text-xs font-bold tracking-widest">{label}</span>
    </button>
  );
}

function getHeadingDirection(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}
