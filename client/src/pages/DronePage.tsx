import { useState } from 'react';
import { useDrone } from '../hooks/useDrone';
import { CyrusAssistant } from '../components/CyrusAssistant';
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
      {/* Header Panel */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[rgba(84,84,88,0.65)] bg-[#1c1c1e]">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-[#0a84ff] rounded-xl flex items-center justify-center">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Aerospace Control</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[rgba(235,235,245,0.5)]">MAVLink v2.0</span>
              {simulationMode && (
                <span className="px-2 py-0.5 bg-[rgba(255,159,10,0.15)] text-[#ff9f0a] text-[10px] font-semibold rounded">
                  SIM
                </span>
              )}
            </div>
          </div>
        </div>
        
        {state?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            className="flex items-center gap-2 px-4 py-2 bg-[rgba(255,69,58,0.15)] text-[#ff453a] text-sm font-semibold rounded-lg hover:bg-[rgba(255,69,58,0.25)] transition-colors"
          >
            <WifiOff className="w-4 h-4" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => connect.mutate({ connectionType: 'wifi' })}
            disabled={connect.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#0a84ff] text-white text-sm font-semibold rounded-lg hover:bg-[#409cff] transition-colors disabled:opacity-50"
          >
            {connect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            Connect
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Telemetry & Controls */}
        <div className="flex-1 flex flex-col overflow-auto p-5 gap-5">
          {/* Telemetry Panel */}
          <div className="bg-[#1c1c1e] rounded-xl border border-[rgba(84,84,88,0.65)]">
            <div className="px-4 py-3 border-b border-[rgba(84,84,88,0.65)]">
              <h2 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">Telemetry</h2>
            </div>
            
            {!state?.connected ? (
              <div className="flex flex-col items-center justify-center py-16">
                <WifiOff className="w-10 h-10 text-[rgba(235,235,245,0.2)] mb-3" />
                <p className="text-sm text-[rgba(235,235,245,0.5)]">No Connection</p>
                <p className="text-xs text-[rgba(235,235,245,0.3)]">Connect to view telemetry</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[rgba(84,84,88,0.3)]">
                <DataCell icon={Battery} label="Battery" value={`${state.battery.toFixed(0)}%`} color={state.battery > 30 ? '#30d158' : '#ff453a'} />
                <DataCell icon={ArrowUp} label="Altitude" value={`${state.altitude.toFixed(1)} m`} />
                <DataCell icon={Gauge} label="Speed" value={`${state.speed.toFixed(1)} m/s`} />
                <DataCell icon={Compass} label="Heading" value={`${state.heading}°`} />
                <DataCell icon={MapPin} label="Latitude" value={state.latitude.toFixed(6)} mono />
                <DataCell icon={Navigation} label="Longitude" value={state.longitude.toFixed(6)} mono />
                <DataCell icon={Signal} label="Satellites" value={`${state.satellites} GPS`} color={state.satellites >= 6 ? '#30d158' : '#ff9f0a'} />
                <DataCell icon={Clock} label="Flight Time" value={formatFlightTime(state.flightTime)} mono />
              </div>
            )}
          </div>

          {/* Flight Control Panel */}
          <div className="bg-[#1c1c1e] rounded-xl border border-[rgba(84,84,88,0.65)]">
            <div className="px-4 py-3 border-b border-[rgba(84,84,88,0.65)]">
              <h2 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">Flight Control</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <ControlButton
                  onClick={() => state?.armed ? disarm.mutate() : arm.mutate()}
                  disabled={!state?.connected}
                  active={state?.armed}
                  icon={Power}
                  label={state?.armed ? 'Armed' : 'Arm'}
                  activeColor="#30d158"
                />
                <ControlButton onClick={() => takeoff.mutate(takeoffAltitude)} disabled={!state?.connected || !state?.armed} icon={ArrowUp} label="Takeoff" />
                <ControlButton onClick={() => land.mutate()} disabled={!state?.connected} icon={ArrowDown} label="Land" />
                <ControlButton onClick={() => returnToLaunch.mutate()} disabled={!state?.connected} icon={RotateCcw} label="RTL" />
              </div>
              
              <div className="flex flex-wrap items-center gap-5 mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[rgba(235,235,245,0.5)]">Altitude</span>
                  <input
                    type="number"
                    value={takeoffAltitude}
                    onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
                    className="w-16 bg-[rgba(120,120,128,0.2)] rounded-lg px-3 py-2 text-sm text-white text-center outline-none focus:ring-2 focus:ring-[#0a84ff]"
                    min={5}
                    max={100}
                  />
                  <span className="text-xs text-[rgba(235,235,245,0.3)]">m</span>
                </div>
                
                {state?.mode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[rgba(235,235,245,0.5)]">Mode</span>
                    <span className="px-3 py-2 bg-[#2c2c2e] rounded-lg text-sm font-semibold text-white">{state.mode}</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => emergencyStop.mutate()}
                disabled={!state?.connected}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[#ff453a] text-white text-base font-bold rounded-xl disabled:opacity-30 hover:bg-[#ff6961] transition-colors"
              >
                <AlertOctagon className="w-5 h-5" />
                Emergency Stop
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Missions & Modes */}
        <div className="hidden xl:flex w-72 flex-col bg-[#1c1c1e] border-l border-[rgba(84,84,88,0.65)]">
          {/* Missions Panel */}
          <div className="border-b border-[rgba(84,84,88,0.65)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(84,84,88,0.65)]">
              <h3 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">Missions</h3>
              <button onClick={() => setShowMissionForm(!showMissionForm)} className="p-1 text-[#0a84ff] hover:bg-[rgba(10,132,255,0.1)] rounded transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              {showMissionForm && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={newMissionName}
                    onChange={(e) => setNewMissionName(e.target.value)}
                    placeholder="Mission name..."
                    className="w-full bg-[rgba(120,120,128,0.2)] rounded-lg px-3 py-2 text-sm text-white placeholder-[rgba(235,235,245,0.3)] outline-none focus:ring-2 focus:ring-[#0a84ff] mb-2"
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
                    className="w-full py-2 bg-[#0a84ff] text-white text-sm font-semibold rounded-lg hover:bg-[#409cff] transition-colors"
                  >
                    Create Mission
                  </button>
                </div>
              )}
              
              {missions.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-8 h-8 text-[rgba(235,235,245,0.2)] mx-auto mb-2" />
                  <p className="text-xs text-[rgba(235,235,245,0.4)]">No missions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {missions.map((mission) => (
                    <div key={mission.id} className="p-3 bg-[#2c2c2e] rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{mission.name}</span>
                        <span className={`text-[10px] font-semibold uppercase ${
                          mission.status === 'active' ? 'text-[#30d158]' :
                          mission.status === 'completed' ? 'text-[#0a84ff]' :
                          mission.status === 'aborted' ? 'text-[#ff453a]' :
                          'text-[rgba(235,235,245,0.4)]'
                        }`}>{mission.status}</span>
                      </div>
                      <p className="text-[10px] text-[rgba(235,235,245,0.4)] mb-2">{mission.waypoints.length} waypoints</p>
                      
                      {mission.status === 'pending' && (
                        <button
                          onClick={() => startMission.mutate(mission.id)}
                          disabled={!state?.connected || !state?.armed}
                          className="w-full py-1.5 bg-[rgba(48,209,88,0.15)] text-[#30d158] text-xs font-semibold rounded-lg hover:bg-[rgba(48,209,88,0.25)] transition-colors disabled:opacity-30 flex items-center justify-center gap-1"
                        >
                          <Play className="w-3 h-3" /> Start
                        </button>
                      )}
                      
                      {mission.status === 'active' && (
                        <button
                          onClick={() => abortMission.mutate()}
                          className="w-full py-1.5 bg-[rgba(255,69,58,0.15)] text-[#ff453a] text-xs font-semibold rounded-lg hover:bg-[rgba(255,69,58,0.25)] transition-colors flex items-center justify-center gap-1"
                        >
                          <Square className="w-3 h-3" /> Abort
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Flight Modes Panel */}
          <div className="flex-1 p-4">
            <h3 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide mb-3">Flight Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              {['STABILIZE', 'LOITER', 'GUIDED', 'AUTO', 'RTL', 'LAND'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode.mutate(mode as any)}
                  disabled={!state?.connected}
                  className={`py-2.5 text-xs font-semibold rounded-lg transition-colors ${
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
      <CyrusAssistant 
        module="aerospace" 
        context={`User is in aerospace/drone control module. ${state?.connected ? `Drone connected. Mode: ${state.mode}. Armed: ${state.armed}. Battery: ${state.battery}%` : "Drone not connected"}. ${simulationMode ? "Running in simulation mode." : ""}`}
        compact={true}
      />
    </div>
  );
}

function DataCell({ icon: Icon, label, value, color, mono }: { icon: any; label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="bg-[#1c1c1e] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-[rgba(235,235,245,0.4)]" />
        <span className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${mono ? 'font-mono text-lg' : ''}`} style={{ color: color || '#fff' }}>
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
      className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-colors ${
        active ? 'text-white' : 'bg-[#2c2c2e] text-white hover:bg-[#3a3a3c]'
      } disabled:opacity-30`}
      style={active ? { backgroundColor: activeColor || '#0a84ff' } : {}}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
