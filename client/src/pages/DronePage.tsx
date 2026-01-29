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
  AlertOctagon,
  Play,
  Square,
  Target,
  Plus,
  Loader2,
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
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-4">
          <Plane className="w-5 h-5 text-white" strokeWidth={1.5} />
          <div>
            <h1 className="text-lg font-semibold text-white">AEROSPACE CONTROL</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-[#666]">MAVLink v2.0</span>
              {simulationMode && (
                <span className="px-1.5 py-0.5 bg-[#ffab00]/10 text-[#ffab00] text-[9px] font-semibold tracking-wider uppercase">SIM</span>
              )}
            </div>
          </div>
        </div>
        
        {state?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#333] text-[#ff1744] text-sm font-medium hover:bg-[#222] transition-colors"
          >
            <WifiOff className="w-4 h-4" />
            DISCONNECT
          </button>
        ) : (
          <button
            onClick={() => connect.mutate({ connectionType: 'wifi' })}
            disabled={connect.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#0066ff] text-white text-sm font-medium hover:bg-[#0052cc] transition-colors disabled:opacity-50"
          >
            {connect.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            CONNECT
          </button>
        )}
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-px bg-[#1f1f1f] overflow-auto">
        <div className="xl:col-span-3 bg-black flex flex-col">
          <div className="border-b border-[#1f1f1f]">
            <div className="px-6 py-3 border-b border-[#1f1f1f]">
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Telemetry</span>
            </div>
            
            {!state?.connected ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#444]">
                <WifiOff className="w-12 h-12 mb-4" strokeWidth={1} />
                <p className="text-sm">No connection</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1f1f1f]">
                <DataCell label="BATTERY" value={`${state.battery.toFixed(0)}`} unit="%" color={state.battery > 30 ? '#00c853' : '#ff1744'} />
                <DataCell label="ALTITUDE" value={state.altitude.toFixed(1)} unit="m" />
                <DataCell label="SPEED" value={state.speed.toFixed(1)} unit="m/s" />
                <DataCell label="HEADING" value={`${state.heading}`} unit="°" />
                <DataCell label="LATITUDE" value={state.latitude.toFixed(6)} mono />
                <DataCell label="LONGITUDE" value={state.longitude.toFixed(6)} mono />
                <DataCell label="SATELLITES" value={`${state.satellites}`} unit="GPS" color={state.satellites >= 6 ? '#00c853' : '#ffab00'} />
                <DataCell label="FLIGHT TIME" value={formatFlightTime(state.flightTime)} mono />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b border-[#1f1f1f]">
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Flight Control</span>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <ControlButton
                  onClick={() => state?.armed ? disarm.mutate() : arm.mutate()}
                  disabled={!state?.connected}
                  active={state?.armed}
                  icon={Power}
                  label={state?.armed ? 'ARMED' : 'ARM'}
                />
                <ControlButton
                  onClick={() => takeoff.mutate(takeoffAltitude)}
                  disabled={!state?.connected || !state?.armed}
                  icon={ArrowUp}
                  label="TAKEOFF"
                />
                <ControlButton
                  onClick={() => land.mutate()}
                  disabled={!state?.connected}
                  icon={ArrowDown}
                  label="LAND"
                />
                <ControlButton
                  onClick={() => returnToLaunch.mutate()}
                  disabled={!state?.connected}
                  icon={RotateCcw}
                  label="RTL"
                />
              </div>
              
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#666] uppercase tracking-wider">Altitude</span>
                  <input
                    type="number"
                    value={takeoffAltitude}
                    onChange={(e) => setTakeoffAltitude(Number(e.target.value))}
                    className="w-16 bg-[#0a0a0a] border border-[#333] px-2 py-1.5 text-sm font-mono text-white text-center focus:border-[#0066ff] focus:outline-none"
                    min={5}
                    max={100}
                  />
                  <span className="text-[11px] text-[#444]">m</span>
                </div>
                
                {state?.mode && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#666] uppercase tracking-wider">Mode</span>
                    <span className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] text-sm font-semibold text-white">{state.mode}</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => emergencyStop.mutate()}
                disabled={!state?.connected}
                className="w-full flex items-center justify-center gap-3 py-4 bg-[#ff1744] text-white font-bold tracking-wider disabled:opacity-30 hover:bg-[#d50000] transition-colors"
              >
                <AlertOctagon className="w-5 h-5" />
                EMERGENCY STOP
              </button>
            </div>
          </div>
        </div>

        <div className="bg-black flex flex-col border-l border-[#1f1f1f]">
          <div className="border-b border-[#1f1f1f]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Missions</span>
              <button
                onClick={() => setShowMissionForm(!showMissionForm)}
                className="p-1 text-[#666] hover:text-white"
              >
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
                    placeholder="Mission ID..."
                    className="w-full bg-[#0a0a0a] border border-[#333] px-3 py-2 text-sm text-white mb-2 focus:border-[#0066ff] focus:outline-none placeholder:text-[#444]"
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
                    className="w-full py-2 bg-[#0066ff] text-white text-sm font-medium hover:bg-[#0052cc] transition-colors"
                  >
                    CREATE
                  </button>
                </div>
              )}
              
              {missions.length === 0 ? (
                <div className="text-center py-8 text-[#444]">
                  <Target className="w-8 h-8 mx-auto mb-2" strokeWidth={1} />
                  <p className="text-xs">No missions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {missions.map((mission) => (
                    <div key={mission.id} className="p-3 bg-[#0a0a0a] border border-[#1f1f1f]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{mission.name}</span>
                        <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                          mission.status === 'active' ? 'text-[#00c853]' :
                          mission.status === 'completed' ? 'text-[#0066ff]' :
                          mission.status === 'aborted' ? 'text-[#ff1744]' :
                          'text-[#666]'
                        }`}>
                          {mission.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#666] mb-2">{mission.waypoints.length} waypoints</p>
                      
                      {mission.status === 'pending' && (
                        <button
                          onClick={() => startMission.mutate(mission.id)}
                          disabled={!state?.connected || !state?.armed}
                          className="w-full py-1.5 bg-[#1a1a1a] border border-[#333] text-[#00c853] text-xs font-medium hover:bg-[#222] transition-colors disabled:opacity-30 flex items-center justify-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          START
                        </button>
                      )}
                      
                      {mission.status === 'active' && (
                        <button
                          onClick={() => abortMission.mutate()}
                          className="w-full py-1.5 bg-[#1a1a1a] border border-[#333] text-[#ff1744] text-xs font-medium hover:bg-[#222] transition-colors flex items-center justify-center gap-1"
                        >
                          <Square className="w-3 h-3" />
                          ABORT
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="px-4 py-3 border-b border-[#1f1f1f]">
              <span className="text-[11px] text-[#666] font-medium tracking-wider uppercase">Flight Mode</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {['STABILIZE', 'LOITER', 'GUIDED', 'AUTO', 'RTL', 'LAND'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode.mutate(mode as any)}
                  disabled={!state?.connected}
                  className={`py-2 text-xs font-semibold tracking-wider transition-colors ${
                    state?.mode === mode
                      ? 'bg-white text-black'
                      : 'bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-white hover:bg-[#222]'
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

function DataCell({ label, value, unit, color, mono }: { label: string; value: string; unit?: string; color?: string; mono?: boolean }) {
  return (
    <div className="bg-black p-4">
      <div className="text-[10px] text-[#666] font-medium tracking-wider uppercase mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-medium ${mono ? 'font-mono' : ''}`} style={{ color: color || '#fff' }}>{value}</span>
        {unit && <span className="text-[11px] text-[#666]">{unit}</span>}
      </div>
    </div>
  );
}

function ControlButton({ onClick, disabled, active, icon: Icon, label }: { onClick: () => void; disabled?: boolean; active?: boolean; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-2 py-4 transition-colors ${
        active
          ? 'bg-[#00c853] text-black'
          : 'bg-[#1a1a1a] border border-[#333] text-white hover:bg-[#222]'
      } disabled:opacity-30`}
    >
      <Icon className="w-5 h-5" strokeWidth={1.5} />
      <span className="text-xs font-semibold tracking-wider">{label}</span>
    </button>
  );
}
