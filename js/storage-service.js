// Storage Service - Firebase Storage for Profile Photos
import { storage } from './firebase-config.js';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

class StorageService {
    constructor() {
        this.PROFILE_PHOTOS_PATH = 'profile-photos';
        this.MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        this.ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    }

    // ==================== Photo Upload ====================

    /**
     * Upload profile photo to Firebase Storage
     * @param {string} uid - User ID
     * @param {File} file - Image file
     * @param {Function} onProgress - Progress callback (percent)
     * @returns {Promise<string>} Download URL
     */
    async uploadProfilePhoto(uid, file, onProgress = null) {
        try {
            // Validate file
            this.validateFile(file);

            // Create storage reference
            const fileName = `${uid}_${Date.now()}.${this.getFileExtension(file.name)}`;
            const storageRef = ref(storage, `${this.PROFILE_PHOTOS_PATH}/${fileName}`);



            // Upload file with progress tracking
            const uploadTask = uploadBytesResumable(storageRef, file);

            return new Promise((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    (snapshot) => {
                        // Progress callback
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;


                        if (onProgress) {
                            onProgress(progress);
                        }
                    },
                    (error) => {
                        // Error callback
                        console.error('❌ Upload error:', error);
                        reject(this.handleError(error));
                    },
                    async () => {
                        // Success callback
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                            resolve(downloadURL);
                        } catch (error) {
                            console.error('❌ Error getting download URL:', error);
                            reject(error);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('❌ Error uploading photo:', error);
            throw error;
        }
    }

    /**
     * Delete profile photo from Firebase Storage
     * @param {string} photoURL - Photo URL to delete
     * @returns {Promise<void>}
     */
    async deleteProfilePhoto(photoURL) {
        try {
            if (!photoURL) {
                console.warn('⚠️ No photo URL provided');
                return;
            }

            // Extract file path from URL
            const photoRef = ref(storage, photoURL);

            await deleteObject(photoRef);

        } catch (error) {
            // If photo doesn't exist, that's okay
            if (error.code === 'storage/object-not-found') {

                return;
            }

            console.error('❌ Error deleting photo:', error);
            throw error;
        }
    }

    /**
     * Get download URL for a photo
     * @param {string} uid - User ID
     * @returns {Promise<string|null>} Download URL or null
     */
    async getPhotoURL(uid) {
        try {
            const storageRef = ref(storage, `${this.PROFILE_PHOTOS_PATH}/${uid}`);
            const url = await getDownloadURL(storageRef);
            return url;
        } catch (error) {
            if (error.code === 'storage/object-not-found') {

                return null;
            }

            console.error('❌ Error getting photo URL:', error);
            return null;
        }
    }

    // ==================== Validation ====================

    /**
     * Validate uploaded file
     * @param {File} file - File to validate
     * @throws {Error} If file is invalid
     */
    validateFile(file) {
        // Check if file exists
        if (!file) {
            throw new Error('No file provided');
        }

        // Check file type
        if (!this.ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
        }

        // Check file size
        if (file.size > this.MAX_FILE_SIZE) {
            const sizeMB = (this.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
            throw new Error(`File too large. Maximum size is ${sizeMB}MB.`);
        }


    }

    /**
     * Get file extension from filename
     * @param {string} filename - File name
     * @returns {string} File extension
     */
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // ==================== Image Processing ====================

    /**
     * Compress and resize image before upload
     * @param {File} file - Image file
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @param {number} quality - JPEG quality (0-1)
     * @returns {Promise<Blob>} Compressed image blob
     */
    async compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }

                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {

                                resolve(blob);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };

                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };

                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Upload with automatic compression
     * @param {string} uid - User ID
     * @param {File} file - Image file
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<string>} Download URL
     */
    async uploadCompressedPhoto(uid, file, onProgress = null) {
        try {

            const compressedBlob = await this.compressImage(file);

            // Convert blob to file
            const compressedFile = new File([compressedBlob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });

            return await this.uploadProfilePhoto(uid, compressedFile, onProgress);
        } catch (error) {
            console.error('❌ Error uploading compressed photo:', error);
            throw error;
        }
    }

    // ==================== Error Handling ====================

    /**
     * Handle Storage errors with user-friendly messages
     * @param {Error} error - Storage error
     * @returns {Error} Formatted error
     */
    handleError(error) {
        const errorMessages = {
            'storage/unauthorized': 'You do not have permission to upload photos.',
            'storage/canceled': 'Upload was cancelled.',
            'storage/unknown': 'An unknown error occurred during upload.',
            'storage/object-not-found': 'Photo not found.',
            'storage/quota-exceeded': 'Storage quota exceeded.',
            'storage/unauthenticated': 'Please log in to upload photos.'
        };

        const message = errorMessages[error.code] || error.message || 'Failed to upload photo. Please try again.';
        return new Error(message);
    }
}

// Create singleton instance
export const storageService = new StorageService();

// Export for debugging
window.storageService = storageService;


