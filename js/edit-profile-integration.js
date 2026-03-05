/**
 * Edit Profile Integration
 * Loads user profile, pre-fills the form, and saves edits back to Firestore.
 */

import { auth } from './firebase-config.js';
import { profileService } from './profile-service.js';

// ─── Constants ───
const INTERESTS = {
    'Sports': '⚽', 'Music': '🎵', 'Coding': '💻', 'Fitness': '💪',
    'Board Games': '♟️', 'Volunteering': '🤝', 'Reading': '📚', 'Photography': '📷',
    'Cooking': '🍳', 'Travel': '✈️', 'Art': '🎨', 'Gaming': '🎮',
    'Dance': '💃', 'Yoga': '🧘', 'Meditation': '🕯️', 'Hiking': '🥾',
    'Cycling': '🚴', 'Swimming': '🏊', 'Running': '🏃', 'Basketball': '🏀',
    'Football': '🏈', 'Tennis': '🎾', 'Badminton': '🏸', 'Cricket': '🏏'
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Mandarin', 'Arabic'];
const GENDERS = ['Any', 'Male', 'Female', 'Non-binary'];

// ─── State ───
let profile = null;
let selectedInterests = {};   // { name: true }
let selectedDays = new Set();
let selectedSlots = new Set();
let selectedLanguages = new Set();
let selectedGenders = new Set();

// ─── Init ───
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    try {
        profile = await profileService.getUserProfile(user.uid);
        if (!profile) {
            alert('Profile not found. Redirecting to setup...');
            window.location.href = 'profile-setup.html';
            return;
        }

        // Patch displayName from Firebase Auth if missing
        if (!profile.displayName && user.displayName) {
            profile.displayName = user.displayName;
        }

        buildInterestsGrid();
        buildWeekdays();
        buildTimeSlots();
        buildLanguages();
        buildGenders();
        prefillForm();

        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('edit-profile-form').style.display = 'grid';
    } catch (err) {
        console.error('❌ Failed to load profile:', err);
        document.getElementById('loading-state').textContent = 'Failed to load profile. Please try again.';
    }
});

// ─── Build UI ───

function buildInterestsGrid() {
    const grid = document.getElementById('edit-interests-grid');
    grid.innerHTML = Object.entries(INTERESTS).map(([name, emoji]) =>
        `<div class="interest-chip" data-interest="${name}">${emoji} ${name}</div>`
    ).join('');

    grid.querySelectorAll('.interest-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const name = chip.dataset.interest;
            chip.classList.toggle('selected');
            if (chip.classList.contains('selected')) {
                selectedInterests[name] = true;
            } else {
                delete selectedInterests[name];
            }
        });
    });
}

function buildWeekdays() {
    const container = document.getElementById('edit-weekdays');
    container.innerHTML = WEEKDAYS.map(d =>
        `<div class="weekday-chip-edit" data-day="${d}">${d}</div>`
    ).join('');

    container.querySelectorAll('.weekday-chip-edit').forEach(chip => {
        chip.addEventListener('click', () => {
            const day = chip.dataset.day;
            chip.classList.toggle('selected');
            if (chip.classList.contains('selected')) {
                selectedDays.add(day);
            } else {
                selectedDays.delete(day);
            }
        });
    });
}

function buildTimeSlots() {
    const container = document.getElementById('edit-timeslots');
    container.innerHTML = TIME_SLOTS.map(s =>
        `<div class="time-chip-edit" data-slot="${s}">${s}</div>`
    ).join('');

    container.querySelectorAll('.time-chip-edit').forEach(chip => {
        chip.addEventListener('click', () => {
            const slot = chip.dataset.slot;
            chip.classList.toggle('selected');
            if (chip.classList.contains('selected')) {
                selectedSlots.add(slot);
            } else {
                selectedSlots.delete(slot);
            }
        });
    });
}

function buildLanguages() {
    const container = document.getElementById('edit-languages');
    container.innerHTML = LANGUAGES.map(lang =>
        `<label class="pref-checkbox-label" data-value="${lang}">
            <input type="checkbox" name="edit-lang" value="${lang}" style="margin-right: var(--space-12);">
            <span>${lang}</span>
        </label>`
    ).join('');

    container.querySelectorAll('input[name="edit-lang"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('.pref-checkbox-label');
            if (cb.checked) {
                selectedLanguages.add(cb.value);
                label.classList.add('checked');
            } else {
                selectedLanguages.delete(cb.value);
                label.classList.remove('checked');
            }
        });
    });
}

