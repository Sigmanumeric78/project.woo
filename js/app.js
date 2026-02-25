import { currentUser, mockGroups } from './mock-data-v2.js?v=2';
import { calculateAllModeTimes, formatTravelTime, calculateRoute } from './route-utils.js';
import { initDashboardFilters } from './dashboard-integration.js?v=10';

/**
 * Main Application Logic
 * Handles Dashboard rendering and interactions
 */

console.log('ECA-Connect App Initialized');

document.addEventListener('DOMContentLoaded', async () => {

    // 1. Dashboard Initialization
    if (window.location.pathname.includes('dashboard.html')) {
        console.log('🚀 Starting dashboard initialization...');
        // Initialize new filter-based dashboard
        await initDashboardFilters();
        console.log('✅ Dashboard ready!');
    }

    // 2. Group Details Initialization
    if (window.location.pathname.includes('group-details.html')) {
        initGroupDetails();
    }

});

// --- Dashboard Logic ---

function initDashboard() {
    console.log('Initializing Dashboard...');

    // Render Header Info
    const greetingEl = document.querySelector('header h2');
    if (greetingEl) greetingEl.textContent = `Hello, ${currentUser.name}!`;

    // Render Availability Context
    renderAvailabilityStatus();

    // Render Groups
    renderGroups(mockGroups);

    // --- Modal Logic ---
    const modal = document.getElementById('availability-modal');
    const trigger = document.getElementById('availability-trigger');
    const chips = document.querySelectorAll('.avail-chip');
    const saveBtn = modal.querySelector('.btn-primary'); // The save button inside modal

    // Open Modal
    if (trigger && modal) {
        trigger.onclick = () => {
            modal.style.display = 'flex'; // Use flex to center with existing styles
        };
    }

    // Chip Selection Logic
    chips.forEach(chip => {
        chip.onclick = () => {
            // Remove active from all
            chips.forEach(c => c.classList.remove('active'));
            // Add to clicked
            chip.classList.add('active');
        };
    });

    // Save Changes Logic
    if (saveBtn) {
        saveBtn.onclick = () => {
            // 1. Get selected chip text
            const activeChip = document.querySelector('.avail-chip.active');
            const timeText = activeChip ? activeChip.textContent : 'Custom Time';

            // 2. Update Dashboard Header Status
            const statusText = document.querySelector('header p.text-muted');
            if (statusText) {
                // Simulate updating based on selection
                statusText.innerHTML = `You are free <strong>${timeText}</strong>`;
            }

            // 3. Simulate "Re-fetching" matches (just shuffle/sort differently for effect)
            // In a real app, this would fetch new data
            const shuffled = [...mockGroups].sort(() => 0.5 - Math.random());
            renderGroups(shuffled);

            // 4. Close Modal & Notify
            modal.style.display = 'none';
            showToast('Availability updated! Finding new matches...');
        };
    }
}

