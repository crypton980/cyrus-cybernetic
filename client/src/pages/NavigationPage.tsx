import { useState } from "react";
import { useNavigation } from "../hooks/useNavigation";
import {
  MapPin,
  Navigation,
  Share2,
  Crosshair,
  Route,
  Clock,
  RefreshCw,
  Play,
  Square,
  Send,
} from "lucide-react";

export function NavigationPage() {
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLon, setDestLon] = useState("");
  const [shareRecipient, setShareRecipient] = useState("");
  const [shareDuration, setShareDuration] = useState(300);
  const [travelMode, setTravelMode] = useState<"driving" | "walking" | "bicycling">(
    "driving"
  );

  const {
    currentPosition,
    activeShare,
    isWatching,
    startGPSWatch,
    stopGPSWatch,
    setManualPosition,
    getRoute,
    startShare,
    stopShare,
    isLoading,
    isRouting,
  } = useNavigation();

  const handleSetManualPosition = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setManualPosition.mutate({ lat, lon });
    }
  };

  const handleGetRoute = () => {
    if (!currentPosition) return;
    const lat = parseFloat(destLat);
    const lon = parseFloat(destLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      getRoute.mutate({
        origin: { lat: currentPosition.lat, lon: currentPosition.lon },
        destination: { lat, lon },
        mode: travelMode,
      });
    }
  };

  const handleStartShare = () => {
    if (!shareRecipient.trim()) return;
    startShare.mutate({
      recipientId: shareRecipient,
      durationSeconds: shareDuration,
      mode: "live",
    });
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Navigation</h1>
          <p className="text-gray-400">GPS tracking, routing, and location sharing</p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-400" />
                Current Position
              </h2>

              {currentPosition ? (
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Latitude</p>
                      <p className="font-mono text-lg">
                        {currentPosition.lat.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Longitude</p>
                      <p className="font-mono text-lg">
                        {currentPosition.lon.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Accuracy</p>
                      <p>{currentPosition.accuracy.toFixed(0)}m</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Source</p>
                      <p className="capitalize">{currentPosition.source}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center text-gray-400">
                  No position data
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={isWatching ? stopGPSWatch : startGPSWatch}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
                    isWatching
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isWatching ? (
                    <>
                      <Square className="w-4 h-4" />
                      Stop GPS
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start GPS
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-blue-400" />
                Manual Position
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="Latitude"
                  className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  placeholder="Longitude"
                  className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleSetManualPosition}
                disabled={setManualPosition.isPending}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {setManualPosition.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Set Position"
                )}
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-purple-400" />
                Share Location
              </h2>

              {activeShare ? (
                <div className="space-y-3">
                  <div className="bg-purple-900/30 border border-purple-600 rounded-lg p-3">
                    <p className="text-sm text-purple-300">
                      Sharing with: {activeShare.recipientId}
                    </p>
                    <p className="text-xs text-purple-400">
                      Expires: {new Date(activeShare.expiresAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() => stopShare.mutate(activeShare.token)}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                  >
                    Stop Sharing
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={shareRecipient}
                    onChange={(e) => setShareRecipient(e.target.value)}
                    placeholder="Recipient ID or email"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={shareDuration}
                    onChange={(e) => setShareDuration(parseInt(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={3600}>1 hour</option>
                  </select>
                  <button
                    onClick={handleStartShare}
                    disabled={!shareRecipient.trim() || startShare.isPending}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Start Sharing
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Route className="w-5 h-5 text-green-400" />
                Get Directions
              </h2>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={destLat}
                    onChange={(e) => setDestLat(e.target.value)}
                    placeholder="Dest Latitude"
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={destLon}
                    onChange={(e) => setDestLon(e.target.value)}
                    placeholder="Dest Longitude"
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={travelMode}
                  onChange={(e) =>
                    setTravelMode(
                      e.target.value as "driving" | "walking" | "bicycling"
                    )
                  }
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="driving">Driving</option>
                  <option value="walking">Walking</option>
                  <option value="bicycling">Bicycling</option>
                </select>

                <button
                  onClick={handleGetRoute}
                  disabled={!currentPosition || isRouting}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isRouting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      Get Route
                    </>
                  )}
                </button>
              </div>
            </div>

            {getRoute.data && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Route Details
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-sm">Distance</p>
                    <p className="text-xl font-bold">
                      {getRoute.data.totalDistance}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-sm">Duration</p>
                    <p className="text-xl font-bold">
                      {getRoute.data.totalDuration}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-auto">
                  {getRoute.data.steps?.map((step: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2 bg-gray-800 rounded-lg"
                    >
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{step.instruction}</p>
                        <p className="text-xs text-gray-400">
                          {step.distance} • {step.duration}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
