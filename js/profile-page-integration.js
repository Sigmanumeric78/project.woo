import { profileService } from './profile-service.js';
import { storageService } from './storage-service.js';
import { firestoreService } from './firestore-service.js';
import { auth } from './firebase-config.js';
import { groupService } from './group-service.js';

class ProfilePageIntegration {
    constructor() {
        this.currentProfile = null;
        this.unsubscribe = null;
    }

    // ==================== Load & Display Profile ====================

    /**
     * Load profile data and update UI
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async loadProfileData(uid) {
        try {
            console.log('📥 Loading profile data for:', uid);

            // Load profile from Firestore
            const profile = await profileService.getUserProfile(uid);

            if (!profile) {
                console.error('❌ Profile not found');
                this.showError('Profile not found. Please complete profile setup.');
                setTimeout(() => {
                    window.location.href = 'profile-setup.html';
                }, 2000);
                return;
            }

            this.currentProfile = profile;
            this.updateProfileUI(profile);

            // Subscribe to real-time updates
            this.subscribeToProfileUpdates(uid);

            console.log('✅ Profile loaded successfully');
        } catch (error) {
            console.error('❌ Error loading profile:', error);
            this.showError('Failed to load profile. Please refresh the page.');
        }
    }

    /**
     * Update all UI elements with profile data
     * @param {Object} profile - Profile data
     */
    updateProfileUI(profile) {
        try {
            console.log('🔄 Updating UI with profile:', profile);

            // Update avatar
            const avatar = document.getElementById('profile-avatar');
            if (avatar) {
                // Use UI Avatars API for consistent placeholder
                const displayName = profile.displayName || profile.email || 'User';
                const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D8ABC&color=fff&size=120`;

                avatar.src = profile.photoURL || fallbackUrl;
                avatar.alt = displayName;
            }

            // Update name
            const nameEl = document.getElementById('profile-name');
            if (nameEl) {
                nameEl.textContent = profile.displayName || profile.email || 'Anonymous User';
            }

            // Update bio
            const bioEl = document.getElementById('profile-bio');
            if (bioEl) {
                bioEl.textContent = profile.bio || 'No bio yet.';
            }

            // Also update extended bio if element exists
            const extendedBioEl = document.getElementById('profile-extended-bio');
            if (extendedBioEl) {
                extendedBioEl.textContent = profile.bio || 'No bio yet.';
            }

            // Update location
            const locationEl = document.getElementById('profile-location-pill');
            if (locationEl && profile.location) {
                locationEl.textContent = `${profile.location.city || 'Unknown'}, ${profile.location.state || ''}`;
            }

            // Update availability
            const availabilityEl = document.getElementById('profile-availability-pill');
            if (availabilityEl && profile.availability && profile.availability.length > 0) {
                const days = profile.availability.map(a => a.day).join(', ');
                availabilityEl.textContent = days || 'Not set';
            }

            // Update stats
            const statsEls = {
                joined: document.getElementById('profile-groups-joined'),
                created: document.getElementById('profile-groups-created'),
                activities: document.getElementById('profile-upcoming-activities')
            };

            if (statsEls.joined) statsEls.joined.textContent = profile.stats?.joinedGroups || 0;
            if (statsEls.created) statsEls.created.textContent = profile.stats?.createdGroups || 0;
            if (statsEls.activities) statsEls.activities.textContent = profile.stats?.upcomingActivities || 0;

            // Update stats container
            this.updateStats(profile.stats || {});

            // Update interests
            this.updateInterests(profile.interests || []);

            // Update availability details
            this.updateAvailabilityDetails(profile.availability || []);

            // Update social links
            this.updateSocialLinks(profile.socialLinks || {});

            console.log('✅ UI updated with profile data');
        } catch (error) {
            console.error('❌ Error updating UI:', error);
        }
    }

    /**
     * Update stats display
     * @param {Object} stats - Stats object
     */
    updateStats(stats) {
        const statsContainer = document.getElementById('profile-stats');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${stats.joinedGroups || 0}</div>
                <div class="stat-label">Groups Joined</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.createdGroups || 0}</div>
                <div class="stat-label">Groups Created</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.upcomingActivities || 0}</div>
                <div class="stat-label">Upcoming</div>
            </div>
        `;
    }

    /**
     * Update interests display
     * @param {Array} interests - Array of interest names
     */
    updateInterests(interests) {
        const container = document.getElementById('interests-container');
        if (!container) return;

        if (!interests || interests.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No interests added yet.</p>';
            return;
        }

        container.innerHTML = interests.map(interest => `
            <div class="interest-tag-detailed">
                <span class="interest-name">${interest}</span>
            </div>
        `).join('');
    }

    /**
     * Update availability details
     * @param {Array} availability - Array of availability objects
     */
    updateAvailabilityDetails(availability) {
        const container = document.getElementById('availability-container');
        if (!container) return;

        if (!availability || availability.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No availability set.</p>';
            return;
        }

        container.innerHTML = availability.map(slot => `
            <div class="availability-slot" style="padding: 12px; background: var(--surface-200); border-radius: 8px; margin-bottom: 8px;">
                <div style="font-weight: 600; color: var(--base-white);">${slot.day}</div>
                <div style="font-size: 14px; color: var(--text-description); margin-top: 4px;">
                    ${slot.slots ? slot.slots.join(', ') : 'All day'}
                </div>
            </div>
        `).join('');
    }

    // ==================== Edit Profile ====================

    /**
     * Open edit profile modal with current data
     */
    openEditModal() {
        if (!this.currentProfile) {
            this.showError('Profile not loaded yet.');
            return;
        }

        // Pre-fill form with current data
        const nameInput = document.getElementById('edit-name');
        const bioInput = document.getElementById('edit-bio');

        if (nameInput) nameInput.value = this.currentProfile.displayName || '';
        if (bioInput) bioInput.value = this.currentProfile.bio || '';

        // Show modal
        const modal = document.getElementById('editProfileModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * Close edit profile modal
     */
    closeEditModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Save profile edits to Firestore
     * @param {Object} updates - Updated fields
     * @returns {Promise<boolean>}
     */
    async saveProfileEdits(updates) {
        try {
            if (!this.currentProfile) {
                throw new Error('No profile loaded');
            }

            console.log('💾 Saving profile edits:', updates);

            // Validate
            if (updates.displayName && updates.displayName.trim().length === 0) {
                this.showError('Name cannot be empty');
                return false;
            }

            // Update in Firestore
            await profileService.updateProfile(this.currentProfile.uid, updates);

            // Update local profile
            this.currentProfile = { ...this.currentProfile, ...updates };

            // Update UI optimistically
            this.updateProfileUI(this.currentProfile);

            console.log('✅ Profile updated successfully');
            this.showSuccess('Profile updated successfully!');

            return true;
        } catch (error) {
            console.error('❌ Error saving profile:', error);
            this.showError('Failed to save changes. Please try again.');
            return false;
        }
    }

    // ==================== Photo Upload (Disabled - Requires Paid Storage) ====================

    /**
     * Photo upload disabled - requires Firebase Storage (paid feature)
     * Using placeholder images for now
     */

    // ==================== Groups Management ====================

    /**
     * Load and display user's groups
     * @returns {Promise<void>}
     */
    async loadUserGroups() {
        try {
            if (!this.currentProfile) return;

            console.log('📥 Loading user groups...');

            const container = document.getElementById('groups-container');
            if (!container) return;

            // Query groups where user is member or creator
            const groups = await firestoreService.queryDocuments('groups', [
                { field: 'members', operator: 'array-contains', value: this.currentProfile.uid }
            ]);

            if (!groups || groups.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">No groups yet. Create or join a group to get started!</p>';
                return;
            }

            // Display groups
            container.innerHTML = groups.map(group => `
                <div class="group-card" style="background: var(--surface-200); padding: 16px; border-radius: 12px; margin-bottom: 12px; cursor: pointer;" onclick="window.location.href='group-details.html?id=${group.id}'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="font-size: 16px; font-weight: 600; color: var(--base-white); margin-bottom: 4px;">${group.name || 'Unnamed Group'}</h3>
                            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">${group.description || 'No description'}</p>
                            <div style="display: flex; gap: 12px; font-size: 12px; color: var(--text-description);">
                                <span>👥 ${group.members?.length || 0} members</span>
                                <span>📍 ${group.location?.city || 'Unknown'}</span>
                            </div>
                        </div>
                        <span class="badge" style="background: var(--primary-500); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                            ${group.createdBy === this.currentProfile.uid ? 'Owner' : 'Member'}
                        </span>
                    </div>
                </div>
            `).join('');

            console.log(`✅ Loaded ${groups.length} groups`);
        } catch (error) {
            console.error('❌ Error loading groups:', error);
        }
    }

    // ==================== Availability Management ====================

    /**
     * Add availability slot
     * @param {Object} slot - Availability slot {day, start, end}
     * @returns {Promise<boolean>}
     */
    async addAvailabilitySlot(slot) {
        try {
            if (!this.currentProfile) return false;

            console.log('➕ Adding availability slot:', slot);

            const availability = this.currentProfile.availability || [];

            // Check if day already exists
            const existingIndex = availability.findIndex(a => a.day === slot.day);

            if (existingIndex >= 0) {
                // Add to existing day
                if (!availability[existingIndex].slots) {
                    availability[existingIndex].slots = [];
                }
                availability[existingIndex].slots.push(`${slot.start}-${slot.end}`);
            } else {
                // Add new day
                availability.push({
                    day: slot.day,
                    slots: [`${slot.start}-${slot.end}`]
                });
            }

            // Update in Firestore
            await profileService.updateProfile(this.currentProfile.uid, { availability });

            // Update UI
            this.updateAvailabilityDetails(availability);

            this.showSuccess('Availability added!');
            return true;
        } catch (error) {
            console.error('❌ Error adding availability:', error);
            this.showError('Failed to add availability');
            return false;
        }
    }

    /**
     * Remove availability slot
     * @param {string} day - Day to remove
     * @param {number} slotIndex - Slot index to remove
     * @returns {Promise<boolean>}
     */
    async removeAvailabilitySlot(day, slotIndex = null) {
        try {
            if (!this.currentProfile) return false;

            let availability = this.currentProfile.availability || [];

            if (slotIndex !== null) {
                // Remove specific slot
                const dayIndex = availability.findIndex(a => a.day === day);
                if (dayIndex >= 0 && availability[dayIndex].slots) {
                    availability[dayIndex].slots.splice(slotIndex, 1);
                    // Remove day if no slots left
                    if (availability[dayIndex].slots.length === 0) {
                        availability.splice(dayIndex, 1);
                    }
                }
            } else {
                // Remove entire day
                availability = availability.filter(a => a.day !== day);
            }

            // Update in Firestore
            await profileService.updateProfile(this.currentProfile.uid, { availability });

            // Update UI
            this.updateAvailabilityDetails(availability);

            this.showSuccess('Availability removed!');
            return true;
        } catch (error) {
            console.error('❌ Error removing availability:', error);
            this.showError('Failed to remove availability');
            return false;
        }
    }

    // ==================== Settings & Preferences ====================

    /**
     * Update user settings
     * @param {Object} settings - Settings to update
     * @returns {Promise<boolean>}
     */
    async updateSettings(settings) {
        try {
            if (!this.currentProfile) return false;

            console.log('⚙️ Updating settings:', settings);

            await profileService.updateProfile(this.currentProfile.uid, { settings });

            this.showSuccess('Settings updated!');
            return true;
        } catch (error) {
            console.error('❌ Error updating settings:', error);
            this.showError('Failed to update settings');
            return false;
        }
    }

    /**
     * Delete user account (with double confirmation)
     */
    async deleteAccount() {
        try {
            if (!this.currentProfile) return;

            // First confirmation
            const confirmed = confirm(
                '⚠️ WARNING: DELETE ACCOUNT\n\n' +
                'This action will PERMANENTLY delete:\n' +
                '• Your profile and all personal data\n' +
                '• Your group memberships\n' +
                '• Your activity history\n' +
                '• Your account access\n\n' +
                'This action CANNOT be undone!\n\n' +
                'Are you sure you want to continue?'
            );

            if (!confirmed) {
                console.log('❌ Account deletion cancelled');
                return;
            }

            // Second confirmation
            const doubleConfirm = confirm(
                '⚠️ FINAL WARNING\n\n' +
                'This is your LAST CHANCE to cancel!\n\n' +
                'Click OK to PERMANENTLY DELETE your account.\n' +
                'Click Cancel to keep your account.'
            );

            if (!doubleConfirm) {
                console.log('❌ Account deletion cancelled');
                return;
            }

            console.log('🗑️ Deleting account...');

            // OPTION B: Cascading Delete - Delete all groups created by this user first
            try {
                // FIXED: Use 'creatorId' (matches group-service.js) instead of 'createdBy'
                const createdGroups = await firestoreService.queryDocuments('groups', [
                    { field: 'creatorId', operator: '==', value: this.currentProfile.uid }
                ]);

                if (createdGroups && createdGroups.length > 0) {
                    console.log(`🗑️ Deleting ${createdGroups.length} groups created by user...`);
                    // Use Promise.all for parallel deletion
                    await Promise.all(createdGroups.map(group => groupService.deleteGroup(group.id)));
                    console.log('✅ All user groups deleted.');
                }
            } catch (groupError) {
                console.error('⚠️ Error deleting user groups (proceeding with account delete):', groupError);
                // We proceed with account deletion even if group deletion fails partially
            }

            // Delete user data from Firestore
            await firestoreService.deleteDocument('users', this.currentProfile.uid);

            // Delete Firebase Auth account
            // auth.currentUser should be available if currentProfile exists
            await auth.currentUser.delete();

            alert('✅ Account deleted successfully.\n\nYou will be redirected to the homepage.');

            // Redirect to homepage
            window.location.href = '../index.html';
        } catch (error) {
            console.error('❌ Error deleting account:', error);

            if (error.code === 'auth/requires-recent-login') {
                alert(
                    '⚠️ Security Check Required\n\n' +
                    'For security reasons, you need to log in again before deleting your account.\n\n' +
                    'Please log out and log back in, then try again.'
                );
            } else {
                alert('❌ Error deleting account: ' + error.message);
            }
        }
    }

    // ==================== Stats Calculation ====================

    /**
     * Calculate and update user stats
     * @returns {Promise<void>}
     */
    async calculateStats() {
        try {
            if (!this.currentProfile) return;

            console.log('📊 Calculating stats...');

            // Count joined groups
            const joinedGroups = await firestoreService.queryDocuments('groups', [
                { field: 'members', operator: 'array-contains', value: this.currentProfile.uid }
            ]);

            // Count created groups
            const createdGroups = await firestoreService.queryDocuments('groups', [
                { field: 'createdBy', operator: '==', value: this.currentProfile.uid }
            ]);

            const stats = {
                joinedGroups: joinedGroups?.length || 0,
                createdGroups: createdGroups?.length || 0,
                upcomingActivities: 0 // TODO: Implement when activities are added
            };

            // Update in Firestore
            await profileService.updateProfile(this.currentProfile.uid, { stats });

            // Update UI
            this.updateStats(stats);

            console.log('✅ Stats updated:', stats);
        } catch (error) {
            console.error('❌ Error calculating stats:', error);
        }
    }

    // ==================== Real-time Sync ====================

    /**
     * Subscribe to real-time profile updates
     * @param {string} uid - User ID
     */
    subscribeToProfileUpdates(uid) {
        // Unsubscribe from previous listener
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.unsubscribe = profileService.subscribeToProfile(uid, (profile, error) => {
            if (error) {
                console.error('❌ Real-time update error:', error);
                return;
            }

            if (profile) {
                console.log('🔄 Profile updated (real-time)');
                this.currentProfile = profile;
                this.updateProfileUI(profile);
            }
        });
    }

    /**
     * Unsubscribe from profile updates
     */
    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    // ==================== UI Helpers ====================

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        // Simple alert for now, can be replaced with toast notification
        alert(`❌ ${message}`);
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        // Simple alert for now, can be replaced with toast notification
        alert(`✅ ${message}`);
    }

    /**
     * Set button loading state
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - Loading state
     */
    setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Saving...';
            button.disabled = true;
            button.style.opacity = '0.6';
        } else {
            button.textContent = button.dataset.originalText || 'Save';
            button.disabled = false;
            button.style.opacity = '1';
        }
    }

    // ==================== Share Profile ====================

    /**
     * Share profile - copy link to clipboard
     */
    shareProfile() {
        if (!this.currentProfile) return;

        try {
            const profileUrl = `${window.location.origin}/pages/profile.html?uid=${this.currentProfile.uid}`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(profileUrl)
                    .then(() => {
                        alert('✅ Profile link copied to clipboard!\n\nShare this link with others to show them your profile.');
                        console.log('✅ Profile link copied');
                    })
                    .catch(err => {
                        console.error('❌ Error copying to clipboard:', err);
                        // Fallback: show the link
                        prompt('Copy this link to share your profile:', profileUrl);
                    });
            } else {
                // Fallback for browsers without clipboard API
                prompt('Copy this link to share your profile:', profileUrl);
            }
        } catch (error) {
            console.error('❌ Error sharing profile:', error);
            alert('⚠️ Could not copy link. Please copy the URL from your browser.');
        }
    }