// Simple Toast Helper (needs stylesheet support)
function showToast(message) {
    // Create toast element on the fly if component exists in CSS
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `<span>✅</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderAvailabilityStatus() {
    // In a real app, we'd format this from currentUser.availability
    // For now, static as per mockup, but we could update the text dynamically
    const avail = currentUser.availability[0];
    const statusText = document.querySelector('header p.text-muted');
    if (statusText && avail) {
        statusText.innerHTML = `You are free <strong>${avail.day}, ${formatTime(avail.start)} - ${formatTime(avail.end)}</strong>`;
    }
}

function renderGroups(groups) {
    const container = document.getElementById('discovery-feed');
    if (!container) return;

    // Clear existing static content if we find the grid container
    // Note: The HTML has a header <h3> inside the section, we want to append to the grid div.
    // Let's find the grid div specifically.
    let grid = container.querySelector('div[style*="display: grid"]');

    // If we can't find it easily by selector, let's just clear the container and rebuild the structure 
    // or better, let's assume the static HTML structure is there and we clear the children of the grid.
    if (!grid) {
        // Create grid if missing
        grid = document.createElement('div');
        grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-24);";
        container.appendChild(grid);
    } else {
        grid.innerHTML = ''; // Clear static cards
    }

    // Sort groups: High match first
    const sortedGroups = [...groups].sort((a, b) => b.matchScore - a.matchScore);

    sortedGroups.forEach(group => {
        const card = createGroupCard(group);
        grid.appendChild(card);
    });
}

function createGroupCard(group) {
    // Determine Match Badge Color & Meter Width
    let matchColor = 'var(--match-low)';
    let meterClass = ''; // Default gray
    if (group.matchScore >= 90) {
        matchColor = 'var(--match-perfect)';
        meterClass = 'meter-perfect';
    } else if (group.matchScore >= 70) {
        matchColor = 'var(--match-near)';
    }

    const article = document.createElement('article');
    article.className = 'card';
    article.style.cursor = 'pointer';
    article.style.transition = 'transform 0.2s';

    // Helper for interactions
    article.onclick = () => window.location.href = `group-details.html?id=${group.id}`;
    article.onmouseover = () => article.style.transform = "translateY(-4px)";
    article.onmouseout = () => article.style.transform = "translateY(0)";

    article.innerHTML = `
        <div style="height: 140px; background-color: ${group.imageColor}; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.8); font-size: 48px;">
            ${group.name[0]}
        </div> 
        <div style="padding: var(--space-16);">
            
            <!-- Title & Desc -->
            <h4 style="margin-bottom: var(--space-4);">${group.name}</h4>
            <p class="text-muted" style="font-size: var(--text-sm); margin-bottom: var(--space-16); height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                ${group.description}
            </p>
            
            <!-- Compatibility Meter -->
            <div style="margin-bottom: var(--space-16);">
                <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); margin-bottom: 4px; color: var(--text-muted);">
                    <span>Compatibility</span>
                    <span>${group.matchScore}%</span>
                </div>
                <div class="compatibility-meter ${meterClass}">
                    <div class="meter-fill" style="width: ${group.matchScore}%; background: ${matchColor};"></div>
                </div>
            </div>

            <!-- Footer Info with Dynamic Data -->
            <div style="padding-top: var(--space-16); border-top: 1px solid var(--surface-100); display: flex; flex-direction: column; gap: var(--space-8); font-size: var(--text-xs);">
                <div style="display: flex; align-items: center; gap: 4px; color: var(--text-muted);">
                    <span>📅</span> ${group.nextSession}
                </div>
                <div style="display: flex; align-items: center; gap: 4px; position: relative;" class="location-row" data-group-id="${group.id}">
                    <span>📍</span> 
                    <span class="card-location" style="color: var(--base-white); cursor: help;" title="${group.locationName || 'Loading...'}">
                        <span class="card-distance" data-group-id="${group.id}">Calculating...</span> away
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; color: var(--text-muted);">
                    <span>🚗</span> 
                    <span class="card-time" data-group-id="${group.id}">Calculating...</span>
                    <span style="font-size: 10px; opacity: 0.7;">(estimated)</span>
                </div>
                <a href="#" class="google-maps-link" data-group-id="${group.id}" style="display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--primary-500); text-decoration: none; margin-top: 4px; transition: color 0.2s;" onclick="event.stopPropagation();">
                    <span>🗺️</span> Open in Google Maps
                </a>
            </div>
        </div>
    `;

    // Calculate distance and time asynchronously
    calculateCardDistanceAndTime(group, article);

    return article;
}

// Calculate and update distance and time for a card
async function calculateCardDistanceAndTime(group, cardElement) {
    try {
        const userLocation = { lat: currentUser.location.lat, lon: currentUser.location.lng };
        const groupLocation = { lat: group.location.lat, lon: group.location.lng };

        // Calculate route using car mode (default)
        const route = await calculateRoute(userLocation, groupLocation, 'car');

        if (route) {
            const distanceKm = (route.distance / 1000).toFixed(1);
            const timeFormatted = formatTravelTime(route.duration);

            // Update the card's distance and time displays
            const distanceSpan = cardElement.querySelector(`.card-distance[data-group-id="${group.id}"]`);
            const timeSpan = cardElement.querySelector(`.card-time[data-group-id="${group.id}"]`);
            const locationSpan = cardElement.querySelector(`.card-location`);
            const mapsLink = cardElement.querySelector(`.google-maps-link[data-group-id="${group.id}"]`);

            if (distanceSpan) {
                distanceSpan.textContent = `${distanceKm} km`;
            }
            if (timeSpan) {
                timeSpan.textContent = timeFormatted;
            }
            if (locationSpan && group.locationName) {
                locationSpan.title = group.locationName;
            }
            if (mapsLink) {
                mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${group.location.lat},${group.location.lng}`;
                mapsLink.target = '_blank';
            }
        } else {
            // Fallback to straight-line distance if routing fails
            const distanceSpan = cardElement.querySelector(`.card-distance[data-group-id="${group.id}"]`);
            const timeSpan = cardElement.querySelector(`.card-time[data-group-id="${group.id}"]`);
            const mapsLink = cardElement.querySelector(`.google-maps-link[data-group-id="${group.id}"]`);

            if (distanceSpan) {
                distanceSpan.textContent = `${group.distance} km`;
            }
            if (timeSpan) {
                timeSpan.textContent = 'N/A';
            }
            if (mapsLink) {
                mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${group.location.lat},${group.location.lng}`;
                mapsLink.target = '_blank';
            }
        }
    } catch (error) {
        console.error('Error calculating distance/time for group:', group.id, error);
        // Use fallback data
        const distanceSpan = cardElement.querySelector(`.card-distance[data-group-id="${group.id}"]`);
        const timeSpan = cardElement.querySelector(`.card-time[data-group-id="${group.id}"]`);
        const mapsLink = cardElement.querySelector(`.google-maps-link[data-group-id="${group.id}"]`);

        if (distanceSpan) {
            distanceSpan.textContent = `${group.distance} km`;
        }
        if (timeSpan) {
            timeSpan.textContent = 'N/A';
        }
        if (mapsLink) {
            mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${group.location.lat},${group.location.lng}`;
            mapsLink.target = '_blank';
        }
    }
}

