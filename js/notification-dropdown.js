// Notification Dropdown — Bell icon with real-time unread badge
// Import and call initNotificationDropdown(userId) from any page's module script.

import { notificationService } from './notification-service.js';

/**
 * Render a formatted relative time string.
 * @param {Object|Date|null} timestamp
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const ms = timestamp?.seconds
        ? timestamp.seconds * 1000
        : timestamp instanceof Date
            ? timestamp.getTime()
            : Date.now();
    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
}

/** HTML-escape a string */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Return icon emoji based on notification type */
function getNotifIcon(type) {
    const icons = {
        request_approved: '🎉',
        request_rejected: '❌',
        new_message: '💬',
        group_update: '📋',
        default: '🔔'
    };
    return icons[type] || icons.default;
}

/**
 * Build the notification bell element and inject it into a nav container.
 * @param {HTMLElement} navContainer - Where to append the bell button
 * @returns {{ bellBtn, dropdown }} — references to the created elements
 */
function buildBellUI(navContainer) {
    // Bell wrapper
    const wrapper = document.createElement('div');
    wrapper.id = 'notif-wrapper';
    wrapper.style.cssText = 'position: relative; display: inline-flex;';

    // Bell button
    const bellBtn = document.createElement('button');
    bellBtn.id = 'notif-bell-btn';
    bellBtn.title = 'Notifications';
    bellBtn.style.cssText = `
        background: var(--surface-100);
        border: 1.5px solid var(--surface-300);
        color: var(--base-white);
        border-radius: var(--radius-full);
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 18px;
        position: relative;
        transition: all 0.2s;
    `;
    bellBtn.innerHTML = '🔔';
    bellBtn.addEventListener('mouseenter', () => { bellBtn.style.background = 'var(--surface-200)'; bellBtn.style.borderColor = 'var(--primary-500)'; });
    bellBtn.addEventListener('mouseleave', () => { bellBtn.style.background = 'var(--surface-100)'; bellBtn.style.borderColor = 'var(--surface-300)'; });

    // Unread badge
    const badge = document.createElement('span');
    badge.id = 'notif-badge';
    badge.style.cssText = `
        position: absolute; top: -4px; right: -4px;
        background: #ef4444; color: white;
        border-radius: 999px; min-width: 18px; height: 18px;
        font-size: 10px; font-weight: 700;
        display: none; align-items: center; justify-content: center;
        padding: 0 4px; pointer-events: none;
        font-family: var(--font-body);
    `;
    bellBtn.appendChild(badge);

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.id = 'notif-dropdown';
    dropdown.style.cssText = `
        position: absolute; top: calc(100% + 10px); right: 0;
        width: 340px; max-height: 420px;
        background: var(--surface-100);
        border: 1px solid var(--surface-200);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        z-index: 500;
        display: none;
        flex-direction: column;
        overflow: hidden;
    `;

    // Dropdown header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 16px 10px;
        border-bottom: 1px solid var(--surface-200);
    `;
    header.innerHTML = `
        <span style="font-weight: 700; font-size: 14px; color: var(--base-white);">Notifications</span>
        <button id="notif-mark-all" style="
            background: none; border: none; color: var(--primary-500);
            font-size: 12px; cursor: pointer; font-family: var(--font-body);
            padding: 4px 8px; border-radius: var(--radius-full);
            transition: background 0.2s;
        ">Mark all read</button>
    `;
    header.querySelector('#notif-mark-all').addEventListener('mouseenter', e => { e.target.style.background = 'var(--surface-200)'; });
    header.querySelector('#notif-mark-all').addEventListener('mouseleave', e => { e.target.style.background = 'none'; });

    // Dropdown list
    const list = document.createElement('div');
    list.id = 'notif-list';
    list.style.cssText = 'overflow-y: auto; flex: 1; max-height: 340px;';

    dropdown.appendChild(header);
    dropdown.appendChild(list);
    wrapper.appendChild(bellBtn);
    wrapper.appendChild(dropdown);
    navContainer.appendChild(wrapper);

    return { bellBtn, dropdown, badge, list, markAllBtn: header.querySelector('#notif-mark-all') };
}

/**
 * Render the list of notifications into the dropdown.
 * @param {HTMLElement} listEl
 * @param {Array} notifications
 */
function renderNotifList(listEl, notifications) {
    if (notifications.length === 0) {
        listEl.innerHTML = `
            <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 14px;">
                <div style="font-size: 32px; margin-bottom: 8px;">🔕</div>
                No new notifications
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    notifications.slice(0, 20).forEach(notif => {
        const icon = getNotifIcon(notif.type);
        const timeStr = formatRelativeTime(notif.createdAt);
        const isUnread = !notif.read;

        // Build href for notification
        let href = '#';
        if (notif.groupId) {
            href = `group-details.html?id=${encodeURIComponent(notif.groupId)}`;
        }

        const item = document.createElement('a');
        item.href = href;
        item.style.cssText = `
            display: flex; gap: 12px; padding: 12px 16px;
            text-decoration: none; color: inherit;
            border-bottom: 1px solid var(--surface-200);
            background: ${isUnread ? 'var(--primary-50)' : 'transparent'};
            transition: background 0.15s;
            align-items: flex-start;
        `;
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-200)'; });
        item.addEventListener('mouseleave', () => { item.style.background = isUnread ? 'var(--primary-50)' : 'transparent'; });

        item.innerHTML = `
            <div style="font-size: 20px; flex-shrink: 0; margin-top: 2px;">${icon}</div>
            <div style="flex: 1; min-width: 0;">
                <p style="margin: 0 0 4px; font-size: 13px; color: var(--base-white); line-height: 1.4; word-wrap: break-word;">
                    ${escHtml(notif.message)}
                </p>
                <span style="font-size: 11px; color: var(--text-muted);">${timeStr}</span>
            </div>
            ${isUnread ? '<div style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary-500); flex-shrink: 0; margin-top: 6px;"></div>' : ''}
        `;

        // Mark as read on click
        item.addEventListener('click', () => {
            if (isUnread) notificationService.markRead(notif.id).catch(() => {});
        });

        listEl.appendChild(item);
    });
}

