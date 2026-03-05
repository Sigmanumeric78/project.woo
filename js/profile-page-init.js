// Profile Page - Complete Feature Initialization
// This script wires up all profile page features

import { profilePageIntegration } from '../js/profile-page-integration.js';
import { auth } from '../js/firebase-config.js';

// Wait for authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.warn('⚠️ No authenticated user, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }

    console.log('✅ User authenticated:', user.email);

    // Load profile data
    await profilePageIntegration.loadProfileData(user.uid);

    // Patch displayName from Firebase Auth if missing in Firestore profile
    if (profilePageIntegration.currentProfile && !profilePageIntegration.currentProfile.displayName) {
        const authName = user.displayName;
        if (authName) {
            profilePageIntegration.currentProfile.displayName = authName;
            profilePageIntegration.updateProfileUI(profilePageIntegration.currentProfile);
        }
    }

    // Calculate stats
    await profilePageIntegration.calculateStats();

    // Update nav-avatar with proper initials
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) {
        const name = profilePageIntegration.currentProfile?.displayName || user.displayName || user.email || 'User';
        const parts = name.trim().split(/\s+/);
        const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
        navAvatar.textContent = initials;
    }

    // Setup all UI features
    setupTabs();
    setupEditProfile();
    setupAvailability();
    setupSettings();
    setupShareProfile();
    setupSocialLinks();
});

// ==================== Tab Navigation ====================
function setupTabs() {
    const tabs = document.querySelectorAll('.profile-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const targetId = tab.dataset.tab;
            if (!targetId) return;

            // Update active states
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');

            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');

            // Load tab-specific content
            if (targetId === 'groups') {
                await profilePageIntegration.loadUserGroups();
                await profilePageIntegration.calculateStats();
            }
        });
    });
}

// ==================== Edit Profile ====================
function setupEditProfile() {
    // Edit Profile Button
    const editBtn = document.getElementById('btn-edit-profile');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            profilePageIntegration.openEditModal();
        });
    }

    // Close Modal Buttons
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            profilePageIntegration.closeEditModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            profilePageIntegration.closeEditModal();
        });
    }

    // Edit Profile Form Submit
    const editForm = document.getElementById('editProfileForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const saveBtn = document.getElementById('saveEditBtn');
            profilePageIntegration.setButtonLoading(saveBtn, true);

            const displayName = document.getElementById('edit-name').value;
            const bio = document.getElementById('edit-bio').value;

            const success = await profilePageIntegration.saveProfileEdits({
                displayName,
                bio
            });

            profilePageIntegration.setButtonLoading(saveBtn, false);

            if (success) {
                profilePageIntegration.closeEditModal();
            }
        });
    }
}

// ==================== Availability Management ====================
function setupAvailability() {
    // Add Slot Button (in availability tab)
    setTimeout(() => {
        const addSlotBtn = document.querySelector('#availability .btn-ghost');
        if (addSlotBtn && !addSlotBtn.dataset.initialized) {
            addSlotBtn.dataset.initialized = 'true';
            addSlotBtn.addEventListener('click', () => {
                openAddSlotModal();
            });
        }
    }, 500);

    // Add Slot Form
    const addSlotForm = document.getElementById('add-slot-form');
    if (addSlotForm) {
        addSlotForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const day = document.getElementById('slot-day').value;
            const start = document.getElementById('slot-start').value;
            const end = document.getElementById('slot-end').value;

            const success = await profilePageIntegration.addAvailabilitySlot({
                day, start, end
            });

            if (success) {
                closeAddSlotModal();
                addSlotForm.reset();
            }
        });
    }

    // Cancel Add Slot
    const cancelSlotBtn = document.getElementById('cancel-add-slot');
    if (cancelSlotBtn) {
        cancelSlotBtn.addEventListener('click', closeAddSlotModal);
    }
}

function openAddSlotModal() {
    const modal = document.getElementById('add-slot-modal');
    if (modal) modal.style.display = 'flex';
}

function closeAddSlotModal() {
    const modal = document.getElementById('add-slot-modal');
    if (modal) modal.style.display = 'none';
}

// Make remove function globally available
window.removeAvailability = async function (day) {
    if (confirm(`Remove all availability for ${day}?`)) {
        await profilePageIntegration.removeAvailabilitySlot(day);
    }
};