// --- Group Details Logic ---

function initGroupDetails() {
    console.log('Initializing Group Details...');
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');

    if (!groupId) {
        alert('Group not found!');
        window.location.href = 'dashboard.html';
        return;
    }

    const group = mockGroups.find(g => g.id === groupId);
    if (!group) {
        alert('Group not found!');
        window.location.href = 'dashboard.html';
        return;
    }

    // Populate Data
    document.title = `${group.name} | SocialSpaces`;

    // Hero
    const hero = document.getElementById('gd-hero-color');
    if (hero) {
        hero.style.backgroundColor = group.imageColor;
        hero.textContent = group.name[0];
    }


    // Compatibility Meter
    setText('gd-match-val', `${group.matchScore}%`);
    const meterFill = document.getElementById('gd-meter-fill');
    const meterContainer = document.getElementById('gd-meter-container');
    if (meterFill && meterContainer) {
        meterFill.style.width = `${group.matchScore}%`;
        meterFill.style.background = group.matchScore >= 90 ? 'var(--match-perfect)' : (group.matchScore >= 70 ? 'var(--match-near)' : 'var(--match-low)');
        if (group.matchScore >= 90) meterContainer.classList.add('meter-perfect');
    }

    // Text Content
    setText('gd-title', group.name);
    setText('gd-desc', group.description);
    setText('gd-schedule', `${group.day}s ${formatTime(group.startTime)} - ${formatTime(group.endTime)}`);
    setText('gd-next-session', group.nextSession);
    setText('gd-member-count', group.members);
    setText('gd-distance', group.distance);
    setText('gd-location-name', group.locationName || 'Event Location');

    // Calculate and display travel times
    calculateTravelTimes(group);

    // Join Button Interaction
    const joinBtn = document.getElementById('gd-join-btn');
    if (joinBtn) {
        joinBtn.onclick = () => {
            alert(`You have joined ${group.name}!`);
            joinBtn.textContent = 'Joined';
            joinBtn.disabled = true;
            joinBtn.classList.replace('btn-primary', 'btn-ghost');
        }
    }

    // Get Directions Button
    const directionsBtn = document.getElementById('gd-directions-btn');
    if (directionsBtn) {
        directionsBtn.onclick = () => {
            // Open Google Maps with directions from user location to group location
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${group.location.lat},${group.location.lng}`;
            window.open(mapsUrl, '_blank');
        };
    }
}

// Calculate and display travel times for all modes
async function calculateTravelTimes(group) {
    const travelTimesContainer = document.getElementById('gd-travel-times');
    if (!travelTimesContainer) return;

    try {
        // Show loading state
        travelTimesContainer.style.display = 'block';
        setText('gd-time-car', 'Calculating...');
        setText('gd-time-bike', 'Calculating...');
        setText('gd-time-foot', 'Calculating...');

        // Calculate times for all modes
        const userLocation = { lat: currentUser.location.lat, lon: currentUser.location.lng };
        const groupLocation = { lat: group.location.lat, lon: group.location.lng };

        const times = await calculateAllModeTimes(userLocation, groupLocation);

        // Update UI with results
        if (times.car) {
            setText('gd-time-car', times.car.formattedTime);
        } else {
            setText('gd-time-car', 'N/A');
        }

        if (times.bike) {
            setText('gd-time-bike', times.bike.formattedTime);
        } else {
            setText('gd-time-bike', 'N/A');
        }

        if (times.foot) {
            setText('gd-time-foot', times.foot.formattedTime);
        } else {
            setText('gd-time-foot', 'N/A');
        }
    } catch (error) {
        console.error('Error calculating travel times:', error);
        setText('gd-time-car', 'Error');
        setText('gd-time-bike', 'Error');
        setText('gd-time-foot', 'Error');
    }
}

// Helper to set text safely
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Helper: Format 24h time to 12h AM/PM
function formatTime(timeStr) {
    const [hour, min] = timeStr.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${min} ${ampm}`;
}
