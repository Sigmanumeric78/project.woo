// Profile Service - User Profile Management
import { firestoreService } from './firestore-service.js';
import { auth } from './firebase-config.js';

class ProfileService {
    constructor() {
        this.currentProfile = null;
        this.profileListener = null;
        this.COLLECTION_NAME = 'users';
    }

    // ==================== Profile CRUD Operations ====================

    /**
     * Get user profile from Firestore
     * @param {string} uid - User ID
     * @param {boolean} useCache - Whether to use cached profile
     * @returns {Promise<Object|null>} User profile or null
     */
    async getUserProfile(uid, useCache = true) {
        try {
            // Check cache first
            if (useCache && this.currentProfile && this.currentProfile.uid === uid) {
                console.log('📦 Using cached profile');
                return this.currentProfile;
            }

            // Check localStorage
            const cachedProfile = this.getCachedProfile();
            if (useCache && cachedProfile && cachedProfile.uid === uid) {
                console.log('📦 Using localStorage cached profile');
                this.currentProfile = cachedProfile;
                return cachedProfile;
            }

            // Fetch from Firestore
            console.log('🔍 Fetching profile from Firestore...');
            const profile = await firestoreService.getDocument(this.COLLECTION_NAME, uid);

            if (profile) {
                this.currentProfile = profile;
                this.setCachedProfile(profile);
                console.log('✅ Profile loaded successfully');
                return profile;
            }

            console.warn('⚠️ Profile not found');
            return null;
        } catch (error) {
            console.error('❌ Error getting user profile:', error);
            // Return cached profile as fallback
            return this.getCachedProfile();
        }
    }

