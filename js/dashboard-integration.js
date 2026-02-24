/**
 * Dashboard Integration - Firestore Version
 */

import { groupService } from './group-service.js';
import { auth } from './firebase-config.js';
import { profileService } from './profile-service.js';
import { rankGroups, DEFAULT_WEIGHTS } from './ranking-engine-fixed.js';

console.log('📦 Dashboard integration module loaded');

let currentUser = null;
let allGroups = [];

/**
 * Transform user profile to match ranking engine expectations
 */
function transformUserProfile(profile) {
    // Clone to avoid mutating the original
    const transformed = { ...profile };

    // 1. Add coordinates from pincode if missing
    if (profile.location && (!profile.location.latitude || !profile.location.longitude)) {
        const coords = getCoordinatesFromPincode(profile.location.pinCode);
        transformed.location = {
            ...profile.location,
            lat: coords.lat,
            lng: coords.lng,
            latitude: coords.lat,
            longitude: coords.lng
        };
    } else if (profile.location && profile.location.latitude && profile.location.longitude) {
        // Normalize lat/lng vs latitude/longitude
        transformed.location = {
            ...profile.location,
            lat: profile.location.latitude,
            lng: profile.location.longitude
        };
    }

    // 2. Transform availability format
    if (profile.availability && profile.availability.length > 0) {
        transformed.availability = profile.availability.map(avail => {
            // If already in correct format, return as-is
            if (avail.startTime && avail.endTime) {
                return avail;
            }

            // Transform from {day, slots} to {day, startTime, endTime}
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
            const slot = avail.slots && avail.slots[0] ? avail.slots[0] : 'Evening';
            const times = slotTimes[slot] || slotTimes['Evening'];

            return {
                day: fullDay,
                startTime: times.start,
                endTime: times.end
            };
        });
    }

    // 3. Use preferences.radius as user.radius
    if (profile.preferences && profile.preferences.radius) {
        transformed.radius = profile.preferences.radius;
    }

    return transformed;
}

/**
 * Get coordinates from Indian pincode
 */
