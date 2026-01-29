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
} from 'lucide-react';

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

  const [takeoffAltitude, setTakeoffAltitude] = useState(10);
  const [newMissionName, setNewMissionName] = useState('');
  const [showMissionForm, setShowMissionForm] = useState(false);

  const formatFlightTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[rgba(84,84,88,0.65)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#0a84ff] to-[#64d2ff] rounded-2xl flex items-center justify-center">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold">Aerospace Control</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[13px] text-[rgba(235,235,245,0.6)]">MAVLink v2.0</span>
              {simulationMode && (
                <span className="px-2 py-0.5 bg-[rgba(255,159,10,0.15)] text-[#ff9f0a] text-[11px] font-semibold rounded-full">
                  SIMULATION
                </span>
              )}
            </div>
          </div>
        </div>
        
        {state?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[rgba(255,69,58,0.15)] text-[#ff453a] text-[15px] font-semibold rounded-xl hover:bg-[rgba(255,69,58,0.25)] transition-colors"
          >
            <WifiOff className="w-5 h-5" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => connect.mutate({ connectionType: 'wifi' })}
            disabled={connect.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0a84ff] text-white text-[15px] font-semibold rounded-xl hover:bg-[#409cff] transition-colors disabled:opacity-50"
          >
            {connect.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Wifi className="w-5 h-5" />
            )}
            Connect
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Telemetry & Controls */}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Telemetry Grid */}
          <div className="p-6">
            <h2 className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-4">Telemetry</h2>
            
            {!state?.connected ? (
              <div className="bg-[#1c1c1e] rounded-2xl p-12 flex flex-col items-center justify-center">
                <WifiOff className="w-12 h-12 text-[rgba(235,235,245,0.3)] mb-4" />
                <p className="text-[17px] text-[rgba(235,235,245,0.6)]">No Connection</p>
                <p className="text-[13px] text-[rgba(235,235,245,0.3)] mt-1">Connect to view telemetry data</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TelemetryCard 
                  icon={Battery} 
                  label="Battery" 
                  value={`${state.battery.toFixed(0)}%`} 
                  color={state.battery > 30 ? '#30d158' : '#ff453a'} 
                />
                <TelemetryCard icon={ArrowUp} label="Altitude" value={`${state.altitude.toFixed(1)} m`} />
                <TelemetryCard icon={Gauge} label="Speed" value={`${state.speed.toFixed(1)} m/s`} />
                <TelemetryCard icon={Compass} label="Heading" value={`${state.heading}°`} />
                <TelemetryCard icon={MapPin} label="Latitude" value={state.latitude.toFixed(6)} mono />
                <TelemetryCard icon={Navigation} label="Longitude" value={state.longitude.toFixed(6)} mono />
                <TelemetryCard 
                  icon={Signal} 
                  label="Satellites" 
                  value={`${state.satellites} GPS`} 
                  color={state.satellites >= 6 ? '#30d158' : '#ff9f0a'} 
                />
                <TelemetryCard icon={Gauge} label="Flight Time" value={formatFlightTime(state.flightTime)} mono />
              </div>
            )}
          </div>

          {/* Flight Controls */}
          <div className="p-6 pt-0">
            <h2 className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-4">Flight Control</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <ControlButton
                onClick={() => state?.armed ? disarm.mutate() : arm.mutate()}
                disabled={!state?.connected}
                active={state?.armed}
                icon={Power}
                label={state?.armed ? 'Armed' : 'Arm'}
                activeColor="#30d158"
              />
              <ControlButton
                onClick={() => takeoff.mutate(takeoffAltitude)}
                disabled={!state?.connected || !state?.armed}
                icon={ArrowUp}
                label="Takeoff"
              />
              <ControlButton
                onClick={() => land.mutate()}
                disabled={!state?.connected}
                icon={ArrowDown}
                label="Land"
              />
              <ControlButton
                onClick={() => returnToLaunch.mutate()}
                disabled={!state?.connected}
                icon={RotateCcw}
                label="RTL"
              />
            </div>
            
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[rgba(235,235,245,0.6)]">Altitude</span>
                <input
                  type="number"
                  value={takeoffAltitude}
                  onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
                  className="w-20 bg-[rgba(120,120,128,0.24)] border-none rounded-lg px-3 py-2 text-[15px] text-white text-center focus:ring-2 focus:ring-[#0a84ff] outline-none"
                  min={5}
                  max={100}
                />
                <span className="text-[13px] text-[rgba(235,235,245,0.4)]">meters</span>
              </div>
              
              {state?.mode && (
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-[rgba(235,235,245,0.6)]">Mode</span>
                  <span className="px-4 py-2 bg-[#2c2c2e] rounded-lg text-[15px] font-semibold text-white">{state.mode}</span>
                </div>
              )}
            </div>
            
            <button
              onClick={() => emergencyStop.mutate()}
              disabled={!state?.connected}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[#ff453a] text-white text-[17px] font-bold rounded-2xl disabled:opacity-30 hover:bg-[#ff6961] transition-colors"
            >
              <AlertOctagon className="w-6 h-6" />
              Emergency Stop
            </button>
          </div>
        </div>

        {/* Right Panel - Missions & Modes */}
        <div className="hidden xl:flex w-80 flex-col bg-[#1c1c1e] border-l border-[rgba(84,84,88,0.65)]">
          {/* Missions */}
          <div className="p-4 border-b border-[rgba(84,84,88,0.65)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide">Missions</h3>
              <button
                onClick={() => setShowMissionForm(!showMissionForm)}
                className="p-1.5 text-[#0a84ff] hover:bg-[rgba(10,132,255,0.1)] rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {showMissionForm && (
              <div className="mb-4">
                <input
                  type="text"
                  value={newMissionName}
                  onChange={(e) => setNewMissionName(e.target.value)}
                  placeholder="Mission name..."
                  className="w-full bg-[rgba(120,120,128,0.24)] rounded-xl px-4 py-3 text-[15px] text-white placeholder-[rgba(235,235,245,0.3)] outline-none focus:ring-2 focus:ring-[#0a84ff] mb-2"
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
                  className="w-full py-2.5 bg-[#0a84ff] text-white text-[15px] font-semibold rounded-xl hover:bg-[#409cff] transition-colors"
                >
                  Create Mission
                </button>
              </div>
            )}
            
            {missions.length === 0 ? (
              <div className="text-center py-8">
                <Target className="w-10 h-10 text-[rgba(235,235,245,0.2)] mx-auto mb-2" />
                <p className="text-[13px] text-[rgba(235,235,245,0.4)]">No missions created</p>
              </div>
            ) : (
              <div className="space-y-2">
                {missions.map((mission) => (
                  <div key={mission.id} className="p-4 bg-[#2c2c2e] rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[15px] font-medium text-white">{mission.name}</span>
                      <span className={`text-[11px] font-semibold uppercase ${
                        mission.status === 'active' ? 'text-[#30d158]' :
                        mission.status === 'completed' ? 'text-[#0a84ff]' :
                        mission.status === 'aborted' ? 'text-[#ff453a]' :
                        'text-[rgba(235,235,245,0.4)]'
                      }`}>
                        {mission.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-[rgba(235,235,245,0.4)] mb-3">{mission.waypoints.length} waypoints</p>
                    
                    {mission.status === 'pending' && (
                      <button
                        onClick={() => startMission.mutate(mission.id)}
                        disabled={!state?.connected || !state?.armed}
                        className="w-full py-2 bg-[rgba(48,209,88,0.15)] text-[#30d158] text-[13px] font-semibold rounded-lg hover:bg-[rgba(48,209,88,0.25)] transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start Mission
                      </button>
                    )}
                    
                    {mission.status === 'active' && (
                      <button
                        onClick={() => abortMission.mutate()}
                        className="w-full py-2 bg-[rgba(255,69,58,0.15)] text-[#ff453a] text-[13px] font-semibold rounded-lg hover:bg-[rgba(255,69,58,0.25)] transition-colors flex items-center justify-center gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Abort Mission
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flight Modes */}
          <div className="flex-1 p-4">
            <h3 className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-4">Flight Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              {['STABILIZE', 'LOITER', 'GUIDED', 'AUTO', 'RTL', 'LAND'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode.mutate(mode as any)}
                  disabled={!state?.connected}
                  className={`py-3 text-[13px] font-semibold rounded-xl transition-colors ${
                    state?.mode === mode
                      ? 'bg-[#0a84ff] text-white'
                      : 'bg-[#2c2c2e] text-[rgba(235,235,245,0.6)] hover:bg-[#3a3a3c] hover:text-white'
                  } disabled:opacity-30`}
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

function TelemetryCard({ icon: Icon, label, value, color, mono }: { icon: any; label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="bg-[#1c1c1e] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[rgba(235,235,245,0.4)]" />
        <span className="text-[12px] text-[rgba(235,235,245,0.4)] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-[22px] font-semibold ${mono ? 'font-mono' : ''}`} style={{ color: color || '#fff' }}>
        {value}
      </p>
    </div>
  );
}

function ControlButton({ onClick, disabled, active, icon: Icon, label, activeColor }: { onClick: () => void; disabled?: boolean; active?: boolean; icon: any; label: string; activeColor?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-2 py-5 rounded-2xl transition-colors ${
        active
          ? 'text-white'
          : 'bg-[#1c1c1e] text-white hover:bg-[#2c2c2e]'
      } disabled:opacity-30`}
      style={active ? { backgroundColor: activeColor || '#0a84ff' } : {}}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[13px] font-semibold">{label}</span>
    </button>
  );
}
