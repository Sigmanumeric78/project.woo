/**
 * Dashboard Integration - Firestore Version
 */

import { groupService } from './group-service.js';
import { auth } from './firebase-config.js';
import { profileService } from './profile-service.js';
import { rankGroups, DEFAULT_WEIGHTS } from './ranking-engine-fixed.js';
import { getOSRMDistance, geocodePincode } from './route-utils.js';

console.log('📦 Dashboard integration module loaded');

let currentUser = null;
let allGroups = [];

/**
 * Transform user profile to match ranking engine expectations.
 * Resolves lat/lng from:
 *   1. GPS coords captured during signup (profile.location.latitude / longitude)
 *   2. Pincode lookup from indian_pincode_data.js
 *   3. Falls back to Delhi if nothing else works
 */
function transformUserProfile(profile) {
    const transformed = { ...profile };

    // ---- 1. Resolve user coordinates ----
    let lat = null;
    let lng = null;

    // Priority A: real GPS coords from profile setup geolocation
    if (profile.location?.latitude && profile.location?.longitude) {
        lat = parseFloat(profile.location.latitude);
        lng = parseFloat(profile.location.longitude);
        console.log('📍 User coords from GPS:', lat, lng);
    }
    // Priority B: already stored as lat/lng (some older profiles)
    else if (profile.location?.lat && profile.location?.lng) {
        lat = parseFloat(profile.location.lat);
        lng = parseFloat(profile.location.lng);
        console.log('📍 User coords from stored lat/lng:', lat, lng);
    }
    // Priority C: derive from pincode
    else if (profile.location?.pinCode) {
        const coords = getCoordinatesFromPincode(profile.location.pinCode);
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
            console.log('📍 User coords from pincode', profile.location.pinCode, ':', lat, lng);
        }
    }

    // Apply resolved coordinates
    if (lat && lng) {
        transformed.location = {
            ...profile.location,
            lat,
            lng,
            latitude: lat,
            longitude: lng
        };
    } else {
        // No coords at all — radius filtering will be skipped gracefully
        console.warn('⚠️ Could not resolve user location coordinates. Distance filtering will be skipped.');
        transformed.location = { ...profile.location, lat: null, lng: null };
    }

    // ---- 2. Transform availability format ----
    if (profile.availability && profile.availability.length > 0) {
        transformed.availability = profile.availability.map(avail => {
            if (avail.startTime && avail.endTime) return avail;

            const dayMap = {
                'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday',
                'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday'
            };
            const slotTimes = {
                'Morning': { start: '06:00', end: '12:00' },
                'Afternoon': { start: '12:00', end: '17:00' },
                'Evening': { start: '17:00', end: '21:00' },
                'Night': { start: '21:00', end: '23:59' }
            };
            const fullDay = dayMap[avail.day] || avail.day;
            const slot = avail.slots?.[0] || 'Evening';
            const times = slotTimes[slot] || slotTimes['Evening'];
            return { day: fullDay, startTime: times.start, endTime: times.end };
        });
    }

    // ---- 3. Extract radius from preferences ----
    if (profile.preferences?.radius) {
        transformed.radius = Number(profile.preferences.radius);
        console.log('📍 User saved radius:', transformed.radius, 'km');
    }

    return transformed;
}

/**
 * Build coordinate lookup from the globally loaded indian_pincode_data.js.
 * The file exposes `window.PINCODE_DATA` as an object keyed by pincode string.
 * Each entry has { district, state, lat, lng } (or similar).
 */
