// Edit Group Integration - Handle Group Updates
import { groupService } from './group-service.js';
import { auth } from './firebase-config.js';

console.log('📝 Edit Group Integration loaded');

// Get group ID from URL
const urlParams = new URLSearchParams(window.location.search);
const groupId = urlParams.get('id');

// Wait for authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.warn('⚠️ No authenticated user, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }

    if (!groupId) {
        console.error('❌ No group ID provided for editing');
        window.location.href = 'dashboard.html';
        return;
    }

    console.log('✅ User authenticated:', user.email);

    // Initialize form
    initEditGroupForm(user, groupId);
});

/**
 * Initialize edit group form
 * @param {Object} user - Firebase user object
 * @param {string} groupId - Group ID to edit
 */
async function initEditGroupForm(user, groupId) {
    const form = document.getElementById('edit-group-form');

    if (!form) {
        console.error('❌ Edit group form not found');
        return;
    }

    // Load existing group data
    await loadGroupData(groupId, user.uid);

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleUpdateGroup(groupId, user.uid);
    });

    console.log('✅ Edit group form initialized');
}

/**
 * Load group data and pre-fill form
 * @param {string} groupId - Group ID
 * @param {string} userId - Current user ID
 */
async function loadGroupData(groupId, userId) {
    try {
        const group = await groupService.getGroup(groupId);

        if (!group) {
            throw new Error('Group not found');
        }

        // Verify creator
        if (group.creatorId !== userId) {
            alert('Only the group creator can edit this group.');
            window.location.href = `group-details.html?id=${groupId}`;
            return;
        }

        // Pre-fill form
        document.getElementById('group-name').value = group.name || '';
        document.getElementById('group-description').value = group.description || '';
        document.getElementById('group-category').value = group.category || '';
        document.getElementById('group-city').value = group.location?.city || '';
        document.getElementById('group-state').value = group.location?.state || '';
        document.getElementById('group-pincode').value = group.location?.pinCode || '';

        if (group.schedule) {
            document.getElementById('schedule-day').value = group.schedule.day || '';
            document.getElementById('schedule-time').value = group.schedule.time || '';
            document.getElementById('schedule-recurring').checked = !!group.schedule.recurring;
            if (group.schedule.endTime) {
                document.getElementById('schedule-end-time').value = group.schedule.endTime;
            }
        }

        document.getElementById('skill-level').value = group.skillLevel || 'beginner';
        document.getElementById('language').value = group.language || 'English';
        document.getElementById('group-privacy').value = group.privacy || 'open';

        if (group.maxMembers) {
            document.getElementById('max-members').value = group.maxMembers;
        }

        if (group.tags && Array.isArray(group.tags)) {
            document.getElementById('group-tags').value = group.tags.join(', ');
        }

        document.getElementById('whatsapp-link').value = group.whatsappLink || '';

        console.log('✅ Group data loaded and form pre-filled');
    } catch (error) {
        console.error('❌ Error loading group:', error);
        showMessage('error', 'Failed to load group details.');
    }
}

/**
 * Handle edit group form submission
 * @param {string} groupId - Group ID to update
 * @param {string} userId - User ID
 */