    // ==================== Social Links ====================

    /**
     * Update social links display
     * @param {Object} socialLinks - Social links object
     */
    updateSocialLinks(socialLinks) {
        const container = document.getElementById('social-links-display');
        if (!container) return;

        if (!socialLinks || Object.keys(socialLinks).filter(key => socialLinks[key]).length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No social links added yet. Click "Edit Links" to add your social media profiles.</p>';
            return;
        }

        const icons = {
            instagram: '📷',
            twitter: '🐦',
            linkedin: '💼',
            github: '💻'
        };

        const labels = {
            instagram: 'Instagram',
            twitter: 'Twitter',
            linkedin: 'LinkedIn',
            github: 'GitHub'
        };

        container.innerHTML = Object.entries(socialLinks)
            .filter(([key, url]) => url && url.trim())
            .map(([key, url]) => `
                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                   style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; 
                          background: var(--surface-200); border-radius: 8px; color: var(--base-white); 
                          text-decoration: none; transition: all 0.2s; font-size: 14px;"
                   onmouseover="this.style.background='var(--primary)'; this.style.transform='translateY(-2px)';"
                   onmouseout="this.style.background='var(--surface-200)'; this.style.transform='translateY(0)';">
                    <span style="font-size: 18px;">${icons[key]}</span>
                    <span>${labels[key]}</span>
                </a>
            `).join('');
    }

