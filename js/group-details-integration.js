// Group Details Integration - Load and Display Group Details
import { groupService } from './group-service.js';
import { auth } from './firebase-config.js';
import { profileService } from './profile-service.js';

console.log('📄 Group Details Integration loaded');

let currentGroup = null;
let currentUser = null;

// Wait for authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.warn('⚠️ No authenticated user, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }

    console.log('✅ User authenticated:', user.email);
    currentUser = user;

    // Get group ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');

    if (!groupId) {
        console.error('❌ No group ID in URL');
        showError('Group not found. Please check the URL.');
        return;
    }

    // Load group details
    await loadGroupDetails(groupId);
});

/**
 * Load group details from Firestore
 * @param {string} groupId - Group ID
 */
async function loadGroupDetails(groupId) {
    try {
        console.log('📊 Loading group details:', groupId);

        // Show loading state
        document.getElementById('loading').style.display = 'block';
        document.getElementById('content').style.display = 'none';

        // Fetch group from Firestore
        const group = await groupService.getGroup(groupId);

        if (!group) {
            throw new Error('Group not found');
        }

        currentGroup = group;
        console.log('✅ Group loaded:', group.name);

        // Update UI
        updateGroupUI(group);

        // Hide loading, show content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'grid';

    } catch (error) {
        console.error('❌ Error loading group:', error);
        showError(error.message || 'Failed to load group details');
    }
}

/**
 * Update UI with group data
 * @param {Object} group - Group object
 */
function updateGroupUI(group) {
    // Basic Info
    document.getElementById('gd-name').textContent = group.name;
    document.getElementById('gd-category').textContent = group.category;
    document.getElementById('gd-desc').textContent = group.description;
    document.getElementById('gd-members').textContent = `${group.memberCount} Members`;

    // Hero color based on category
    const categoryColors = {
        'Sports': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'Education': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'Social': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'Arts': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'Technology': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'Health': 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
        'Other': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    };

    const heroColor = document.getElementById('gd-hero-color');
    if (heroColor) {
        heroColor.style.background = categoryColors[group.category] || categoryColors['Other'];
        heroColor.textContent = group.name.charAt(0).toUpperCase();
    }

    const hero = document.getElementById('gd-hero');
    if (hero) {
        hero.style.background = categoryColors[group.category] || categoryColors['Other'];
    }

    // Tags
    const tagsContainer = document.getElementById('gd-tags');
    if (tagsContainer && group.tags && group.tags.length > 0) {
        tagsContainer.innerHTML = group.tags.map(tag => `
            <span class="tag">${tag}</span>
        `).join('');
    } else if (tagsContainer) {
        tagsContainer.innerHTML = '<p style="color: var(--text-muted);">No tags added</p>';
    }

    // Schedule
    const timeElement = document.getElementById('gd-time');
    if (timeElement) {
        if (group.schedule.day && group.schedule.time) {
            const recurring = group.schedule.recurring ? ' (Weekly)' : '';
            timeElement.textContent = `${group.schedule.day} at ${group.schedule.time}${recurring}`;
        } else {
            timeElement.textContent = 'Not scheduled';
        }
    }

    // Location
    const locationElement = document.getElementById('gd-location');
    if (locationElement) {
        locationElement.textContent = `${group.location.city}, ${group.location.state}`;
    }

    // Distance (placeholder - would need user location)
    const distanceElement = document.getElementById('gd-distance');
    if (distanceElement) {
        distanceElement.textContent = 'Location nearby';
    }

    // Skill Level
    const skillElement = document.getElementById('gd-skill');
    if (skillElement) {
        skillElement.textContent = group.skillLevel;
    }

    // Privacy
    const privacyElement = document.getElementById('gd-privacy');
    if (privacyElement) {
        privacyElement.textContent = group.privacy === 'open' ? 'Open' : 'Closed';
    }

    // Update join button
    updateJoinButton(group);

    // Show WhatsApp button if user is member and link exists
    if (groupService.isMember(group, currentUser.uid) && group.whatsappLink) {
        showWhatsAppButton(group.whatsappLink);
    }

    // Show admin controls ONLY if user is the creator
    if (group.createdBy === currentUser.uid) {
        showAdminControls(group);
    }
}

/**
 * Update join/leave button based on membership
 * @param {Object} group - Group object
 */
