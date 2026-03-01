/**
 * Route Calculation Utilities
 * Reusable functions for OSRM routing and geocoding
 */

/**
 * Calculate real road distance between two lat/lng points using the public OSRM API.
 * Falls back to Haversine (straight-line) if OSRM is unavailable.
 *
 * OSRM public endpoint: https://router.project-osrm.org
 * @param {number} lat1 - Origin latitude
 * @param {number} lng1 - Origin longitude
 * @param {number} lat2 - Destination latitude
 * @param {number} lng2 - Destination longitude
 * @returns {Promise<number>} Distance in km
 */
export async function getOSRMDistance(lat1, lng1, lat2, lng2) {
    try {
        // OSRM public demo server — car profile
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) }); // 5s timeout
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const distanceKm = data.routes[0].distance / 1000; // metres → km
            console.log(`🗺️ OSRM road distance: ${distanceKm.toFixed(2)} km`);
            return distanceKm;
        }
    } catch (err) {
        console.warn('⚠️ OSRM unavailable, falling back to Haversine:', err.message);
    }

    // Fallback: Haversine straight-line distance
    return haversineKm(lat1, lng1, lat2, lng2);
}

/** Haversine straight-line distance in km */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- Pincode Geocoding (cached) ----
const _pincodeCache = new Map();

/**
 * Geocode an Indian pincode to lat/lng using Nominatim.
 * Results are cached so each pincode is looked up only once per session.
 *
 * @param {string|number} pincode - 6-digit Indian pincode
 * @returns {Promise<{lat: number, lng: number}|null>} Coordinates or null
 */
export async function geocodePincode(pincode) {
    const pin = String(pincode).trim();
    if (!pin || pin.length < 5) return null;

    // Return cached result if available
    if (_pincodeCache.has(pin)) {
        console.log(`📌 [Cache] Pincode ${pin}:`, _pincodeCache.get(pin));
        return _pincodeCache.get(pin);
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${pin}&country=India&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            _pincodeCache.set(pin, result);
            console.log(`📌 [Nominatim] Pincode ${pin} → ${result.lat}, ${result.lng}`);
            return result;
        }
    } catch (err) {
        console.warn(`⚠️ Nominatim pincode lookup failed for ${pin}:`, err.message);
    }

    // Cache the miss too so we don't retry
    _pincodeCache.set(pin, null);
    return null;
}

/**
 * Geocode an address to coordinates using Nominatim
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lon: number}|null>} Coordinates or null if not found
 */
export async function getCoordinates(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return (data && data.length > 0) ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    } catch (e) {
        console.error('Geocoding error:', e);
        return null;
    }
}

/**
 * Calculate route between two points using OSRM
 * @param {Object} start - Start coordinates {lat, lon}
 * @param {Object} end - End coordinates {lat, lon}
 * @param {string} mode - Transport mode: 'car', 'bike', or 'foot'
 * @returns {Promise<{distance: number, duration: number, geometry: Object}|null>} Route data or null
 */
export async function calculateRoute(start, end, mode = 'car') {
    const serviceUrl = `https://routing.openstreetmap.de/routed-${mode}/route/v1`;
    const url = `${serviceUrl}/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distance: route.distance, // in meters
                duration: route.duration, // in seconds
                geometry: route.geometry
            };
        }
        return null;
    } catch (e) {
        console.error('Routing error:', e);
        return null;
    }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - First coordinate {lat, lon}
 * @param {Object} coord2 - Second coordinate {lat, lon}
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLon = toRad(coord2.lon - coord1.lon);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Format travel time from seconds to human-readable string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2 hr 30 min")
 */
export function formatTravelTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    let result = "";
    if (hours > 0) result += hours + " hr ";
    if (minutes > 0 || hours === 0) result += minutes + " min";

    return result.trim() || "< 1 min";
}

/**
 * Get color for transport mode
 * @param {string} mode - Transport mode: 'car', 'bike', or 'foot'
 * @returns {string} Hex color code
 */
export function getRouteColor(mode) {
    const colors = {
        car: '#007bff',   // Blue
        bike: '#28a745',  // Green
        foot: '#fd7e14'   // Orange
    };
    return colors[mode] || colors.car;
}

/**
 * Get icon emoji for transport mode
 * @param {string} mode - Transport mode: 'car', 'bike', or 'foot'
 * @returns {string} Emoji icon
 */
export function getModeIcon(mode) {
    const icons = {
        car: '🚗',
        bike: '🚲',
        foot: '🚶'
    };
    return icons[mode] || icons.car;
}

/**
 * Get display name for transport mode
 * @param {string} mode - Transport mode: 'car', 'bike', or 'foot'
 * @returns {string} Display name
 */
export function getModeDisplayName(mode) {
    const names = {
        car: 'Driving',
        bike: 'Cycling',
        foot: 'Walking'
    };
    return names[mode] || 'Driving';
}

/**
 * Validate if distance is within limit
 * @param {number} distance - Distance in kilometers
 * @param {number} limit - Maximum allowed distance in kilometers
 * @returns {boolean} True if within limit
 */
export function validateDistance(distance, limit) {
    return distance <= limit;
}

/**
 * Calculate estimated travel times for all transport modes
 * @param {Object} start - Start coordinates {lat, lon}
 * @param {Object} end - End coordinates {lat, lon}
 * @returns {Promise<Object>} Object with times for each mode
 */
export async function calculateAllModeTimes(start, end) {
    const modes = ['car', 'bike', 'foot'];
    const results = {};

    for (const mode of modes) {
        const route = await calculateRoute(start, end, mode);
        if (route) {
            results[mode] = {
                distance: (route.distance / 1000).toFixed(2), // Convert to km
                duration: route.duration,
                formattedTime: formatTravelTime(route.duration)
            };
        } else {
            results[mode] = null;
        }
    }

    return results;
}
