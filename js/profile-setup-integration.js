// Profile Setup Integration - Connects profile-setup.html to Firestore
import { profileService } from './profile-service.js';
import { auth } from './firebase-config.js';

class ProfileSetupIntegration {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the integration
     * Must be called after DOM is loaded and user is authenticated
     */
    async init() {
        try {
            // Wait for auth
            this.currentUser = auth.currentUser;

            if (!this.currentUser) {
                console.error('❌ No authenticated user found');
                window.location.href = 'login.html';
                return;
            }


            this.isInitialized = true;

            // Check for step parameter in URL
            const urlParams = new URLSearchParams(window.location.search);
            const stepParam = parseInt(urlParams.get('step'));

            if (stepParam && stepParam > 0 && stepParam <= 5) {

                // The profile-setup.html script will handle setting the current step
                return stepParam;
            }

            return 1; // Start from step 1
        } catch (error) {
            console.error('❌ Error initializing profile setup:', error);
            throw error;
        }
    }

    /**
     * Save Step 1 - Interests
     * @param {Array} interests - Selected interests
     * @returns {Promise<boolean>} Success status
     */
    async saveStep1(interests) {
        try {
            if (!this.isInitialized) {
                throw new Error('Integration not initialized');
            }



            await profileService.updateProfileStep(this.currentUser.uid, 1, {
                interests: interests
            });


            return true;
        } catch (error) {
            console.error('❌ Error saving Step 1:', error);
            alert('Failed to save interests. Please try again.');
            return false;
        }
    }

    /**
     * Save Step 2 - Availability
     * @param {Array} availability - Availability slots
     * @returns {Promise<boolean>} Success status
     */
    async saveStep2(availability) {
        try {
            if (!this.isInitialized) {
                throw new Error('Integration not initialized');
            }



            await profileService.updateProfileStep(this.currentUser.uid, 2, {
                availability: availability
            });


            return true;
        } catch (error) {
            console.error('❌ Error saving Step 2:', error);
            alert('Failed to save availability. Please try again.');
            return false;
        }
    }

    /**
     * Save Step 3 - Location
     * @param {Object} location - Location data
     * @returns {Promise<boolean>} Success status
     */
    async saveStep3(location) {
        try {
            if (!this.isInitialized) {
                throw new Error('Integration not initialized');
            }



            // Format location data
            const locationData = {
                location: {
                    latitude: location.coords?.latitude || null,
                    longitude: location.coords?.longitude || null,
                    address: location.address || '',
                    city: location.district || '',
                    state: location.state || '',
                    pinCode: location.pinCode || ''
                }
            };

            await profileService.updateProfileStep(this.currentUser.uid, 3, locationData);


            return true;
        } catch (error) {
            console.error('❌ Error saving Step 3:', error);
            alert('Failed to save location. Please try again.');
            return false;
        }
    }

    /**
     * Save Step 4 - Preferences
     * @param {Object} preferences - User preferences
     * @returns {Promise<boolean>} Success status
     */
    async saveStep4(preferences) {
        try {
            if (!this.isInitialized) {
                throw new Error('Integration not initialized');
            }



            await profileService.updateProfileStep(this.currentUser.uid, 4, {
                preferences: preferences
            });


            return true;
        } catch (error) {
            console.error('❌ Error saving Step 4:', error);
            alert('Failed to save preferences. Please try again.');
            return false;
        }
    }

    /**
     * Save Step 5 - Bio
     * @param {string} bio - User bio
     * @returns {Promise<boolean>} Success status
     */
    async saveStep5(bio) {
        try {
            if (!this.isInitialized) {
                throw new Error('Integration not initialized');
            }

            // Save bio (no photo storage — not using a paid storage service)
            const updates = {
                bio: bio || '',
                photoURL: this.currentUser.photoURL || null
            };

            await profileService.updateProfileStep(this.currentUser.uid, 5, updates);

            // Mark profile as complete
            await profileService.markProfileComplete(this.currentUser.uid);

            return true;
        } catch (error) {
            console.error('❌ Error saving Step 5:', error);
            alert('Failed to save bio. Please try again.');
            return false;
        }
    }

    /**
     * Get current user's profile
     * @returns {Promise<Object|null>} User profile
     */
    async getCurrentProfile() {
        try {
            if (!this.currentUser) {
                return null;
            }

            return await profileService.getUserProfile(this.currentUser.uid);
        } catch (error) {
            console.error('❌ Error getting profile:', error);
            return null;
        }
    }

    /**
     * Show loading state on button
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - Loading state
     */
    setButtonLoading(button, loading) {
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Saving...';
            button.disabled = true;
        } else {
            button.textContent = button.dataset.originalText || 'Next';
            button.disabled = false;
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        // You can customize this to show a toast or modal
        console.error('Error:', message);
        alert(message);
    }
}

// Create singleton instance
export const profileSetupIntegration = new ProfileSetupIntegration();

// Export for debugging
window.profileSetupIntegration = profileSetupIntegration;


