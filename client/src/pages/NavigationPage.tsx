import { useState, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { useNavigation } from "../hooks/useNavigation";
import { CyrusHumanoid } from "../components/CyrusHumanoid";
import {
  MapPin,
  Navigation,
  Share2,
  Crosshair,
  Route,
  Clock,
  Play,
  Square,
  Send,
  Compass,
  Globe,
  Satellite,
  Layers,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  ChevronRight,
} from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "16px",
};

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8e8e93" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1d1d1f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a84ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4f5b62" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#28282a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a3a1a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#28282a" }] },
];

const libraries: ("places" | "geometry" | "drawing")[] = ["places", "geometry"];

export function NavigationPage() {
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLon, setDestLon] = useState("");
  const [shareRecipient, setShareRecipient] = useState("");
  const [shareDuration, setShareDuration] = useState(300);
  const [travelMode, setTravelMode] = useState<"driving" | "walking" | "bicycling">("driving");
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("roadmap");
  const [locationName, setLocationName] = useState<string>("");
  const [showInfoWindow, setShowInfoWindow] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(15);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  });

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

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    if (!isLoaded || !window.google) return;
    
    const geocoder = new google.maps.Geocoder();
    try {
      const response = await geocoder.geocode({ location: { lat, lng: lon } });
      if (response.results[0]) {
        setLocationName(response.results[0].formatted_address);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setLocationName("Unknown location");
    }
  }, [isLoaded]);

  useEffect(() => {
    if (currentPosition && isLoaded) {
      reverseGeocode(currentPosition.lat, currentPosition.lon);
    }
  }, [currentPosition, isLoaded, reverseGeocode]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

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

  const centerOnPosition = () => {
    if (map && currentPosition) {
      map.panTo({ lat: currentPosition.lat, lng: currentPosition.lon });
      map.setZoom(17);
    }
  };

  const handleZoomIn = () => {
    if (map) {
      const newZoom = Math.min((map.getZoom() || 15) + 1, 21);
      map.setZoom(newZoom);
      setZoom(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (map) {
      const newZoom = Math.max((map.getZoom() || 15) - 1, 1);
      map.setZoom(newZoom);
      setZoom(newZoom);
    }
  };

  const defaultCenter = { lat: -24.6282, lng: 25.9231 };

  return (
    <div className="min-h-full h-screen flex flex-col overflow-auto bg-[#000000]">
      {/* Apple-Style Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-[rgba(84,84,88,0.35)] bg-[rgba(28,28,30,0.94)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-[#30d158] to-[#00c853] rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-white">Navigation</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[13px] text-[rgba(235,235,245,0.6)]">Geospatial Intelligence</span>
              {isWatching && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(48,209,88,0.15)] text-[#30d158] text-[10px] font-semibold rounded-full">
                  <span className="w-1.5 h-1.5 bg-[#30d158] rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[rgba(118,118,128,0.24)] rounded-lg p-1">
            {[
              { type: "roadmap" as const, icon: Globe, label: "Map" },
              { type: "satellite" as const, icon: Satellite, label: "Satellite" },
              { type: "hybrid" as const, icon: Layers, label: "Hybrid" },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setMapType(type)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                  mapType === type
                    ? "bg-[#0a84ff] text-white shadow-sm"
                    : "text-[rgba(235,235,245,0.6)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 relative">
          {!apiKey ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c1e]">
              <div className="text-center p-8 max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#ff9f0a] to-[#ff375f] rounded-3xl flex items-center justify-center">
                  <MapPin className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-semibold mb-3">Google Maps API Required</h2>
                <p className="text-[rgba(235,235,245,0.6)] text-sm mb-4">
                  To enable real-time maps and GPS features, please configure your Google Maps API key.
                </p>
                <p className="text-[13px] text-[rgba(235,235,245,0.4)]">
                  Set VITE_GOOGLE_MAPS_API_KEY in your environment variables
                </p>
              </div>
            </div>
          ) : loadError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c1e]">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#ff375f] rounded-2xl flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Map Loading Error</h2>
                <p className="text-[rgba(235,235,245,0.6)] text-sm">Please check your API key configuration</p>
              </div>
            </div>
          ) : !isLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c1e]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-3 border-[#0a84ff] border-t-transparent rounded-full animate-spin" />
                <p className="text-[rgba(235,235,245,0.6)]">Loading maps...</p>
              </div>
            </div>
          ) : (
            <>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={currentPosition ? { lat: currentPosition.lat, lng: currentPosition.lon } : defaultCenter}
                zoom={zoom}
                onLoad={onMapLoad}
                options={{
                  styles: darkMapStyles,
                  mapTypeId: mapType,
                  disableDefaultUI: true,
                  zoomControl: false,
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                }}
              >
                {currentPosition && (
                  <Marker
                    position={{ lat: currentPosition.lat, lng: currentPosition.lon }}
                    onClick={() => setShowInfoWindow(true)}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 12,
                      fillColor: "#0a84ff",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    }}
                  />
                )}
                {currentPosition && showInfoWindow && (
                  <InfoWindow
                    position={{ lat: currentPosition.lat, lng: currentPosition.lon }}
                    onCloseClick={() => setShowInfoWindow(false)}
                  >
                    <div className="p-2 text-black">
                      <p className="font-semibold text-sm">Current Position</p>
                      <p className="text-xs mt-1">{locationName || "Loading..."}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {currentPosition.lat.toFixed(6)}, {currentPosition.lon.toFixed(6)}
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>

              {/* Map Controls - Apple Style */}
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                <div className="bg-[rgba(28,28,30,0.9)] backdrop-blur-xl rounded-xl overflow-hidden shadow-lg border border-[rgba(84,84,88,0.35)]">
                  <button
                    onClick={handleZoomIn}
                    className="w-10 h-10 flex items-center justify-center text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <div className="h-px bg-[rgba(84,84,88,0.35)]" />
                  <button
                    onClick={handleZoomOut}
                    className="w-10 h-10 flex items-center justify-center text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={centerOnPosition}
                  disabled={!currentPosition}
                  className="w-10 h-10 bg-[rgba(28,28,30,0.9)] backdrop-blur-xl rounded-xl flex items-center justify-center text-[#0a84ff] hover:bg-[rgba(255,255,255,0.1)] transition-colors disabled:opacity-30 shadow-lg border border-[rgba(84,84,88,0.35)]"
                >
                  <LocateFixed className="w-5 h-5" />
                </button>
              </div>

              {/* Location Card - Apple Style */}
              {currentPosition && (
                <div className="absolute left-4 bottom-4 right-4 md:right-auto md:max-w-sm">
                  <div className="bg-[rgba(28,28,30,0.95)] backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-[rgba(84,84,88,0.35)]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] rounded-xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-white truncate">
                          {locationName || "Getting location..."}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <div>
                            <p className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase tracking-wider">Latitude</p>
                            <p className="text-[13px] font-mono text-[#30d158]">{currentPosition.lat.toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase tracking-wider">Longitude</p>
                            <p className="text-[13px] font-mono text-[#0a84ff]">{currentPosition.lon.toFixed(6)}</p>
                          </div>
                          {currentPosition.accuracy && (
                            <div>
                              <p className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase tracking-wider">Accuracy</p>
                              <p className="text-[13px] font-mono text-[#ff9f0a]">{currentPosition.accuracy.toFixed(0)}m</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Panel - Apple Style */}
        <div className="w-80 border-l border-[rgba(84,84,88,0.35)] bg-[rgba(28,28,30,0.6)] backdrop-blur-xl overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* GPS Control */}
            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-[rgba(84,84,88,0.35)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-[#30d158]" />
                  <span className="text-[13px] font-semibold">GPS Tracking</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${isWatching ? "bg-[#30d158] animate-pulse" : "bg-[#48484a]"}`} />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => isWatching ? stopGPSWatch() : startGPSWatch()}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                    isWatching
                      ? "bg-[#ff375f] text-white"
                      : "bg-[#30d158] text-white"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {isWatching ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isWatching ? "Stop Tracking" : "Start Tracking"}
                  </div>
                </button>
              </div>
            </div>

            {/* Manual Position */}
            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-[rgba(84,84,88,0.35)]">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="w-4 h-4 text-[#0a84ff]" />
                <span className="text-[13px] font-semibold">Manual Position</span>
              </div>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Latitude"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#2c2c2e] rounded-xl text-[13px] placeholder-[rgba(235,235,245,0.3)] border border-[rgba(84,84,88,0.35)] focus:border-[#0a84ff] focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#2c2c2e] rounded-xl text-[13px] placeholder-[rgba(235,235,245,0.3)] border border-[rgba(84,84,88,0.35)] focus:border-[#0a84ff] focus:outline-none transition-colors"
                />
                <button
                  onClick={handleSetManualPosition}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#0a84ff] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0070d4] transition-colors disabled:opacity-50"
                >
                  Set Position
                </button>
              </div>
            </div>

            {/* Route Planning */}
            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-[rgba(84,84,88,0.35)]">
              <div className="flex items-center gap-2 mb-4">
                <Route className="w-4 h-4 text-[#ff9f0a]" />
                <span className="text-[13px] font-semibold">Route Planning</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["driving", "walking", "bicycling"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTravelMode(mode)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${
                        travelMode === mode
                          ? "bg-[#ff9f0a] text-black"
                          : "bg-[#2c2c2e] text-[rgba(235,235,245,0.6)] hover:text-white"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Destination Latitude"
                  value={destLat}
                  onChange={(e) => setDestLat(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#2c2c2e] rounded-xl text-[13px] placeholder-[rgba(235,235,245,0.3)] border border-[rgba(84,84,88,0.35)] focus:border-[#ff9f0a] focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  placeholder="Destination Longitude"
                  value={destLon}
                  onChange={(e) => setDestLon(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#2c2c2e] rounded-xl text-[13px] placeholder-[rgba(235,235,245,0.3)] border border-[rgba(84,84,88,0.35)] focus:border-[#ff9f0a] focus:outline-none transition-colors"
                />
                <button
                  onClick={handleGetRoute}
                  disabled={!currentPosition || isRouting}
                  className="w-full py-2.5 bg-[#ff9f0a] text-black rounded-xl text-[13px] font-semibold hover:bg-[#e08f00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRouting ? "Calculating..." : "Get Route"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Location Sharing */}
            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-[rgba(84,84,88,0.35)]">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="w-4 h-4 text-[#bf5af2]" />
                <span className="text-[13px] font-semibold">Live Sharing</span>
              </div>
              
              {activeShare ? (
                <div className="space-y-3">
                  <div className="bg-[#2c2c2e] rounded-xl p-3">
                    <p className="text-[11px] text-[rgba(235,235,245,0.4)] mb-1">Sharing with</p>
                    <p className="text-[13px] font-medium">{activeShare.recipientId}</p>
                    <div className="flex items-center gap-1 mt-2 text-[#bf5af2]">
                      <Clock className="w-3 h-3" />
                      <span className="text-[11px]">
                        Share active
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => stopShare.mutate(activeShare.token)}
                    className="w-full py-2.5 bg-[#ff375f] text-white rounded-xl text-[13px] font-semibold hover:bg-[#e0304f] transition-colors"
                  >
                    Stop Sharing
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Recipient ID or Email"
                    value={shareRecipient}
                    onChange={(e) => setShareRecipient(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#2c2c2e] rounded-xl text-[13px] placeholder-[rgba(235,235,245,0.3)] border border-[rgba(84,84,88,0.35)] focus:border-[#bf5af2] focus:outline-none transition-colors"
                  />
                  <select
                    value={shareDuration}
                    onChange={(e) => setShareDuration(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-[#2c2c2e] rounded-xl text-[13px] border border-[rgba(84,84,88,0.35)] focus:border-[#bf5af2] focus:outline-none transition-colors"
                  >
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={3600}>1 hour</option>
                  </select>
                  <button
                    onClick={handleStartShare}
                    disabled={!shareRecipient.trim()}
                    className="w-full py-2.5 bg-[#bf5af2] text-white rounded-xl text-[13px] font-semibold hover:bg-[#a94de0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Start Sharing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CyrusHumanoid
        module="navigation"
        context={`User is in navigation module. ${currentPosition ? `Current position: ${currentPosition.lat.toFixed(6)}, ${currentPosition.lon.toFixed(6)}. Location: ${locationName}` : "No position data"}. GPS tracking: ${isWatching ? "active" : "inactive"}.`}
        compact={true}
      />
    </div>
  );
}