function getCoordinatesFromPincode(pincode) {
    if (!pincode) return null;

    // indian_pincode_data.js exposes window.PINCODE_DATA
    if (window.PINCODE_DATA) {
        const entry = window.PINCODE_DATA[String(pincode)];
        if (entry && entry.lat && entry.lng) {
            return { lat: parseFloat(entry.lat), lng: parseFloat(entry.lng) };
        }
        if (entry && entry.Latitude && entry.Longitude) {
            return { lat: parseFloat(entry.Latitude), lng: parseFloat(entry.Longitude) };
        }
    }

    // Fallback hardcoded table for the most common Indian cities/pincodes
    const fallback = {
        '281004': { lat: 27.4924, lng: 77.6737 }, // Mathura
        '110001': { lat: 28.6139, lng: 77.2090 }, // Delhi
        '400001': { lat: 18.9388, lng: 72.8354 }, // Mumbai
        '560001': { lat: 12.9716, lng: 77.5946 }, // Bangalore
        '600001': { lat: 13.0827, lng: 80.2707 }, // Chennai
        '700001': { lat: 22.5726, lng: 88.3639 }, // Kolkata
        '500001': { lat: 17.3850, lng: 78.4867 }, // Hyderabad
        '411001': { lat: 18.5204, lng: 73.8567 }, // Pune
        '380001': { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
        '302001': { lat: 26.9124, lng: 75.7873 }, // Jaipur
        '226001': { lat: 26.8467, lng: 80.9462 }, // Lucknow
        '208001': { lat: 26.4499, lng: 80.3319 }, // Kanpur
        '282001': { lat: 27.1767, lng: 78.0081 }  // Agra
    };
    return fallback[String(pincode)] || null;
}

export async function initDashboardFilters() {
    console.log('🎯 === STARTING DASHBOARD INITIALIZATION ===');

    try {
        // Wait for authentication
        const user = await new Promise((resolve) => {
            auth.onAuthStateChanged((user) => {
                if (user) resolve(user);
                else window.location.href = 'login.html';
            });
        });

        console.log('✅ User authenticated:', user.email);

        // Load user profile
        currentUser = await profileService.getUserProfile(user.uid);
        console.log('✅ User profile loaded (raw):', JSON.stringify(currentUser, null, 2));

        // Transform profile for ranking engine compatibility
        currentUser = transformUserProfile(currentUser);
        console.log('✅ User profile transformed. Location:', currentUser.location, 'Radius:', currentUser.radius, 'km');

        // ---- Set radius slider to user's saved radius ----
        const savedRadius = currentUser.radius || 10;
        const radiusInput = document.getElementById('filter-radius');
        const radiusDisplay = document.getElementById('radius-display');
        if (radiusInput) {
            radiusInput.value = savedRadius;
            if (radiusDisplay) radiusDisplay.textContent = `${savedRadius} km`;
            console.log('✅ Radius slider initialised to', savedRadius, 'km from user profile');
        }

        // Load all groups from Firestore
        allGroups = await groupService.queryGroups([]);
        console.log('✅ Groups loaded from Firestore:', allGroups.length);
        if (allGroups.length > 0) {
            console.log('📋 First group sample:', JSON.stringify(allGroups[0], null, 2));
        } else {
            console.warn('⚠️ No groups found in Firestore!');
        }

        // 1. Initial Render (No filters)
        await updateDashboard();

        // 2. Bind Event Listeners
        bindFilterEvents();

        // 3. Populate Interest Tags (Dynamic from Firestore Data)
        populateInterestTags();

        console.log('✅ === DASHBOARD INITIALIZATION COMPLETE ===');

    } catch (error) {
        console.error('❌ === ERROR IN DASHBOARD INITIALIZATION ===');
        console.error(error);
        showErrorState(error);
    }
}

/**
 * Transform Firestore groups to ranking engine format.
 * Pincode-based distance: geocode user pincode + group pincode via Nominatim,
 * then compute OSRM road distance. Groups without a pincode get Infinity (excluded).
 *
 * @param {Array} firestoreGroups - Groups from Firestore
 * @returns {Promise<Array>} Transformed groups with calculatedDistance filled in
 */
async function transformGroupsForRanking(firestoreGroups) {
    // ---- 1. Geocode user's pincode ONCE ----
    const userPincode = currentUser?.location?.pinCode;
    let userCoords = null;

    if (userPincode) {
        userCoords = await geocodePincode(userPincode);
        if (userCoords) {
            console.log(`📌 User pincode ${userPincode} → ${userCoords.lat}, ${userCoords.lng}`);
        } else {
            console.warn(`⚠️ Could not geocode user pincode: ${userPincode}`);
        }
    } else {
        console.warn('⚠️ User has no pincode — distance filtering will be skipped');
    }

    // ---- 2. Process each group ----
    const transformed = await Promise.all(firestoreGroups.map(async (group) => {
        // Parse schedule
        let startTime = '09:00';
        let endTime = '12:00';
        if (group.schedule?.time) {
            startTime = group.schedule.time;
            const [hours, minutes] = startTime.split(':').map(Number);
            const endHours = (hours + 3) % 24;
            endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // ---- Calculate distance using pincodes ----
        let calculatedDistance = Infinity; // Default: exclude
        let groupLat = null;
        let groupLng = null;
        const groupPincode = group.location?.pinCode;

        if (userCoords && groupPincode) {
            // Geocode group pincode
            const groupCoords = await geocodePincode(groupPincode);
            if (groupCoords) {
                groupLat = groupCoords.lat;
                groupLng = groupCoords.lng;
                // Get real OSRM road distance
                calculatedDistance = await getOSRMDistance(
                    userCoords.lat, userCoords.lng,
                    groupLat, groupLng
                );
                console.log(`📏 "${group.name}" (pin: ${groupPincode}) → ${calculatedDistance.toFixed(2)} km`);
            } else {
                console.warn(`⚠️ Cannot geocode group "${group.name}" pincode ${groupPincode} — excluded`);
            }
        } else if (!userCoords) {
            // No user coords — can't filter, show all at distance 0
            calculatedDistance = 0;
        } else {
            console.warn(`⚠️ Group "${group.name}" has no pincode — excluded from radius filter`);
        }

        return {
            ...group,
            calculatedDistance,
            schedule: {
                ...group.schedule,
                dayOfWeek: group.schedule?.day || 'Saturday',
                startTime,
                endTime
            },
            location: {
                ...group.location,
                lat: groupLat,
                lng: groupLng,
                coordinates: { lat: groupLat, lng: groupLng }
            },
            language: 'English',
            healthMetrics: {
                lastActivityDate: group.createdAt || new Date(),
                messagesPerDay: group.stats?.activeMembers || 1,
                eventsPerMonth: 2,
                averageAttendance: group.memberCount || 1
            },
            members: group.memberCount || 1
        };
    }));

    return transformed;
}

// --- Binder Functions ---

function bindFilterEvents() {
    // Search Input (Debounced)
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log('🔍 Search changed:', searchInput.value);
                updateDashboard();
            }, 300);
        });
    }

    // Radius Slider (Debounced + UI Update)
    const radiusInput = document.getElementById('filter-radius');
    const radiusDisplay = document.getElementById('radius-display');
    if (radiusInput) {
        radiusInput.addEventListener('input', () => {
            // Update label immediately
            if (radiusDisplay) radiusDisplay.textContent = `${radiusInput.value} km`;
        });

        let debounceTimer;
        radiusInput.addEventListener('change', () => { // 'change' fires on release, or usage debounce on input
            console.log('📏 Radius changed:', radiusInput.value);
            updateDashboard();
        });
    }

    // Checkboxes (Immediate)
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            console.log('☑️ Checkbox changed:', cb.id || cb.value);
            updateDashboard();
        });
    });

    // Selects (Immediate)
    const selects = document.querySelectorAll('select');
    selects.forEach(sel => {
        sel.addEventListener('change', () => {
            console.log('🔽 Select changed:', sel.id);
            updateDashboard();
        });
    });

    // Reset Button
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }

    // --- Time Filter Logic ---
    setupTimeFilter();
}

