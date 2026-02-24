/**
 * Route Calculation Utilities
 * Reusable functions for OSRM routing and geocoding
 */

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