    /**
     * Create a new user profile
     * @param {string} uid - User ID
     * @param {Object} profileData - Initial profile data
     * @returns {Promise<Object>} Created profile
     */
    async createProfile(uid, profileData) {
        try {
            const defaultProfile = {
                uid,
                email: profileData.email || '',
                displayName: profileData.displayName || '',
                photoURL: profileData.photoURL || null,
                bio: '',

                // Profile completion tracking
                profileComplete: false,
                setupStep: 0,

                // Profile data
                interests: [],
                availability: [
                    // Default: Available on weekends, afternoons
                    {
                        day: 'Saturday',
                        slots: ['Afternoon (12PM - 5PM)']
                    },
                    {
                        day: 'Sunday',
                        slots: ['Afternoon (12PM - 5PM)']
                    }
                ],
                location: null,
                preferences: {
                    radius: 10,
                    language: 'English',
                    genderPreference: 'Any',
                    ageRange: { min: 18, max: 65 }
                },

                // Stats
                stats: {
                    joinedGroups: 0,
                    createdGroups: 0,
                    upcomingActivities: 0
                },

                // Timestamps (handled by Firestore)
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const profile = { ...defaultProfile, ...profileData };

            await firestoreService.setDocument(this.COLLECTION_NAME, uid, profile);

            this.currentProfile = profile;
            this.setCachedProfile(profile);

            console.log('✅ Profile created successfully');
            return profile;
        } catch (error) {
            console.error('❌ Error creating profile:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     * @param {string} uid - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateProfile(uid, updates) {
        try {
            await firestoreService.updateDocument(this.COLLECTION_NAME, uid, updates);

            // Update cache
            if (this.currentProfile && this.currentProfile.uid === uid) {
                this.currentProfile = { ...this.currentProfile, ...updates };
                this.setCachedProfile(this.currentProfile);
            }

            console.log('✅ Profile updated successfully');
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            throw error;
        }
    }

    /**
     * Update a specific step in profile setup
     * @param {string} uid - User ID
     * @param {number} step - Step number (1-5)
     * @param {Object} data - Step data
     * @returns {Promise<void>}
     */
    async updateProfileStep(uid, step, data) {
        try {
            const updates = {
                ...data,
                setupStep: step
            };

            // Use setDocument with merge to create document if it doesn't exist
            await firestoreService.setDocument(this.COLLECTION_NAME, uid, updates, true);

            // Update cache
            if (this.currentProfile && this.currentProfile.uid === uid) {
                this.currentProfile = { ...this.currentProfile, ...updates };
                this.setCachedProfile(this.currentProfile);
            }

            console.log(`✅ Profile step ${step} saved`);
        } catch (error) {
            console.error(`❌ Error saving profile step ${step}:`, error);
            throw error;
        }
    }

    /**
     * Mark profile as complete
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async markProfileComplete(uid) {
        try {
            // Use setDocument with merge to ensure document exists
            await firestoreService.setDocument(this.COLLECTION_NAME, uid, {
                profileComplete: true,
                setupStep: 5
            }, true);

            console.log('✅ Profile marked as complete');
        } catch (error) {
            console.error('❌ Error marking profile complete:', error);
            throw error;
        }
    }

    /**
     * Delete user profile
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async deleteProfile(uid) {
        try {
            await firestoreService.deleteDocument(this.COLLECTION_NAME, uid);

            this.currentProfile = null;
            this.clearCache();

            console.log('✅ Profile deleted successfully');
        } catch (error) {
            console.error('❌ Error deleting profile:', error);
            throw error;
        }
    }

    // ==================== Real-time Sync ====================

    /**
     * Subscribe to real-time profile updates
     * @param {string} uid - User ID
     * @param {Function} callback - Callback function (profile, error) => {}
     * @returns {Function} Unsubscribe function
     */
    subscribeToProfile(uid, callback) {
        try {
            const unsubscribe = firestoreService.onDocumentChange(
                this.COLLECTION_NAME,
                uid,
                (profile, error) => {
                    if (error) {
                        console.error('❌ Real-time profile update error:', error);
                        callback(null, error);
                        return;
                    }

                    if (profile) {
                        // CRITICAL: Ensure uid is always included in the profile object
                        const profileWithUid = {
                            ...profile,
                            uid: profile.uid || uid // Fallback to parameter uid if not in data
                        };

                        // Update cache
                        this.currentProfile = profileWithUid;
                        this.setCachedProfile(profileWithUid);

                        console.log('🔄 Real-time profile update received');
                        callback(profileWithUid, null);
                    } else {
                        callback(null, null);
                    }
                }
            );

            return unsubscribe;
        } catch (error) {
            console.error('❌ Error subscribing to profile:', error);
            callback(null, error);
            return () => { }; // Return empty unsubscribe function
        }
    }
    /**
     * Unsubscribe from profile updates
     */
    unsubscribe() {
        if (this.profileListener) {
            this.profileListener();
            this.profileListener = null;
            console.log('🔇 Unsubscribed from profile updates');
        }
    }

    // ==================== Cache Management ====================

    /**
     * Get cached profile from localStorage
     * @returns {Object|null} Cached profile or null
     */
    getCachedProfile() {
        try {
            const cached = localStorage.getItem('userProfile');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('❌ Error reading cached profile:', error);
            return null;
        }
    }

    /**
     * Save profile to localStorage cache
     * @param {Object} profile - Profile data
     */
    setCachedProfile(profile) {
        try {
            localStorage.setItem('userProfile', JSON.stringify(profile));
            console.log('💾 Profile cached to localStorage');
        } catch (error) {
            console.error('❌ Error caching profile:', error);
        }
    }

    /**
     * Clear cached profile
     */
    clearCache() {
        try {
            localStorage.removeItem('userProfile');
            this.currentProfile = null;
            console.log('🗑️ Profile cache cleared');
        } catch (error) {
            console.error('❌ Error clearing cache:', error);
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Check if profile is complete
     * @param {Object} profile - Profile object
     * @returns {boolean} True if profile is complete
     */
    isProfileComplete(profile) {
        if (!profile) return false;
        return profile.profileComplete === true;
    }

    /**
     * Get current profile setup step
     * @param {Object} profile - Profile object
     * @returns {number} Current step (0-5)
     */
    getCurrentStep(profile) {
        if (!profile) return 0;
        return profile.setupStep || 0;
    }

    /**
     * Validate profile data
     * @param {Object} profile - Profile object
     * @returns {Object} {valid: boolean, errors: string[]}
     */
    validateProfile(profile) {
        const errors = [];

        if (!profile.displayName || profile.displayName.trim().length === 0) {
            errors.push('Display name is required');
        }

        if (!profile.email || !profile.email.includes('@')) {
            errors.push('Valid email is required');
        }

        if (profile.interests && profile.interests.length === 0) {
            errors.push('At least one interest is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get current user's profile
     * @returns {Promise<Object|null>} Current user's profile
     */
    async getCurrentUserProfile() {
        const user = auth.currentUser;
        if (!user) {
            console.warn('⚠️ No authenticated user');
            return null;
        }

        return await this.getUserProfile(user.uid);
    }
}

// Create singleton instance
export const profileService = new ProfileService();

// Export for debugging
window.profileService = profileService;

console.log('✅ Profile Service initialized');
