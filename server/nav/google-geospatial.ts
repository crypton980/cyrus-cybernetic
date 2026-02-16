import fetch from "node-fetch";
import { ElevationResult, GeocodingResult, PlaceResult } from "./types";

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY not configured");
  return key;
}

export async function geocodeForward(address: string): Promise<GeocodingResult[]> {
  const apiKey = getApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Geocoding API failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Geocoding error: ${data.status} - ${data.error_message || ""}`);
  }

  return (data.results || []).map((r: any) => {
    const components: Record<string, string> = {};
    for (const comp of r.address_components || []) {
      for (const type of comp.types) {
        components[type] = comp.long_name;
      }
    }
    return {
      formattedAddress: r.formatted_address,
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng,
      placeId: r.place_id,
      types: r.types || [],
      components,
    };
  });
}

export async function geocodeReverse(lat: number, lon: number): Promise<GeocodingResult[]> {
  const apiKey = getApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Reverse geocoding failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Reverse geocoding error: ${data.status} - ${data.error_message || ""}`);
  }

  return (data.results || []).map((r: any) => {
    const components: Record<string, string> = {};
    for (const comp of r.address_components || []) {
      for (const type of comp.types) {
        components[type] = comp.long_name;
      }
    }
    return {
      formattedAddress: r.formatted_address,
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng,
      placeId: r.place_id,
      types: r.types || [],
      components,
    };
  });
}

export async function getElevation(locations: Array<{ lat: number; lon: number }>): Promise<ElevationResult[]> {
  const apiKey = getApiKey();
  const locStr = locations.map(l => `${l.lat},${l.lon}`).join("|");
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locStr)}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Elevation API failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK") {
    throw new Error(`Elevation error: ${data.status} - ${data.error_message || ""}`);
  }

  return (data.results || []).map((r: any) => ({
    lat: r.location.lat,
    lon: r.location.lng,
    elevation: r.elevation,
    resolution: r.resolution,
  }));
}

export async function getElevationAlongPath(
  path: Array<{ lat: number; lon: number }>,
  samples: number = 100
): Promise<ElevationResult[]> {
  const apiKey = getApiKey();
  const pathStr = path.map(p => `${p.lat},${p.lon}`).join("|");
  const url = `https://maps.googleapis.com/maps/api/elevation/json?path=${encodeURIComponent(pathStr)}&samples=${samples}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Elevation path API failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK") {
    throw new Error(`Elevation path error: ${data.status} - ${data.error_message || ""}`);
  }

  return (data.results || []).map((r: any) => ({
    lat: r.location.lat,
    lon: r.location.lng,
    elevation: r.elevation,
    resolution: r.resolution,
  }));
}

export async function searchNearbyPlaces(
  lat: number, lon: number,
  radiusMeters: number = 1000,
  type?: string,
  keyword?: string
): Promise<PlaceResult[]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams();
  params.set("location", `${lat},${lon}`);
  params.set("radius", String(Math.min(radiusMeters, 50000)));
  params.set("key", apiKey);
  if (type) params.set("type", type);
  if (keyword) params.set("keyword", keyword);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Places API failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Places error: ${data.status} - ${data.error_message || ""}`);
  }

  return (data.results || []).map((r: any) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.vicinity || "",
    lat: r.geometry.location.lat,
    lon: r.geometry.location.lng,
    types: r.types || [],
    rating: r.rating,
    userRatingsTotal: r.user_ratings_total,
    openNow: r.opening_hours?.open_now,
  }));
}

export async function searchPlacesByText(query: string): Promise<PlaceResult[]> {
  const apiKey = getApiKey();
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Text search failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Text search error: ${data.status} - ${data.error_message || ""}`);
  }

  return (data.results || []).map((r: any) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address || "",
    lat: r.geometry.location.lat,
    lon: r.geometry.location.lng,
    types: r.types || [],
    rating: r.rating,
    userRatingsTotal: r.user_ratings_total,
    openNow: r.opening_hours?.open_now,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<any> {
  const apiKey = getApiKey();
  const fields = "name,formatted_address,geometry,formatted_phone_number,website,opening_hours,rating,reviews,photos,types,url";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Place details failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK") {
    throw new Error(`Place details error: ${data.status} - ${data.error_message || ""}`);
  }

  const r = data.result;
  return {
    placeId,
    name: r.name,
    address: r.formatted_address,
    lat: r.geometry?.location?.lat,
    lon: r.geometry?.location?.lng,
    phone: r.formatted_phone_number,
    website: r.website,
    url: r.url,
    rating: r.rating,
    types: r.types || [],
    openingHours: r.opening_hours?.weekday_text || [],
    openNow: r.opening_hours?.open_now,
    reviews: (r.reviews || []).slice(0, 5).map((rev: any) => ({
      author: rev.author_name,
      rating: rev.rating,
      text: rev.text,
      time: rev.relative_time_description,
    })),
  };
}