// ==================== Settings ====================
function setupSettings() {
    // Delete Account Button (No Timeout needed for static elements)
    const deleteBtn = document.getElementById('btn-delete-account');
    if (deleteBtn) {
        if (!deleteBtn.dataset.initialized) {
            console.log('✅ Initializing Delete Account button');
            deleteBtn.dataset.initialized = 'true';
            deleteBtn.addEventListener('click', async () => {
                console.log('🗑️ Delete Account clicked');
                await profilePageIntegration.deleteAccount();
            });
        }
    } else {
        console.error('❌ Delete Account button not found in DOM');
    }

    // Logout Button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        if (!logoutBtn.dataset.initialized) {
            console.log('✅ Initializing Logout button');
            logoutBtn.dataset.initialized = 'true';
            logoutBtn.addEventListener('click', async () => {
                console.log('🚪 Logout clicked');
                if (confirm('Are you sure you want to log out?')) {
                    try {
                        console.log('🔄 Signing out...');
                        await auth.signOut();
                        console.log('✅ Logged out successfully');
                        window.location.href = 'login.html';
                    } catch (error) {
                        console.error('❌ Logout error:', error);
                        alert('Failed to log out: ' + error.message);
                    }
                }
            });
        }
    } else {
        console.error('❌ Logout button not found in DOM');
    }

    // Privacy Settings Checkboxes
    setTimeout(() => {
        const checkboxes = document.querySelectorAll('#settings input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            if (!checkbox.dataset.initialized) {
                checkbox.dataset.initialized = 'true';
                checkbox.addEventListener('change', async () => {
                    const settings = {
                        showAvailability: checkboxes[0]?.checked || false,
                        hideLocation: checkboxes[1]?.checked || false
                    };
                    await profilePageIntegration.updateSettings(settings);
                });
            }
        });
    }, 500);
}

// ==================== Share Profile ====================
function setupShareProfile() {
    // Share Profile Button (in sidebar)
    setTimeout(() => {
        const shareBtn = document.querySelector('button:has-text("Share Profile")');
        // Fallback: find by text content
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.textContent.includes('Share Profile') && !btn.dataset.initialized) {
                btn.dataset.initialized = 'true';
                btn.addEventListener('click', () => {
                    profilePageIntegration.shareProfile();
                });
            }
        });
    }, 500);
}

// ==================== Update Availability Display ====================
// Override the updateAvailabilityDetails method to include delete buttons
const originalUpdateAvailability = profilePageIntegration.updateAvailabilityDetails.bind(profilePageIntegration);
profilePageIntegration.updateAvailabilityDetails = function (availability) {
    const container = document.getElementById('availability-list');
    if (!container) return;

    if (!availability || availability.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No availability set.</p>';
        return;
    }

    container.innerHTML = availability.map(slot => `
        <div style="background: var(--surface-200); padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; color: var(--base-white);">${slot.day}</div>
                <div style="font-size: 14px; color: var(--text-description); margin-top: 4px;">
                    ${slot.slots ? slot.slots.join(', ') : 'All day'}
                </div>
            </div>
            <button class="btn btn-ghost btn-sm" style="color: #ef4444;" onclick="removeAvailability('${slot.day}')">Remove</button>
        </div>
    `).join('');
};

// ==================== Social Links ====================
function setupSocialLinks() {
    // Edit Social Links Button
    const editSocialBtn = document.getElementById('btn-edit-social-links');
    if (editSocialBtn) {
        editSocialBtn.addEventListener('click', () => {
            console.log('📝 Opening edit social links modal');
            profilePageIntegration.openEditSocialLinksModal();
        });
    }

    // Save Social Links Form
    const socialLinksForm = document.getElementById('editSocialLinksForm');
    if (socialLinksForm) {
        socialLinksForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const socialLinks = {
                instagram: document.getElementById('social-instagram').value,
                twitter: document.getElementById('social-twitter').value,
                linkedin: document.getElementById('social-linkedin').value,
                github: document.getElementById('social-github').value
            };

            console.log('💾 Submitting social links:', socialLinks);

            const success = await profilePageIntegration.saveSocialLinks(socialLinks);

            if (success) {
                profilePageIntegration.closeEditSocialLinksModal();
            }
        });
    }

    // Close Modal Button (X)
    const closeBtn = document.getElementById('closeSocialLinksModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('❌ Closing social links modal');
            profilePageIntegration.closeEditSocialLinksModal();
        });
    }

    // Cancel Button
    const cancelBtn = document.getElementById('cancelSocialLinksBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            console.log('❌ Canceling social links edit');
            profilePageIntegration.closeEditSocialLinksModal();
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('edit-social-links-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('❌ Closing social links modal (clicked outside)');
                profilePageIntegration.closeEditSocialLinksModal();
            }
        });
    }
}

console.log('✅ Profile page features initialized');
