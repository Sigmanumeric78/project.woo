// Join Request Service - Manages group join requests in Firestore
import { firestoreService } from './firestore-service.js';
import { auth } from './firebase-config.js';
import { serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class JoinRequestService {
    constructor() {
        this.collectionName = 'joinRequests';
        this._unsubscribers = new Map();
    }

    /**
     * Send a join request to a group
     * @param {Object} group - Full group object
     * @param {Object} requester - Firebase auth user object
     * @param {string} message - Optional intro message
     * @returns {Promise<string>} Request ID
     */
    async sendRequest(group, requester, message = '') {
        // Check for existing pending/approved request
        const existing = await this.getUserRequestForGroup(requester.uid, group.id);
        if (existing) {
            if (existing.status === 'pending') throw new Error('You already have a pending request for this group.');
            if (existing.status === 'approved') throw new Error('Your request was already approved!');
            // If rejected, allow re-applying — delete old one first
            await firestoreService.deleteDocument(this.collectionName, existing.id);
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const requestData = {
            groupId: group.id,
            groupName: group.name,
            creatorId: group.creatorId,
            requesterId: requester.uid,
            requesterName: requester.displayName || requester.email.split('@')[0],
            requesterEmail: requester.email, // protected: only readable by requester/creator
            requesterPhotoURL: requester.photoURL || null,
            message: message.trim(),
            status: 'pending', // 'pending' | 'approved' | 'rejected'
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await firestoreService.setDocument(this.collectionName, requestId, requestData);
        console.log('✅ Join request sent:', requestId);

        return requestId;
    }

    /**
     * Get a specific user's request for a specific group
     * @param {string} userId
     * @param {string} groupId
     * @returns {Promise<Object|null>}
     */
    async getUserRequestForGroup(userId, groupId) {
        try {
            const results = await firestoreService.queryDocuments(this.collectionName, [
                { field: 'requesterId', operator: '==', value: userId },
                { field: 'groupId', operator: '==', value: groupId }
            ]);
            return results.length > 0 ? results[0] : null;
        } catch (e) {
            console.warn('Could not check existing request:', e);
            return null;
        }
    }

    /**
     * Get all pending requests for groups where userId is the creator
     * @param {string} creatorId
     * @returns {Promise<Array>}
     */
    async getRequestsForCreator(creatorId) {
        return firestoreService.queryDocuments(this.collectionName, [
            { field: 'creatorId', operator: '==', value: creatorId }
        ]);
    }

    /**
     * Get all requests made by a specific user.
     * Auto-prunes resolved (approved/rejected) requests older than 7 days.
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getRequestsByUser(userId) {
        const results = await firestoreService.queryDocuments(this.collectionName, [
            { field: 'requesterId', operator: '==', value: userId }
        ]);
        // Background cleanup — fire-and-forget
        this.pruneResolvedRequests(results).catch(() => {});
        return results;
    }

    /**
     * Approve a join request — adds user to group members
     * @param {string} requestId
     * @param {string} creatorId - Must match the creator
     * @returns {Promise<Object>} The approved request (for email building)
     */
    async approveRequest(requestId, creatorId) {
        const request = await firestoreService.getDocument(this.collectionName, requestId);
        if (!request) throw new Error('Request not found.');
        if (request.creatorId !== creatorId) throw new Error('Only the group creator can approve requests.');
        if (request.status !== 'pending') throw new Error('Request is no longer pending.');

        // Import groupService dynamically to avoid circular deps
        const { groupService } = await import('./group-service.js');

        // Add user to group
        await groupService.joinGroup(request.groupId, request.requesterId);

        // Update request status
        await firestoreService.updateDocument(this.collectionName, requestId, {
            status: 'approved',
            updatedAt: serverTimestamp()
        });

        // Notify the requester
        const { notificationService } = await import('./notification-service.js');
        await notificationService.addNotification(request.requesterId, {
            type: 'request_approved',
            groupId: request.groupId,
            groupName: request.groupName,
            message: `🎉 Your request to join "${request.groupName}" has been approved!`,
            read: false
        });

        console.log('✅ Request approved:', requestId);

        // Send approval email (graceful fail)
        try {
            const { emailService } = await import('./email-service.js');
            const groupData = await firestoreService.getDocument('groups', request.groupId);
            if (groupData) {
                const privateLink = groupData.privateLink || 'No private chat link provided by the creator.';
                await emailService.sendApprovalEmail(
                    request.requesterEmail,
                    request.requesterName || 'Member',
                    request.groupName,
                    privateLink
                ).catch(err => console.warn('Approval email silently failed:', err));
            }
        } catch (e) { console.warn('Approval email skipped:', e); }

        return request;
    }

    /**
     * Reject a join request
     * @param {string} requestId
     * @param {string} creatorId
     * @returns {Promise<void>}
     */
    async rejectRequest(requestId, creatorId) {
        const request = await firestoreService.getDocument(this.collectionName, requestId);
        if (!request) throw new Error('Request not found.');
        if (request.creatorId !== creatorId) throw new Error('Only the group creator can reject requests.');
        if (request.status !== 'pending') throw new Error('Request is no longer pending.');

        await firestoreService.updateDocument(this.collectionName, requestId, {
            status: 'rejected',
            updatedAt: serverTimestamp()
        });

        const { notificationService } = await import('./notification-service.js');
        await notificationService.addNotification(request.requesterId, {
            type: 'request_rejected',
            groupId: request.groupId,
            groupName: request.groupName,
            message: `Your request to join "${request.groupName}" was not approved at this time.`,
            read: false
        });

        console.log('✅ Request rejected:', requestId);

        // Send rejection email (graceful fail)
        try {
            const { emailService } = await import('./email-service.js');
            await emailService.sendRejectionEmail(
                request.requesterEmail,
                request.requesterName || 'Member',
                request.groupName
            ).catch(err => console.warn('Rejection email silently failed:', err));
        } catch (e) {}
    }

    /**
     * Auto-prune resolved join requests (approved or rejected) older than PRUNE_AFTER_DAYS.
     * @param {Array} requests - Already-fetched request list
     */
    async pruneResolvedRequests(requests = []) {
        const PRUNE_AFTER_DAYS = 7;
        const cutoff = Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;

        const stale = requests.filter(r => {
            if (r.status !== 'approved' && r.status !== 'rejected') return false;
            const ts = r.updatedAt?.seconds
                ? r.updatedAt.seconds * 1000
                : r.updatedAt instanceof Date
                    ? r.updatedAt.getTime()
                    : null;
            return ts !== null && ts < cutoff;
        });

        if (stale.length === 0) return;

        console.log(`🗑️ Pruning ${stale.length} resolved join request(s) older than ${PRUNE_AFTER_DAYS} days`);
        await Promise.allSettled(
            stale.map(r => firestoreService.deleteDocument(this.collectionName, r.id)
                .catch(e => console.warn('Could not prune request:', e.message))
            )
        );
    }

    /**
     * Count pending requests for a creator — used for navbar badge (one-time)
     * @param {string} creatorId
     * @returns {Promise<number>}
     */
    async getPendingCount(creatorId) {
        try {
            const requests = await firestoreService.queryDocuments(this.collectionName, [
                { field: 'creatorId', operator: '==', value: creatorId },
                { field: 'status',    operator: '==', value: 'pending' }
            ]);
            return requests.length;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Real-time listener for pending request count (navbar badge).
     * Fires immediately, then on every change.
     * @param {string}   creatorId
     * @param {Function} callback  - (count: number) => void
     * @returns {Function} unsubscribe
     */
    subscribeToPendingCount(creatorId, callback) {
        const key = `pendingCount_${creatorId}`;
        if (this._unsubscribers.has(key)) this._unsubscribers.get(key)();

        const unsub = firestoreService.onCollectionChange(
            this.collectionName,
            [
                { field: 'creatorId', operator: '==', value: creatorId },
                { field: 'status',    operator: '==', value: 'pending' }
            ],
            (docs) => callback(docs.length)
        );

        this._unsubscribers.set(key, unsub);
        return () => { unsub(); this._unsubscribers.delete(key); };
    }

    /**
     * Real-time listener for a user's own request on a specific group.
     * @param {string}   userId
     * @param {string}   groupId
     * @param {Function} callback  - (request: Object|null) => void
     * @returns {Function} unsubscribe
     */
    subscribeToUserRequest(userId, groupId, callback) {
        const key = `userReq_${userId}_${groupId}`;
        if (this._unsubscribers.has(key)) this._unsubscribers.get(key)();

        const unsub = firestoreService.onCollectionChange(
            this.collectionName,
            [
                { field: 'requesterId', operator: '==', value: userId },
                { field: 'groupId',     operator: '==', value: groupId }
            ],
            (docs) => callback(docs.length > 0 ? docs[0] : null)
        );

        this._unsubscribers.set(key, unsub);
        return () => { unsub(); this._unsubscribers.delete(key); };
    }

    /** Cleanup all listeners */
    cleanup() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers.clear();
    }
}

export const joinRequestService = new JoinRequestService();

window.addEventListener('beforeunload', () => joinRequestService.cleanup());
console.log('✅ Join Request Service initialized (with real-time support)');