function buildGenders() {
    const container = document.getElementById('edit-genders');
    container.innerHTML = GENDERS.map(g =>
        `<label class="pref-checkbox-label" data-value="${g}">
            <input type="checkbox" name="edit-gender" value="${g}" style="margin-right: var(--space-12);">
            <span>${g}</span>
        </label>`
    ).join('');

    container.querySelectorAll('input[name="edit-gender"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('.pref-checkbox-label');
            if (cb.checked) {
                selectedGenders.add(cb.value);
                label.classList.add('checked');
            } else {
                selectedGenders.delete(cb.value);
                label.classList.remove('checked');
            }
        });
    });
}

// ─── Pre-fill form with existing data ───

function prefillForm() {
    // Basic info
    document.getElementById('edit-displayName').value = profile.displayName || '';
    document.getElementById('edit-bio').value = profile.bio || '';

    // Interests — profile.interests can be object { name: level } or array [name]
    if (profile.interests) {
        const interestsObj = Array.isArray(profile.interests)
            ? profile.interests.reduce((acc, name) => ({ ...acc, [name]: true }), {})
            : profile.interests;

        Object.keys(interestsObj).forEach(name => {
            selectedInterests[name] = true;
            const chip = document.querySelector(`.interest-chip[data-interest="${name}"]`);
            if (chip) chip.classList.add('selected');
        });
    }

    // Availability — profile.availability is [{day, slots: [...]}]
    if (profile.availability && Array.isArray(profile.availability)) {
        profile.availability.forEach(avail => {
            const day = avail.day;
            selectedDays.add(day);
            const dayChip = document.querySelector(`.weekday-chip-edit[data-day="${day}"]`);
            if (dayChip) dayChip.classList.add('selected');

            if (avail.slots && Array.isArray(avail.slots)) {
                avail.slots.forEach(slot => {
                    selectedSlots.add(slot);
                    const slotChip = document.querySelector(`.time-chip-edit[data-slot="${slot}"]`);
                    if (slotChip) slotChip.classList.add('selected');
                });
            }
        });
    }

    // Location
    if (profile.location) {
        document.getElementById('edit-city').value = profile.location.city || profile.location.district || '';
        document.getElementById('edit-state').value = profile.location.state || '';
        document.getElementById('edit-pincode').value = profile.location.pinCode || '';
    }

    // Preferences
    if (profile.preferences) {
        const radius = profile.preferences.radius || 10;
        document.getElementById('edit-radius').value = radius;
        document.getElementById('edit-radius-value').textContent = radius;

        // Language — could be string or array
        const langs = Array.isArray(profile.preferences.language)
            ? profile.preferences.language
            : (profile.preferences.language ? [profile.preferences.language] : []);
        langs.forEach(lang => {
            selectedLanguages.add(lang);
            const cb = document.querySelector(`input[name="edit-lang"][value="${lang}"]`);
            if (cb) {
                cb.checked = true;
                cb.closest('.pref-checkbox-label').classList.add('checked');
            }
        });

        // Gender — could be string or array
        const genders = Array.isArray(profile.preferences.gender)
            ? profile.preferences.gender
            : (profile.preferences.gender ? [profile.preferences.gender]
                : (profile.preferences.genderPreference ? [profile.preferences.genderPreference] : []));
        genders.forEach(g => {
            selectedGenders.add(g);
            const cb = document.querySelector(`input[name="edit-gender"][value="${g}"]`);
            if (cb) {
                cb.checked = true;
                cb.closest('.pref-checkbox-label').classList.add('checked');
            }
        });
    }

    // Radius slider live update
    document.getElementById('edit-radius').addEventListener('input', (e) => {
        document.getElementById('edit-radius-value').textContent = e.target.value;
    });
}

// ─── Save ───

document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const displayName = document.getElementById('edit-displayName').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();

    if (!displayName) {
        alert('Display name cannot be empty.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save All Changes';
        return;
    }

    // Build availability array [{day, slots}]
    const availability = [];
    selectedDays.forEach(day => {
        availability.push({
            day,
            slots: [...selectedSlots]
        });
    });

    // Build updates object
    const updates = {
        displayName,
        bio,
        interests: selectedInterests,
        availability,
        location: {
            ...(profile.location || {}),
            city: document.getElementById('edit-city').value.trim(),
            state: document.getElementById('edit-state').value.trim(),
            pinCode: document.getElementById('edit-pincode').value.trim()
        },
        preferences: {
            ...(profile.preferences || {}),
            radius: parseInt(document.getElementById('edit-radius').value),
            language: [...selectedLanguages],
            gender: [...selectedGenders]
        }
    };

    try {
        await profileService.updateProfile(profile.uid, updates);

        // Also update Firebase Auth displayName if changed
        if (auth.currentUser && displayName !== auth.currentUser.displayName) {
            const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
            await updateProfile(auth.currentUser, { displayName });
        }

        submitBtn.textContent = '✅ Saved!';
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 800);
    } catch (err) {
        console.error('❌ Failed to save profile:', err);
        alert('Failed to save changes: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save All Changes';
    }
});