    /**
     * Open edit social links modal
     */
    openEditSocialLinksModal() {
        const modal = document.getElementById('edit-social-links-modal');
        if (!modal) return;

        // Pre-fill with current values
        const links = this.currentProfile?.socialLinks || {};
        document.getElementById('social-instagram').value = links.instagram || '';
        document.getElementById('social-twitter').value = links.twitter || '';
        document.getElementById('social-linkedin').value = links.linkedin || '';
        document.getElementById('social-github').value = links.github || '';

        modal.style.display = 'flex';
    }

    /**
     * Close edit social links modal
     */
    closeEditSocialLinksModal() {
        const modal = document.getElementById('edit-social-links-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Save social links to Firestore
     * @param {Object} socialLinks - Social links object
     * @returns {Promise<boolean>} Success status
     */
    async saveSocialLinks(socialLinks) {
        try {
            if (!this.currentProfile) {
                throw new Error('No profile loaded');
            }

            console.log('💾 Saving social links:', socialLinks);

            // Validate and clean URLs
            const validatedLinks = {};
            for (const [key, url] of Object.entries(socialLinks)) {
                if (url && url.trim()) {
                    const trimmedUrl = url.trim();
                    if (!this.isValidUrl(trimmedUrl)) {
                        throw new Error(`Invalid URL for ${key}. Please enter a valid URL starting with http:// or https://`);
                    }
                    validatedLinks[key] = trimmedUrl;
                }
            }

            // Update in Firestore
            await profileService.updateProfile(this.currentProfile.uid, {
                socialLinks: validatedLinks
            });

            // Update local profile
            this.currentProfile.socialLinks = validatedLinks;

            // Update UI
            this.updateSocialLinks(validatedLinks);

            console.log('✅ Social links updated successfully');
            this.showSuccess('Social links updated successfully!');

            return true;
        } catch (error) {
            console.error('❌ Error saving social links:', error);
            this.showError(error.message || 'Failed to save social links. Please try again.');
            return false;
        }
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} Is valid URL
     */
    isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
}

// Create singleton instance
export const profilePageIntegration = new ProfilePageIntegration();

// Export for debugging
window.profilePageIntegration = profilePageIntegration;

console.log('✅ Profile Page Integration loaded');