let customTimeFilter = null; // { day, startTime, endTime } or null

function setupTimeFilter() {
    const widget = document.getElementById('time-filter-widget');
    const display = document.getElementById('time-display');
    const changeBtn = document.getElementById('change-time-btn');
    const modal = document.getElementById('time-modal');
    const cancelBtn = document.getElementById('modal-cancel');
    const applyBtn = document.getElementById('modal-apply');

    // Initialize display with user default
    updateTimeDisplay();

    // Open Modal
    changeBtn.addEventListener('click', () => {
        if (modal) {
            modal.style.display = 'flex';
            // Pre-fill with current selection or user default
            const current = customTimeFilter || (currentUser.availability[0] || { day: 'Saturday', startTime: '09:00', endTime: '12:00' });
            document.getElementById('modal-day').value = current.day;
            document.getElementById('modal-start').value = current.startTime;
            document.getElementById('modal-end').value = current.endTime;
        }
    });

    // Close Modal
    const closeModal = () => { if (modal) modal.style.display = 'none'; };
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Apply Filter
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const day = document.getElementById('modal-day').value;
            const startTime = document.getElementById('modal-start').value;
            const endTime = document.getElementById('modal-end').value;

            customTimeFilter = { day, startTime, endTime };
            updateTimeDisplay();
            updateDashboard();
            closeModal();
        });
    }
}

