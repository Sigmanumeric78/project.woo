// Group Service - Manage Groups in Firestore
import { firestoreService } from './firestore-service.js';
import { auth } from './firebase-config.js';
import { serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class GroupService {
    constructor() {
        this.collectionName = 'groups';
    }

    // ==================== Create & Read ====================

    /**
     * Create a new group
     * @param {Object} groupData - Group data
     * @param {string} creatorUid - Creator's user ID
     * @returns {Promise<string>} Group ID
     */
    async createGroup(groupData, creatorUid) {
        try {
            console.log('📝 Creating group:', groupData.name);

            // Generate unique group ID
            const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Prepare group document
            const group = {
                // Basic Info
                name: groupData.name,
                description: groupData.description || '',
                category: groupData.category,

                // Creator & Admin
                creatorId: creatorUid,
                admins: [creatorUid],

                // Members
                members: [creatorUid], // Creator is first member
                memberCount: 1,
                maxMembers: groupData.maxMembers || null,

                // Schedule
                schedule: {
                    day: groupData.schedule?.day || '',
                    time: groupData.schedule?.time || '',
                    endTime: groupData.schedule?.endTime || null,
                    recurring: groupData.schedule?.recurring || false
                },

                // Location
                location: {
                    city: groupData.location?.city || '',
                    state: groupData.location?.state || '',
                    pinCode: groupData.location?.pinCode || '',
                    coordinates: groupData.location?.coordinates || null
                },

                // Details
                tags: groupData.tags || [],
                skillLevel: groupData.skillLevel || 'beginner',
                language: groupData.language || 'English',
                privacy: groupData.privacy || 'open',

                // WhatsApp Integration
                whatsappLink: groupData.whatsappLink || null,

                // Metadata
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Stats
                stats: {
                    totalActivities: 0,
                    activeMembers: 1
                }
            };

            // Save to Firestore
            await firestoreService.setDocument(this.collectionName, groupId, group);

            console.log('✅ Group created:', groupId);
            return groupId;
        } catch (error) {
            console.error('❌ Error creating group:', error);
            throw new Error('Failed to create group. Please try again.');
        }
    }

    /**
     * Get a single group
     * @param {string} groupId - Group ID
     * @returns {Promise<Object|null>} Group data
     */
    async getGroup(groupId) {
        try {
            const group = await firestoreService.getDocument(this.collectionName, groupId);
            return group;
        } catch (error) {
            throw new Error('Failed to load group. Please try again.');
        }
    }

    /**
     * Delete a group
     * @param {string} groupId - Group ID
     * @returns {Promise<void>}
     */
    async deleteGroup(groupId) {
        try {
            console.log('🗑️ Deleting group:', groupId);
            await firestoreService.deleteDocument(this.collectionName, groupId);
            console.log('✅ Group deleted:', groupId);
        } catch (error) {
            console.error('❌ Error deleting group:', error);
            throw new Error('Failed to delete group.');
        }
    }

    // ==================== Update & Delete ====================

    /**
     * Update group details
     * @param {string} groupId - Group ID
     * @param {Object} updates - Fields to update
     * @param {string} userId - User making the update
     * @returns {Promise<void>}
     */
    async updateGroup(groupId, updates, userId) {
        try {
            // Verify user is admin
            const group = await this.getGroup(groupId);
            if (!this.isAdmin(group, userId)) {
                throw new Error('Only admins can update the group.');
            }

            console.log('📝 Updating group:', groupId);

            // Update in Firestore
            await firestoreService.updateDocument(this.collectionName, groupId, updates);

            console.log('✅ Group updated');
        } catch (error) {
            console.error('❌ Error updating group:', error);
            throw error;
        }
    }

    /**
     * Delete a group
     * @param {string} groupId - Group ID
     * @param {string} adminUid - Admin user ID
     * @returns {Promise<void>}
     */
    async deleteGroup(groupId, adminUid) {
        try {
            // Verify user is admin
            const group = await this.getGroup(groupId);
            if (!this.isAdmin(group, adminUid)) {
                throw new Error('Only admins can delete the group.');
            }

            console.log('🗑️ Deleting group:', groupId);

            // Delete from Firestore
            await firestoreService.deleteDocument(this.collectionName, groupId);

            console.log('✅ Group deleted');
        } catch (error) {
            console.error('❌ Error deleting group:', error);
            throw error;
        }
    }

    // ==================== Member Management ====================

    /**
     * Join a group
     * @param {string} groupId - Group ID
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async joinGroup(groupId, userId) {
        try {
            const group = await this.getGroup(groupId);

            if (!group) {
                throw new Error('Group not found.');
            }

            // Check if already a member
            if (this.isMember(group, userId)) {
                throw new Error('You are already a member of this group.');
            }

            // Check if group is full
            if (group.maxMembers && group.memberCount >= group.maxMembers) {
                throw new Error('This group is full.');
            }

            console.log('👋 Joining group:', groupId);

            // Add user to members array
            const updatedMembers = [...group.members, userId];
            const updatedMemberCount = group.memberCount + 1;

            await firestoreService.updateDocument(this.collectionName, groupId, {
                members: updatedMembers,
                memberCount: updatedMemberCount,
                'stats.activeMembers': updatedMemberCount
            });

            console.log('✅ Joined group');
        } catch (error) {
            console.error('❌ Error joining group:', error);
            throw error;
        }
    }

    /**
     * Leave a group
     * @param {string} groupId - Group ID
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async leaveGroup(groupId, userId) {
        try {
            const group = await this.getGroup(groupId);

            if (!group) {
                throw new Error('Group not found.');
            }

            // Check if user is a member
            if (!this.isMember(group, userId)) {
                throw new Error('You are not a member of this group.');
            }

            // Prevent last admin from leaving
            if (this.isAdmin(group, userId) && group.admins.length === 1) {
                throw new Error('You are the only admin. Please assign another admin before leaving.');
            }

            console.log('👋 Leaving group:', groupId);

            // Remove user from members array
            const updatedMembers = group.members.filter(id => id !== userId);
            const updatedMemberCount = group.memberCount - 1;

            // Also remove from admins if applicable
            const updatedAdmins = group.admins.filter(id => id !== userId);

            await firestoreService.updateDocument(this.collectionName, groupId, {
                members: updatedMembers,
                memberCount: updatedMemberCount,
                admins: updatedAdmins,
                'stats.activeMembers': updatedMemberCount
            });

            console.log('✅ Left group');
        } catch (error) {
            console.error('❌ Error leaving group:', error);
            throw error;
        }
    }

    // ==================== Query Operations ====================

    /**
     * Get all groups a user is a member of
     * @param {string} userId - User ID
     * @returns {Promise<Array>} User's groups
     */
    async getUserGroups(userId) {
        try {
            console.log('📊 Getting user groups for:', userId);

            const filters = [
                { field: 'members', operator: 'array-contains', value: userId }
            ];

            const groups = await firestoreService.queryDocuments(this.collectionName, filters);

            console.log(`✅ Found ${groups.length} groups for user`);
            return groups;
        } catch (error) {
            console.error('❌ Error getting user groups:', error);
            throw new Error('Failed to load your groups. Please try again.');
        }
    }

    /**
     * Query groups with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Filtered groups
     */
    async queryGroups(filters = {}) {
        try {
            console.log('🔍 Querying groups with filters:', filters);

            const firestoreFilters = [];

            // Category filter
            if (filters.category && filters.category !== 'all') {
                firestoreFilters.push({
                    field: 'category',
                    operator: '==',
                    value: filters.category
                });
            }

            // Tags filter (array-contains-any supports up to 10 values)
            if (filters.tags && filters.tags.length > 0) {
                const tagsToQuery = filters.tags.slice(0, 10); // Firestore limit
                firestoreFilters.push({
                    field: 'tags',
                    operator: 'array-contains-any',
                    value: tagsToQuery
                });
            }

            // Privacy filter
            if (filters.privacy) {
                firestoreFilters.push({
                    field: 'privacy',
                    operator: '==',
                    value: filters.privacy
                });
            }

            // Skill level filter
            if (filters.skillLevel) {
                firestoreFilters.push({
                    field: 'skillLevel',
                    operator: '==',
                    value: filters.skillLevel
                });
            }

            const groups = await firestoreService.queryDocuments(this.collectionName, firestoreFilters);

            console.log(`✅ Found ${groups.length} groups`);
            return groups;
        } catch (error) {
            console.error('❌ Error querying groups:', error);
            throw new Error('Failed to load groups. Please try again.');
        }
    }

    /**
     * Search groups by name
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Matching groups
     */
    async searchGroups(searchTerm) {
        try {
            console.log('🔍 Searching groups:', searchTerm);

            // Get all groups (Firestore doesn't support full-text search)
            const allGroups = await firestoreService.queryDocuments(this.collectionName);

            // Filter client-side
            const searchLower = searchTerm.toLowerCase();
            const results = allGroups.filter(group =>
                group.name.toLowerCase().includes(searchLower) ||
                group.description.toLowerCase().includes(searchLower) ||
                group.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );

            console.log(`✅ Found ${results.length} matching groups`);
            return results;
        } catch (error) {
            console.error('❌ Error searching groups:', error);
            throw new Error('Failed to search groups. Please try again.');
        }
    }

    // ==================== Admin Operations ====================

    /**
     * Add an admin to a group
     * @param {string} groupId - Group ID
     * @param {string} userId - User to make admin
     * @param {string} currentAdminUid - Current admin making the change
     * @returns {Promise<void>}
     */
    async addAdmin(groupId, userId, currentAdminUid) {
        try {
            const group = await this.getGroup(groupId);

            // Verify current user is admin
            if (!this.isAdmin(group, currentAdminUid)) {
                throw new Error('Only admins can add other admins.');
            }

            // Check if user is already admin
            if (this.isAdmin(group, userId)) {
                throw new Error('User is already an admin.');
            }

            // Check if user is a member
            if (!this.isMember(group, userId)) {
                throw new Error('User must be a member to become an admin.');
            }

            console.log('👑 Adding admin:', userId);

            const updatedAdmins = [...group.admins, userId];

            await firestoreService.updateDocument(this.collectionName, groupId, {
                admins: updatedAdmins
            });

            console.log('✅ Admin added');
        } catch (error) {
            console.error('❌ Error adding admin:', error);
            throw error;
        }
    }

    /**
     * Remove an admin from a group
     * @param {string} groupId - Group ID
     * @param {string} userId - User to remove as admin
     * @param {string} currentAdminUid - Current admin making the change
     * @returns {Promise<void>}
     */
    async removeAdmin(groupId, userId, currentAdminUid) {
        try {
            const group = await this.getGroup(groupId);

            // Verify current user is admin
            if (!this.isAdmin(group, currentAdminUid)) {
                throw new Error('Only admins can remove other admins.');
            }

            // Prevent removing the last admin
            if (group.admins.length === 1) {
                throw new Error('Cannot remove the last admin.');
            }

            console.log('👑 Removing admin:', userId);

            const updatedAdmins = group.admins.filter(id => id !== userId);

            await firestoreService.updateDocument(this.collectionName, groupId, {
                admins: updatedAdmins
            });

            console.log('✅ Admin removed');
        } catch (error) {
            console.error('❌ Error removing admin:', error);
            throw error;
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Check if user is an admin of a group
     * @param {Object} group - Group object
     * @param {string} userId - User ID
     * @returns {boolean} Is admin
     */
    isAdmin(group, userId) {
        return group && group.admins && group.admins.includes(userId);
    }

    /**
     * Check if user is a member of a group
     * @param {Object} group - Group object
     * @param {string} userId - User ID
     * @returns {boolean} Is member
     */
    isMember(group, userId) {
        return group && group.members && group.members.includes(userId);
    }

    /**
     * Validate WhatsApp link format
     * @param {string} url - WhatsApp URL
     * @returns {boolean} Is valid
     */
    isValidWhatsAppLink(url) {
        if (!url) return true; // Optional field
        // Improved regex: must start with https://chat.whatsapp.com/ followed by alphanumeric code
        const regex = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,}$/;
        return regex.test(url);
    }

    /**
     * Subscribe to real-time group updates
     * @param {string} groupId - Group ID
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    onGroupChange(groupId, callback) {
        return firestoreService.onDocumentChange(this.collectionName, groupId, callback);
    }

    /**
     * Subscribe to real-time groups collection updates
     * @param {Array} filters - Firestore filters
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    onGroupsChange(filters, callback) {
        return firestoreService.onCollectionChange(this.collectionName, filters, callback);
    }
}

// Create singleton instance
export const groupService = new GroupService();

// Export for debugging
window.groupService = groupService;

console.log('✅ Group Service initialized');
