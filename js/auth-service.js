// Authentication Service for ECA-Connect
import { auth, googleProvider, db } from './firebase-config.js';
import { profileService } from './profile-service.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.authStateListeners = [];
        this.initAuthListener();
    }

    // Initialize auth state listener
    initAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;

            if (user) {
                console.log('✅ User authenticated:', user.email);
                await this.loadUserProfile(user.uid);

                // Notify all listeners
                this.authStateListeners.forEach(callback => callback(user, this.userProfile));
            } else {
                console.log('❌ User not authenticated');
                this.userProfile = null;
                localStorage.removeItem('userProfile');

                // Notify all listeners
                this.authStateListeners.forEach(callback => callback(null, null));
            }
        });
    }

    // Subscribe to auth state changes
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);

        // Immediately call with current state
        if (this.currentUser) {
            callback(this.currentUser, this.userProfile);
        }

        // Return unsubscribe function
        return () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }

    // Email/Password Signup
    async signupWithEmail(email, password, displayName) {
        try {
            console.log('📝 Creating account for:', email);

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update display name
            await updateProfile(user, { displayName });

            // Try to create user profile in Firestore (non-blocking)
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    displayName: displayName,
                    photoURL: null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    profileComplete: false,
                    // Default profile structure
                    interests: [],
                    availability: [],
                    location: null,
                    preferences: {
                        radius: 10,
                        language: 'English',
                        genderPreference: 'Any'
                    },
                    stats: {
                        joinedGroups: 0,
                        createdGroups: 0,
                        upcomingActivities: 0
                    }
                });
                console.log('✅ User profile created in Firestore');
            } catch (firestoreError) {
                console.warn('⚠️ Firestore profile creation failed (will retry later):', firestoreError.message);
                // Don't fail signup if Firestore is unavailable
                // Profile will be created when user completes profile-setup
            }

            console.log('✅ Account created successfully');
            return { success: true, user };
        } catch (error) {
            console.error('❌ Signup error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    // Email/Password Login
    async loginWithEmail(email, password) {
        try {
            console.log('🔐 Logging in:', email);

            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            console.log('✅ Login successful');
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    // Google OAuth Login/Signup
    async loginWithGoogle() {
        try {
            console.log('🔐 Logging in with Google...');

            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Try to check/create user profile in Firestore (non-blocking)
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));

                if (!userDoc.exists()) {
                    console.log('📝 Creating new user profile for Google user');

                    // Create new user profile
                    await setDoc(doc(db, 'users', user.uid), {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        profileComplete: false,
                        interests: [],
                        availability: [],
                        location: null,
                        preferences: {
                            radius: 10,
                            language: 'English',
                            genderPreference: 'Any'
                        },
                        stats: {
                            joinedGroups: 0,
                            createdGroups: 0,
                            upcomingActivities: 0
                        }
                    });
                    console.log('✅ User profile created in Firestore');
                } else {
                    console.log('✅ Existing user profile found');
                }
            } catch (firestoreError) {
                console.warn('⚠️ Firestore operation failed (will retry later):', firestoreError.message);
                // Don't fail login if Firestore is unavailable
            }

            console.log('✅ Google login successful');
            return { success: true, user };
        } catch (error) {
            console.error('❌ Google login error:', error);

            // Handle popup closed by user
            if (error.code === 'auth/popup-closed-by-user') {
                return { success: false, error: 'Login cancelled' };
            }

            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    // Logout
    async logout() {
        try {
            console.log('👋 Logging out...');

            await signOut(auth);
            localStorage.clear();

            console.log('✅ Logout successful');
            return { success: true };
        } catch (error) {
            console.error('❌ Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    // Load user profile from Firestore
    async loadUserProfile(uid) {
        try {
            // Use profileService for better caching and management
            const profile = await profileService.getUserProfile(uid);

            if (profile) {
                this.userProfile = profile;
                return profile;
            }

            console.warn('⚠️ User profile not found');
            // Return a minimal profile structure
            const minimalProfile = {
                uid: uid,
                profileComplete: false,
                setupStep: 0
            };
            this.userProfile = minimalProfile;
            return minimalProfile;
        } catch (error) {
            console.error('❌ Error loading profile:', error);
            // Return a minimal profile structure on error
            const minimalProfile = {
                uid: uid,
                profileComplete: false,
                setupStep: 0
            };
            this.userProfile = minimalProfile;
            return minimalProfile;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Get user profile
    getUserProfile() {
        return this.userProfile;
    }

    // Check if profile is complete
    async isProfileComplete(uid) {
        const profile = await profileService.getUserProfile(uid || this.currentUser?.uid);
        return profileService.isProfileComplete(profile);
    }

    // Get current setup step
    async getCurrentSetupStep(uid) {
        const profile = await profileService.getUserProfile(uid || this.currentUser?.uid);
        return profileService.getCurrentStep(profile);
    }

    // Get user-friendly error messages
    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Please login instead.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/operation-not-allowed': 'Operation not allowed. Please contact support.',
            'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
            'auth/popup-closed-by-user': 'Login cancelled.',
            'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.'
        };

        return errorMessages[errorCode] || 'An error occurred. Please try again.';
    }
}

// Create singleton instance
export const authService = new AuthService();

// Export for debugging
window.authService = authService;
