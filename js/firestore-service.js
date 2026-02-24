// Firestore Service - Core Database Operations
import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    writeBatch,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class FirestoreService {
    constructor() {
        this.listeners = new Map(); // Track active listeners
    }

    // ==================== Document Operations ====================

    /**
     * Get a single document from Firestore
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @returns {Promise<Object|null>} Document data or null if not found
     */
    async getDocument(collectionName, docId) {
        try {
            const docRef = doc(db, collectionName, docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Ensure uid is included (especially important for users collection)
                return {
                    id: docSnap.id,
                    uid: data.uid || docSnap.id, // Use uid from data or fallback to doc id
                    ...data
                };
            }

            console.warn(`Document ${collectionName}/${docId} not found`);
            return null;
        } catch (error) {
            console.error(`Error getting document ${collectionName}/${docId}:`, error);
            throw this.handleError(error);
        }
    }

    /**
     * Set/Create a document in Firestore
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @param {Object} data - Document data
     * @param {boolean} merge - Whether to merge with existing data
     * @returns {Promise<void>}
     */
    async setDocument(collectionName, docId, data, merge = false) {
        try {
            const docRef = doc(db, collectionName, docId);
            const dataWithTimestamp = {
                ...data,
                updatedAt: serverTimestamp()
            };

            await setDoc(docRef, dataWithTimestamp, { merge });
            console.log(`✅ Firestore SET success: ${collectionName}/${docId}`);

        } catch (error) {
            console.error(`Error setting document ${collectionName}/${docId}:`, error);
            throw this.handleError(error);
        }
    }

    /**
     * Update specific fields in a document
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateDocument(collectionName, docId, updates) {
        try {
            const docRef = doc(db, collectionName, docId);
            const updatesWithTimestamp = {
                ...updates,
                updatedAt: serverTimestamp()
            };

            await updateDoc(docRef, updatesWithTimestamp);

        } catch (error) {
            console.error(`Error updating document ${collectionName}/${docId}:`, error);
            throw this.handleError(error);
        }
    }

    /**
     * Delete a document from Firestore
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @returns {Promise<void>}
     */
    async deleteDocument(collectionName, docId) {
        try {
            const docRef = doc(db, collectionName, docId);
            await deleteDoc(docRef);

        } catch (error) {
            console.error(`Error deleting document ${collectionName}/${docId}:`, error);
            throw this.handleError(error);
        }
    }

    // ==================== Query Operations ====================

    /**
     * Query documents with filters
     * @param {string} collectionName - Collection name
     * @param {Array} filters - Array of filter objects [{field, operator, value}]
     * @returns {Promise<Array>} Array of documents
     */
    async queryDocuments(collectionName, filters = []) {
        try {
            const collectionRef = collection(db, collectionName);
            let q = collectionRef;

            // Apply filters
            if (filters.length > 0) {
                const constraints = filters.map(f => where(f.field, f.operator, f.value));
                q = query(collectionRef, ...constraints);
            }

            const querySnapshot = await getDocs(q);
            console.log(`✅ Firestore QUERY success: ${collectionName}, found ${querySnapshot.size} docs`);
            const documents = [];

            querySnapshot.forEach((doc) => {
                documents.push({ id: doc.id, ...doc.data() });
            });


            return documents;
        } catch (error) {
            console.error(`Error querying ${collectionName}:`, error);
            throw this.handleError(error);
        }
    }

    // ==================== Real-time Listeners ====================

    /**
     * Subscribe to real-time updates for a document
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @param {Function} callback - Callback function(data)
     * @returns {Function} Unsubscribe function
     */
    onDocumentChange(collectionName, docId, callback) {
        try {
            const docRef = doc(db, collectionName, docId);
            const listenerId = `${collectionName}/${docId}`;

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    callback(data);
                } else {
                    callback(null);
                }
            }, (error) => {
                console.error(`Error in listener for ${listenerId}:`, error);
                callback(null, error);
            });

            // Store listener for cleanup
            this.listeners.set(listenerId, unsubscribe);



            // Return unsubscribe function
            return () => {
                unsubscribe();
                this.listeners.delete(listenerId);

            };
        } catch (error) {
            console.error(`Error setting up listener for ${collectionName}/${docId}:`, error);
            throw this.handleError(error);
        }
    }

    /**
     * Subscribe to real-time updates for a collection query
     * @param {string} collectionName - Collection name
     * @param {Array} filters - Array of filter objects
     * @param {Function} callback - Callback function(documents)
     * @returns {Function} Unsubscribe function
     */
    onCollectionChange(collectionName, filters = [], callback) {
        try {
            const collectionRef = collection(db, collectionName);
            let q = collectionRef;

            // Apply filters
            if (filters.length > 0) {
                const constraints = filters.map(f => where(f.field, f.operator, f.value));
                q = query(collectionRef, ...constraints);
            }

            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const documents = [];
                querySnapshot.forEach((doc) => {
                    documents.push({ id: doc.id, ...doc.data() });
                });
                callback(documents);
            }, (error) => {
                console.error(`Error in collection listener for ${collectionName}:`, error);
                callback([], error);
            });

            const listenerId = `${collectionName}_collection`;
            this.listeners.set(listenerId, unsubscribe);



            return () => {
                unsubscribe();
                this.listeners.delete(listenerId);

            };
        } catch (error) {
            console.error(`Error setting up collection listener for ${collectionName}:`, error);
            throw this.handleError(error);
        }
    }

    // ==================== Batch Operations ====================

    /**
     * Perform batch write operations
     * @param {Array} operations - Array of {type, collection, docId, data}
     * @returns {Promise<void>}
     */
    async batchWrite(operations) {
        try {
            const batch = writeBatch(db);

            operations.forEach(op => {
                const docRef = doc(db, op.collection, op.docId);

                switch (op.type) {
                    case 'set':
                        batch.set(docRef, { ...op.data, updatedAt: serverTimestamp() }, { merge: op.merge || false });
                        break;
                    case 'update':
                        batch.update(docRef, { ...op.data, updatedAt: serverTimestamp() });
                        break;
                    case 'delete':
                        batch.delete(docRef);
                        break;
                    default:
                        console.warn(`Unknown batch operation type: ${op.type}`);
                }
            });

            await batch.commit();

        } catch (error) {
            console.error('Error in batch write:', error);
            throw this.handleError(error);
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Cleanup all active listeners
     */
    cleanup() {
        this.listeners.forEach((unsubscribe, listenerId) => {
            unsubscribe();

        });
        this.listeners.clear();
    }

    /**
     * Handle Firestore errors with user-friendly messages
     * @param {Error} error - Firestore error
     * @returns {Error} Formatted error
     */
    handleError(error) {
        const errorMessages = {
            'permission-denied': 'You do not have permission to perform this action.',
            'not-found': 'The requested data was not found.',
            'already-exists': 'This data already exists.',
            'failed-precondition': 'Operation failed. Please try again.',
            'unavailable': 'Service temporarily unavailable. Please check your connection.',
            'unauthenticated': 'Please log in to continue.'
        };

        const message = errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
        return new Error(message);
    }
}

// Create singleton instance
export const firestoreService = new FirestoreService();

// Export for debugging
window.firestoreService = firestoreService;