/**
 * Initialize the notification bell + dropdown in the page's nav.
 * Call this from any authenticated page.
 *
 * @param {string} userId - The logged-in user's UID
 * @param {string} [navSelector='nav'] - CSS selector for the nav container to inject into
 */
export function initNotificationDropdown(userId, navSelector = 'nav') {
    const navEl = document.querySelector(navSelector);
    if (!navEl) {
        console.warn('initNotificationDropdown: nav not found for selector', navSelector);
        return;
    }

    // Inject into user-menu div if it exists, else nav itself
    const menuContainer = navEl.querySelector('.user-menu') || navEl;

    const { bellBtn, dropdown, badge, list, markAllBtn } = buildBellUI(menuContainer);

    // Toggle dropdown on bell click
    let isOpen = false;
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        dropdown.style.display = isOpen ? 'flex' : 'none';

        // Mark all as read when user opens (after a short delay)
        if (isOpen) {
            setTimeout(() => {
                notificationService.markAllRead(userId).catch(() => {});
            }, 2000);
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== bellBtn) {
            isOpen = false;
            dropdown.style.display = 'none';
        }
    });

    // Mark all read button
    markAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationService.markAllRead(userId).catch(() => {});
    });

    // Subscribe to real-time notifications
    const unsubscribe = notificationService.subscribeToNotifications(userId, (notifications) => {
        renderNotifList(list, notifications);

        // Update badge
        const unreadCount = notifications.filter(n => !n.read).length;
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });

    // Cleanup on unload
    window.addEventListener('beforeunload', unsubscribe);
}