function updateTimeDisplay() {
    const display = document.getElementById('time-display');
    if (!display) return;

    if (customTimeFilter) {
        display.textContent = `${customTimeFilter.day} ${customTimeFilter.startTime}-${customTimeFilter.endTime} (Custom)`;
        display.style.color = 'var(--primary-500)';
    } else {
        // Show default user availability (first slot)
        const def = currentUser.availability[0];
        display.textContent = `${def.day} ${def.startTime}-${def.endTime} (Default)`;
        display.style.color = 'var(--base-white)';
    }
}

function populateInterestTags() {
    const container = document.getElementById('interest-tags');
    if (!container) return;

    // Read tags directly from raw Firestore groups (no async transform needed)
    const allTags = new Set();
    allGroups.forEach(g => {
        if (g.tags && Array.isArray(g.tags)) {
            g.tags.forEach(t => allTags.add(t));
        }
    });

    container.innerHTML = '';
    allTags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'interest-tag';
        chip.textContent = tag;
        chip.onclick = () => {
            chip.classList.toggle('active');
            updateDashboard();
        };
        container.appendChild(chip);
    });
}

// --- Core Logic ---

async function updateDashboard() {
    const loadingEl = document.getElementById('loading-state');
    const inRadiusSection = document.getElementById('in-radius-section');
    const outRadiusSection = document.getElementById('other-results-section');
    const noResults = document.getElementById('no-results');

    // Show loading
    if (loadingEl) loadingEl.style.display = 'grid'; // Grid like the cards

    // Hide others
    if (inRadiusSection) inRadiusSection.style.display = 'none';
    if (outRadiusSection) outRadiusSection.style.display = 'none';
    if (noResults) noResults.style.display = 'none';

    try {
        // 1. Collect Filters
        const filters = collectFilters();

        // 2. Transform Firestore groups — async: geocodes locations + OSRM distances
        const transformedGroups = await transformGroupsForRanking(allGroups);

        // 3. Rank (groups already have calculatedDistance pre-filled)
        const results = await rankGroups(transformedGroups, currentUser, filters, DEFAULT_WEIGHTS);

        // 4. Render
        renderGroups(results.inRadius, results.outOfRadius);

        // 5. Update UI Context (Active Chips, etc.)
        updateActiveFilterChips(filters);

    } catch (error) {
        console.error('Error updating dashboard:', error);
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function collectFilters() {
    const radiusInput = document.getElementById('filter-radius');
    const savedRadius = currentUser?.radius || 10;
    // Use slider value if present, otherwise fall back to user's saved radius
    const maxRadius = radiusInput ? parseInt(radiusInput.value) : savedRadius;

    const filters = {
        searchQuery: getVal('filter-search'),
        maxRadius,
        sortBy: getVal('sort-select') || 'best-match',
        timeFilter: customTimeFilter || null,
        strictSkill: getChecked('strict-skill'),
        privacy: getCheckedValues('.privacy-filter'),
        languages: getCheckedValues('.language-filter'),
        interests: getActiveTags()
    };
    return filters;
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function getChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
}

function getCheckedValues(selector) {
    return Array.from(document.querySelectorAll(`${selector}:checked`)).map(cb => cb.value);
}

function getActiveTags() {
    return Array.from(document.querySelectorAll('.interest-tag.active')).map(el => el.textContent);
}

function resetFilters() {
    // Reset Inputs
    document.getElementById('filter-search').value = '';

    // Reset Radius back to user's saved range (not hardcoded 50)
    const rInput = document.getElementById('filter-radius');
    const savedRadius = currentUser?.radius || 10;
    if (rInput) {
        rInput.value = savedRadius;
        const rDisplay = document.getElementById('radius-display');
        if (rDisplay) rDisplay.textContent = `${savedRadius} km`;
    }

    // Reset Time
    customTimeFilter = null;
    updateTimeDisplay();

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = cb.defaultChecked || false);
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    document.querySelectorAll('.interest-tag').forEach(t => t.classList.remove('active'));

    // Trigger Update
    updateDashboard();
}
// Expose for Empty State button
window.APP_ResetFilters = resetFilters;

function updateActiveFilterChips(filters) {
    const container = document.getElementById('active-filters');
    if (!container) return;
    container.innerHTML = '';

    // Helper to add chip
    const addChip = (text, onClick) => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip'; // From dashboard styles
        chip.innerHTML = `<span>${text}</span> <button>×</button>`;
        chip.querySelector('button').onclick = onClick;
        container.appendChild(chip);
    };

    if (filters.searchQuery) addChip(`Search: "${filters.searchQuery}"`, () => {
        document.getElementById('filter-search').value = '';
        updateDashboard();
    });

    const savedRadius = currentUser?.radius || 10;
    if (filters.maxRadius !== savedRadius) addChip(`Radius: ${filters.maxRadius} km`, () => {
        const rInput = document.getElementById('filter-radius');
        if (rInput) {
            rInput.value = savedRadius;
            const rDisplay = document.getElementById('radius-display');
            if (rDisplay) rDisplay.textContent = `${savedRadius} km`;
        }
        updateDashboard();
    });

    if (filters.interests.length > 0) addChip(`${filters.interests.length} Interests`, () => {
        document.querySelectorAll('.interest-tag').forEach(t => t.classList.remove('active'));
        updateDashboard();
    });
}