function updateJoinButton(group) {
    const joinBtn = document.getElementById('gd-join-btn');
    if (!joinBtn) return;

    const isMember = groupService.isMember(group, currentUser.uid);

    if (isMember) {
        joinBtn.textContent = 'Leave Group';
        joinBtn.className = 'btn btn-secondary';
        joinBtn.onclick = () => handleLeaveGroup(group.id);
    } else {
        joinBtn.textContent = group.privacy === 'open' ? 'Join Group' : 'Request to Join';
        joinBtn.className = 'btn btn-primary';
        joinBtn.onclick = () => handleJoinGroup(group.id);
    }
}

/**
 * Show WhatsApp button
 * @param {string} whatsappLink - WhatsApp group link
 */
function showWhatsAppButton(whatsappLink) {
    // Create WhatsApp button if it doesn't exist
    let whatsappBtn = document.getElementById('whatsapp-btn');

    if (!whatsappBtn) {
        const joinBtn = document.getElementById('gd-join-btn');
        whatsappBtn = document.createElement('a');
        whatsappBtn.id = 'whatsapp-btn';
        whatsappBtn.className = 'btn btn-success';
        whatsappBtn.style.cssText = 'width: 100%; justify-content: center; margin-top: 12px; background: #25D366; color: white;';
        whatsappBtn.innerHTML = '📱 Join WhatsApp Group';
        whatsappBtn.target = '_blank';
        whatsappBtn.rel = 'noopener noreferrer';

        if (joinBtn && joinBtn.parentNode) {
            joinBtn.parentNode.insertBefore(whatsappBtn, joinBtn.nextSibling);
        }
    }

    whatsappBtn.href = whatsappLink;
    whatsappBtn.style.display = 'flex';
}

/**
 * Show admin controls
 * @param {Object} group - Group object
 */
function showAdminControls(group) {
    // Create admin controls section if it doesn't exist
    let adminSection = document.getElementById('admin-controls');

    if (!adminSection) {
        const sidebar = document.querySelector('aside > div');
        adminSection = document.createElement('div');
        adminSection.id = 'admin-controls';
        adminSection.style.cssText = 'margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--surface-200);';
        adminSection.innerHTML = `
            <h3 style="margin-bottom: 16px; color: var(--base-white); font-size: 18px; margin-top: 0;">
                👑 Admin Controls
            </h3>
            <button id="edit-group-btn" class="btn btn-secondary" style="width: 100%; justify-content: center; margin-bottom: 8px;">
                Edit Group
            </button>
            <button id="delete-group-btn" class="btn btn-danger" style="width: 100%; justify-content: center;">
                Delete Group
            </button>
        `;

        if (sidebar) {
            sidebar.appendChild(adminSection);
        }
    }

    // Add event listeners
    const editBtn = document.getElementById('edit-group-btn');
    if (editBtn) {
        editBtn.onclick = () => handleEditGroup(group.id);
    }

    const deleteBtn = document.getElementById('delete-group-btn');
    if (deleteBtn) {
        deleteBtn.onclick = () => handleDeleteGroup(group.id);
    }

    adminSection.style.display = 'block';
}

/**
 * Handle join group
 * @param {string} groupId - Group ID
 */
async function handleJoinGroup(groupId) {
    try {
        console.log('👋 Joining group:', groupId);

        const joinBtn = document.getElementById('gd-join-btn');
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';

        await groupService.joinGroup(groupId, currentUser.uid);

        console.log('✅ Joined group successfully');
        showMessage('success', 'You have joined the group!');

        // Reload group details
        await loadGroupDetails(groupId);

    } catch (error) {
        console.error('❌ Error joining group:', error);
        showMessage('error', error.message || 'Failed to join group');

        const joinBtn = document.getElementById('gd-join-btn');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Group';
    }
}

/**
 * Handle leave group
 * @param {string} groupId - Group ID
 */
async function handleLeaveGroup(groupId) {
    if (!confirm('Are you sure you want to leave this group?')) {
        return;
    }

    try {
        console.log('👋 Leaving group:', groupId);

        const leaveBtn = document.getElementById('gd-join-btn');
        leaveBtn.disabled = true;
        leaveBtn.textContent = 'Leaving...';

        await groupService.leaveGroup(groupId, currentUser.uid);

        console.log('✅ Left group successfully');
        showMessage('success', 'You have left the group');

        // Reload group details
        await loadGroupDetails(groupId);

    } catch (error) {
        console.error('❌ Error leaving group:', error);
        showMessage('error', error.message || 'Failed to leave group');

        const leaveBtn = document.getElementById('gd-join-btn');
        leaveBtn.disabled = false;
        leaveBtn.textContent = 'Leave Group';
    }
}

/**
 * Handle edit group
 * @param {string} groupId - Group ID
 */