async function handleUpdateGroup(groupId, userId) {
    try {
        console.log('📝 Updating group...');

        // Show loading state
        const submitBtn = document.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        // Collect form data
        const formData = collectFormData();

        // Validate form data
        const validation = validateFormData(formData);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Prepare updates (note: coordinates remain unchanged unless specifically modified, 
        // to fully support moving locations we would re-geocode here, but for now we preserve existing)
        const group = await groupService.getGroup(groupId);
        const existingCoordinates = group.location?.coordinates || null;

        const updates = {
            name: formData.name,
            description: formData.description,
            category: formData.category,
            schedule: {
                day: formData.scheduleDay,
                time: formData.scheduleTime,
                endTime: formData.scheduleEndTime || null,
                recurring: formData.scheduleRecurring
            },
            location: {
                city: formData.city,
                state: formData.state,
                pinCode: formData.pinCode,
                coordinates: existingCoordinates
            },
            tags: formData.tags,
            skillLevel: formData.skillLevel,
            language: formData.language || 'English',
            privacy: formData.privacy,
            maxMembers: formData.maxMembers,
            whatsappLink: formData.whatsappLink,
            updatedAt: new Date()
        };

        // Update group in Firestore
        await groupService.updateGroup(groupId, updates, userId);

        console.log('✅ Group updated successfully');

        // Show success message
        showMessage('success', 'Group updated successfully! Redirecting...');

        // Redirect back to group details
        setTimeout(() => {
            window.location.href = `group-details.html?id=${groupId}`;
        }, 1500);

    } catch (error) {
        console.error('❌ Error updating group:', error);
        showMessage('error', error.message || 'Failed to update group. Please try again.');

        // Reset button
        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

/**
 * Collect form data
 * @returns {Object} Form data
 */
function collectFormData() {
    return {
        name: document.getElementById('group-name').value.trim(),
        description: document.getElementById('group-description').value.trim(),
        category: document.getElementById('group-category').value,
        city: document.getElementById('group-city').value.trim(),
        state: document.getElementById('group-state').value.trim(),
        pinCode: document.getElementById('group-pincode')?.value.trim() || '',
        scheduleDay: document.getElementById('schedule-day').value,
        scheduleTime: document.getElementById('schedule-time').value,
        scheduleRecurring: document.getElementById('schedule-recurring').checked,
        skillLevel: document.getElementById('skill-level').value,
        privacy: document.getElementById('group-privacy').value,
        maxMembers: parseInt(document.getElementById('max-members').value) || null,
        whatsappLink: document.getElementById('whatsapp-link').value.trim(),
        tags: document.getElementById('group-tags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
    };
}

/**
 * Get coordinates for a city (Hardcoded for demo)
 */
function getCoordinatesForCity(city) {
    const cityMap = {
        'mathura': { lat: 27.4924, lng: 77.6737 },
        'delhi': { lat: 28.6139, lng: 77.2090 },
        'new delhi': { lat: 28.6139, lng: 77.2090 },
        'mumbai': { lat: 18.9388, lng: 72.8354 },
        'bangalore': { lat: 12.9716, lng: 77.5946 },
        'bengaluru': { lat: 12.9716, lng: 77.5946 },
        'chennai': { lat: 13.0827, lng: 80.2707 },
        'kolkata': { lat: 22.5726, lng: 88.3639 },
        'hyderabad': { lat: 17.3850, lng: 78.4867 },
        'pune': { lat: 18.5204, lng: 73.8567 },
        'ahmedabad': { lat: 23.0225, lng: 72.5714 },
        'jaipur': { lat: 26.9124, lng: 75.7873 },
        'lucknow': { lat: 26.8467, lng: 80.9462 },
        'kanpur': { lat: 26.4499, lng: 80.3319 },
        'agra': { lat: 27.1767, lng: 78.0081 }
    };

    return cityMap[city.toLowerCase()] || { lat: 28.6139, lng: 77.2090 }; // Default Delhi
}

/**
 * Validate form data
 * @param {Object} data - Form data
 * @returns {Object} Validation result {valid, error}
 */
function validateFormData(data) {
    // Required fields
    if (!data.name) {
        return { valid: false, error: 'Group name is required' };
    }

    if (!data.description) {
        return { valid: false, error: 'Description is required' };
    }

    if (!data.category) {
        return { valid: false, error: 'Category is required' };
    }

    if (!data.city) {
        return { valid: false, error: 'City is required' };
    }

    if (!data.state) {
        return { valid: false, error: 'State is required' };
    }

    // Name length
    if (data.name.length < 3) {
        return { valid: false, error: 'Group name must be at least 3 characters' };
    }

    if (data.name.length > 100) {
        return { valid: false, error: 'Group name must be less than 100 characters' };
    }

    // Description length
    if (data.description.length < 10) {
        return { valid: false, error: 'Description must be at least 10 characters' };
    }

    if (data.description.length > 1000) {
        return { valid: false, error: 'Description must be less than 1000 characters' };
    }

    // Max members validation
    if (data.maxMembers !== null && data.maxMembers < 2) {
        return { valid: false, error: 'Max members must be at least 2' };
    }

    // WhatsApp link validation
    if (data.whatsappLink && !groupService.isValidWhatsAppLink(data.whatsappLink)) {
        return { valid: false, error: 'Invalid WhatsApp link. Must be in format: https://chat.whatsapp.com/...' };
    }

    // Tags validation
    if (data.tags.length > 10) {
        return { valid: false, error: 'Maximum 10 tags allowed' };
    }

    return { valid: true };
}

/**
 * Show success or error message
 * @param {string} type - 'success' or 'error'
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
    } else {
        banner.style.background = 'var(--error)';
        banner.style.color = 'white';
        banner.textContent = '❌ ' + message;
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
`;
document.head.appendChild(style);

console.log('✅ Edit Group Integration ready');