function getCoordinatesFromPincode(pincode) {
    // Pincode to coordinates mapping (sample for common cities)
    const pincodeCoords = {
        '281004': { lat: 27.4924, lng: 77.6737 }, // Mathura
        '110001': { lat: 28.6139, lng: 77.2090 }, // Delhi
        '400001': { lat: 18.9388, lng: 72.8354 }, // Mumbai
        '560001': { lat: 12.9716, lng: 77.5946 }, // Bangalore
        '600001': { lat: 13.0827, lng: 80.2707 }, // Chennai
        '700001': { lat: 22.5726, lng: 88.3639 }  // Kolkata
    };

    return pincodeCoords[pincode] || { lat: 28.6139, lng: 77.2090 }; // Default to Delhi
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
        console.log('✅ User profile transformed:', JSON.stringify(currentUser, null, 2));

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
 * Transform Firestore groups to ranking engine format
 * @param {Array} firestoreGroups - Groups from Firestore
 * @returns {Array} Transformed groups
 */
function transformGroupsForRanking(firestoreGroups) {
    return firestoreGroups.map(group => {
        // Parse schedule time (e.g., "09:00" to startTime/endTime)
        let startTime = '09:00';
        let endTime = '12:00';

        if (group.schedule?.time) {
            startTime = group.schedule.time;
            // Assume 3-hour duration if no end time
            const [hours, minutes] = startTime.split(':').map(Number);
            const endHours = (hours + 3) % 24;
            endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // Get coordinates from location or use default
        const lat = group.location?.coordinates?.lat || 28.6139; // Default: Delhi
        const lng = group.location?.coordinates?.lng || 77.2090;

        return {
            ...group,
            // Transform schedule
            schedule: {
                ...group.schedule,
                dayOfWeek: group.schedule?.day || 'Saturday',
                startTime: startTime,
                endTime: endTime
            },
            // Transform location
            location: {
                ...group.location,
                lat: lat,
                lng: lng
            },
            // Add missing fields with defaults
            language: 'English', // Default language
            healthMetrics: {
                lastActivityDate: group.createdAt || new Date(),
                messagesPerDay: group.stats?.activeMembers || 1,
                eventsPerMonth: 2,
                averageAttendance: group.memberCount || 1
            },
            // Keep original members count
            members: group.memberCount || 1
        };
    });
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

    // Transform groups first
    const transformedGroups = transformGroupsForRanking(allGroups);

    // Extract unique tags from transformed groups
    const allTags = new Set();
    transformedGroups.forEach(g => {
        if (g.tags && Array.isArray(g.tags)) {
            g.tags.forEach(t => allTags.add(t));
        }
    });

    container.innerHTML = '';
    allTags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'interest-tag'; // Defined in dashboard.css/html styles
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

        // 2. Transform Firestore groups to ranking engine format
        const transformedGroups = transformGroupsForRanking(allGroups);

        // 3. Rank (using transformed groups)
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
    const filters = {
        searchQuery: getVal('filter-search'),
        maxRadius: parseInt(getVal('filter-radius')) || 50,
        sortBy: getVal('sort-select') || 'best-match',

        // Time Filter: Custom or User Default (Implicitly required now)
        timeFilter: customTimeFilter || null, // If null, ranking engine should use user.availability

        // Checkboxes
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

    // Reset Radius
    const rInput = document.getElementById('filter-radius');
    if (rInput) {
        rInput.value = 50; // Max radius by default
        const rDisplay = document.getElementById('radius-display');
        if (rDisplay) rDisplay.textContent = '50 km';
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

    if (filters.maxRadius < 50) addChip(`Radius: < ${filters.maxRadius}km`, () => {
        const rInput = document.getElementById('filter-radius');
        if (rInput) {
            rInput.value = 50;
            const rDisplay = document.getElementById('radius-display');
            if (rDisplay) rDisplay.textContent = '50 km';
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
    const outResultsHeader = document.getElementById('out-radius-header');

    // We need to know the current radius. We can get it from the input directly for now as it's UI state
    const radiusInput = document.getElementById('filter-radius');
    if (radiusInput) {
        if (resultsHeader) resultsHeader.textContent = `Groups within ${radiusInput.value} km`;
        if (outResultsHeader) outResultsHeader.textContent = `Other groups (outside ${radiusInput.value} km)`;
    }

    const inRadiusContainer = document.getElementById('in-radius-groups');
    const outRadiusContainer = document.getElementById('out-radius-groups');
    const inRadiusSection = document.getElementById('in-radius-section');
    const outRadiusSection = document.getElementById('out-radius-section');
    const noResults = document.getElementById('no-results');

    // Update counts
    const inRadiusCount = document.getElementById('in-radius-count');
    const outRadiusCount = document.getElementById('out-radius-count');
    const totalCount = document.getElementById('total-results-count');

    if (inRadiusCount) inRadiusCount.textContent = inRadius.length;
    if (outRadiusCount) outRadiusCount.textContent = outOfRadius.length;
    if (totalCount) totalCount.textContent = inRadius.length + outOfRadius.length;

    // Check if TOTAL no results
    if (inRadius.length === 0 && outOfRadius.length === 0) {
        console.log('⚠️ No results found');
        if (noResults) noResults.style.display = 'block';
        if (inRadiusSection) inRadiusSection.style.display = 'none';
        if (outRadiusSection) outRadiusSection.style.display = 'none';
        return;
    }

    // Hide "No Results" state if we have results
    if (noResults) noResults.style.display = 'none';

    // --- Render In-Radius ---
    if (inRadiusSection) {
        if (inRadius.length > 0) {
            inRadiusSection.style.display = 'block';
            if (inRadiusContainer) {
                inRadiusContainer.innerHTML = '';
                inRadius.forEach(group => {
                    const card = createGroupCard(group);
                    inRadiusContainer.appendChild(card);
                });
            }
        } else {
            // Explicitly hide if empty
            inRadiusSection.style.display = 'none';
            if (inRadiusContainer) inRadiusContainer.innerHTML = '';
        }
    }

    // --- Render Out-of-Radius ---
    if (outRadiusSection) {
        if (outOfRadius.length > 0) {
            outRadiusSection.style.display = 'block';
            if (outRadiusContainer) {
                outRadiusContainer.style.display = 'grid';
                outRadiusContainer.innerHTML = '';
                outOfRadius.forEach(group => {
                    const card = createGroupCard(group);
                    outRadiusContainer.appendChild(card);
                });
            }
        } else {
            // Explicitly hide if empty
            outRadiusSection.style.display = 'none';
            if (outRadiusContainer) outRadiusContainer.innerHTML = '';
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
                    <span>📍</span> ${group.calculatedDistance ? group.calculatedDistance.toFixed(1) : '0.0'} km
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