function showErrorState(error) {
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) {
        loadingEl.innerHTML = `<div style="color:red">Error: ${error.message}</div>`;
    }
}

function renderGroups(inRadius, outOfRadius) {
    console.log('🎨 Rendering groups...');

    // Hide loading
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) loadingEl.style.display = 'none';

    // Update Header
    const resultsHeader = document.getElementById('results-header');
    const radiusInput = document.getElementById('filter-radius');
    if (radiusInput && resultsHeader) {
        resultsHeader.textContent = `Groups within ${radiusInput.value} km`;
    }

    const inRadiusContainer = document.getElementById('in-radius-groups');
    const inRadiusSection = document.getElementById('in-radius-section');
    const outRadiusSection = document.getElementById('out-radius-section');
    const noResults = document.getElementById('no-results');

    // Update counts (only in-radius matters now)
    const inRadiusCount = document.getElementById('in-radius-count');
    const totalCount = document.getElementById('total-results-count');
    if (inRadiusCount) inRadiusCount.textContent = inRadius.length;
    if (totalCount) totalCount.textContent = inRadius.length;

    // ALWAYS hide the out-of-radius section — user doesn't want to see them
    if (outRadiusSection) outRadiusSection.style.display = 'none';

    // If no groups in radius → show "No groups found"
    if (inRadius.length === 0) {
        console.log('⚠️ No groups found within radius');
        if (noResults) noResults.style.display = 'block';
        if (inRadiusSection) inRadiusSection.style.display = 'none';
        return;
    }

    // Hide "No Results" state
    if (noResults) noResults.style.display = 'none';

    // Render in-radius groups
    if (inRadiusSection) {
        inRadiusSection.style.display = 'block';
        if (inRadiusContainer) {
            inRadiusContainer.innerHTML = '';
            inRadius.forEach(group => {
                const card = createGroupCard(group);
                inRadiusContainer.appendChild(card);
            });
        }
    }

    console.log('✅ Rendering complete!');
}