function handleEditGroup(groupId) {
    const modal = document.getElementById('edit-group-modal');
    const form = document.getElementById('edit-group-form');
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    if (!modal || !form) {
        console.error('Edit modal elements not found');
        return;
    }

    // Get current group data
    const group = currentGroup;
    if (!group) {
        showMessage('error', 'Group data not available');
        return;
    }

    // Pre-fill form with current values
    document.getElementById('edit-group-name').value = group.name || '';
    document.getElementById('edit-description').value = group.description || '';
    document.getElementById('edit-category').value = group.category || '';
    document.getElementById('edit-tags').value = group.tags ? group.tags.join(', ') : '';
    document.getElementById('edit-skill-level').value = group.skillLevel || 'beginner';
    document.getElementById('edit-privacy').value = group.privacy || 'open';
    document.getElementById('edit-whatsapp-link').value = group.whatsappLink || '';
    document.getElementById('edit-max-members').value = group.maxMembers || '';

    // Show modal
    modal.style.display = 'flex';

    // Close modal function
    const closeModal = () => {
        modal.style.display = 'none';
        form.reset();
    };

    // Close button handlers
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Form submit handler
    form.onsubmit = async (e) => {
        e.preventDefault();

        const saveBtn = document.getElementById('save-edit-btn');
        const originalText = saveBtn.textContent;

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            // Collect form data
            const updates = {
                name: document.getElementById('edit-group-name').value.trim(),
                description: document.getElementById('edit-description').value.trim(),
                category: document.getElementById('edit-category').value,
                tags: document.getElementById('edit-tags').value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0),
                skillLevel: document.getElementById('edit-skill-level').value,
                privacy: document.getElementById('edit-privacy').value,
                whatsappLink: document.getElementById('edit-whatsapp-link').value.trim() || null,
                maxMembers: document.getElementById('edit-max-members').value
                    ? parseInt(document.getElementById('edit-max-members').value)
                    : null,
                updatedAt: new Date()
            };

            // Validate WhatsApp link if provided
            if (updates.whatsappLink && !updates.whatsappLink.includes('chat.whatsapp.com')) {
                throw new Error('Please enter a valid WhatsApp group link');
            }

            // Validate max members
            if (updates.maxMembers && updates.maxMembers < group.memberCount) {
                throw new Error(`Max members cannot be less than current member count (${group.memberCount})`);
            }

            // Update group in Firestore
            await groupService.updateGroup(groupId, updates, currentUser.uid);

            showMessage('success', 'Group updated successfully!');
            closeModal();

            // Reload group data
            await loadGroupData(groupId);

        } catch (error) {
            console.error('Error updating group:', error);
            showMessage('error', error.message || 'Failed to update group');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    };
}

/**
 * Handle delete group
 * @param {string} groupId - Group ID
 */
async function handleDeleteGroup(groupId) {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
        return;
    }

    try {
        console.log('🗑️ Deleting group:', groupId);

        await groupService.deleteGroup(groupId, currentUser.uid);

        console.log('✅ Group deleted successfully');
        showMessage('success', 'Group deleted successfully. Redirecting...');

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

    } catch (error) {
        console.error('❌ Error deleting group:', error);
        showMessage('error', error.message || 'Failed to delete group');
    }
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showError(message) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 16px;">❌</div>
            <p style="color: var(--error);">${message}</p>
            <a href="dashboard.html" class="btn btn-primary" style="margin-top: 16px;">
                Back to Dashboard
            </a>
        `;
    }
}

/**
 * Show success or error message
 * @param {string} type - 'success', 'error', or 'info'
 * @param {string} message - Message to display
 */
function showMessage(type, message) {
    // Remove existing messages
    const existingMessage = document.querySelector('.message-banner');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message banner
    const banner = document.createElement('div');
    banner.className = 'message-banner';
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
    `;

    if (type === 'success') {
        banner.style.background = 'var(--success)';
        banner.style.color = 'white';
        banner.textContent = '✅ ' + message;
    } else if (type === 'error') {
        banner.style.background = 'var(--error)';
        banner.style.color = 'white';
        banner.textContent = '❌ ' + message;
    } else {
        banner.style.background = 'var(--primary)';
        banner.style.color = 'white';
        banner.textContent = 'ℹ️ ' + message;
    }

    document.body.appendChild(banner);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        banner.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => banner.remove(), 300);
    }, 5000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    @keyframes slideUp {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }

    .tag {
        display: inline-block;
        padding: 6px 12px;
        background: var(--surface-200);
        color: var(--base-white);
        border-radius: 20px;
        font-size: 14px;
        margin-right: 8px;
        margin-bottom: 8px;
    }
`;
document.head.appendChild(style);

console.log('✅ Group Details Integration ready');