function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'card-minimal';
    card.style.cursor = 'pointer';
    card.onclick = () => {
        window.location.href = `group-details.html?id=${group.id}`;
    };

    const compatibility = group.componentScores || { interest: 0, time: 0, distance: 0, skill: 0 };
    const isActive = compatibility.health > 0.7;

    // Category colors for card header
    const categoryColors = {
        'Sports': '667eea',
        'Education': 'f093fb',
        'Social': '4facfe',
        'Arts': '43e97b',
        'Technology': 'fa709a',
        'Health': '30cfd0',
        'Other': 'a8edea'
    };

    const headerColor = categoryColors[group.category] || categoryColors['Other'];

    card.innerHTML = `
        <div class="card-minimal-header" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6)), url('https://placehold.co/400x200/${headerColor}/ffffff?text=${encodeURIComponent(group.name)}');">
            ${isActive ? '<div class="status-badge">✨ Active</div>' : ''}
        </div>
        <div class="card-minimal-body">
            <h4 class="card-title">${group.name}</h4>
            
            <p class="card-description">${group.description}</p>
            
            <div class="info-row">
                <div class="info-item">
                    <span>📍</span> ${isFinite(group.calculatedDistance) ? group.calculatedDistance.toFixed(1) + ' km' : '? km'}
                </div>
                <div class="info-item">
                    <span>👥</span> ${group.memberCount || 0}
                </div>
                <div class="info-item" style="color: var(--primary-500); font-weight: 700; background: var(--primary-50); padding: 2px 6px; border-radius: 4px;">
                    ${group.finalScore ? Math.round(group.finalScore * 100) : 0}% Match
                </div>
            </div>

            <div style="margin-top: 12px; border-top: 1px solid var(--surface-200); padding-top: 12px;">
                 <button class="toggle-details-btn" style="background: none; border: none; color: var(--text-muted); font-size: 12px; cursor: pointer; padding: 0; text-decoration: underline; margin-bottom: 8px;">
                    ❓ Why this match?
                </button>
                <div class="match-breakdown" style="display: none; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; background: var(--surface-50); padding: 8px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between;"><span>Interests:</span> <span>${Math.round((compatibility.interest || 0) * 100)}%</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Time:</span> <span>${Math.round((compatibility.timeOverlap || 0) * 100)}%</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Distance:</span> <span>${Math.round((compatibility.distance || 0) * 100)}%</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Skill:</span> <span>${Math.round((compatibility.skill || 0) * 100)}%</span></div>
                </div>
            </div>
        </div>
    `;

    // Toggle Details logic
    const toggleBtn = card.querySelector('.toggle-details-btn');
    const breakdown = card.querySelector('.match-breakdown');

    toggleBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent card click
        const isHidden = breakdown.style.display === 'none';
        breakdown.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? '❌ Hide details' : '❓ Why this match?';
    };

    return card;
}
