// My Groups Integration — Loads joined groups and pending join requests for the logged-in user.
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { firestoreService } from './firestore-service.js';
import { joinRequestService } from './join-request-service.js';
import { initDarkModeToggle } from './dark-mode.js';
import { initNotificationDropdown } from './notification-dropdown.js';

initDarkModeToggle();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Init notification bell
    initNotificationDropdown(user.uid);

    // Set nav avatar
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) {
        navAvatar.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
        if (user.photoURL) {
            navAvatar.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="avatar">`;
        }
    }

    await loadMyGroups(user.uid);
    await loadMyRequests(user.uid);
});

async function loadMyGroups(userId) {
    const container = document.getElementById('joined-groups-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">Loading...</div>';

    try {
        const groups = await firestoreService.queryDocuments('groups', [
            { field: 'members', operator: 'array-contains', value: userId }
        ]);

        if (groups.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:48px 24px;color:var(--text-muted);">
                    <div style="font-size:48px;margin-bottom:16px;">👥</div>
                    <h3 style="margin-bottom:8px;">No Groups Yet</h3>
                    <p style="margin-bottom:20px;">You haven't joined any groups yet.</p>
                    <a href="dashboard.html" class="btn btn-primary btn-sm">Browse Groups</a>
                </div>`;
            return;
        }

        container.innerHTML = '';
        groups.forEach(group => {
            const card = createGroupCard(group, userId);
            container.appendChild(card);
        });

    } catch (err) {
        console.error('Failed to load groups:', err);
        container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--error-text);">Failed to load groups: ${err.message}</div>`;
    }
}

async function loadMyRequests(userId) {
    const container = document.getElementById('my-requests-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">Loading...</div>';

    try {
        const requests = await joinRequestService.getRequestsByUser(userId);

        const pending = requests.filter(r => r.status === 'pending');
        const others = requests.filter(r => r.status !== 'pending');

        if (requests.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:48px 24px;color:var(--text-muted);">
                    <div style="font-size:48px;margin-bottom:16px;">📬</div>
                    <p>You haven't sent any join requests.</p>
                </div>`;
            return;
        }

        container.innerHTML = '';
        [...pending, ...others].forEach(req => {
            const item = createRequestItem(req);
            container.appendChild(item);
        });

    } catch (err) {
        console.error('Failed to load requests:', err);
        container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--error-text);">Failed to load requests: ${err.message}</div>`;
    }
}

function createGroupCard(group, userId) {
    const isCreator = group.creatorId === userId;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding: 20px; display: flex; gap: 16px; align-items: center; cursor: pointer; transition: transform 0.2s;';
    card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-2px)');
    card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');
    card.onclick = () => window.location.href = `group-details.html?id=${group.id}`;

    const colorHex = group.imageColor || '#0096D6';
    card.innerHTML = `
        <div style="width:56px;height:56px;border-radius:12px;background:${colorHex};display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.9);font-size:24px;font-weight:700;flex-shrink:0;">
            ${(group.name || '?')[0]}
        </div>
        <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <h4 style="margin:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${group.name || 'Unnamed Group'}</h4>
                ${isCreator ? '<span class="badge" style="background:var(--primary-50);color:var(--primary-500);font-size:10px;">👑 Creator</span>' : ''}
            </div>
            <p style="margin:0;font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${group.description || ''}</p>
            <div style="display:flex;gap:12px;margin-top:8px;font-size:12px;color:var(--text-muted);">
                <span>👥 ${(group.members || []).length} members</span>
                ${group.nextSession ? `<span>📅 ${group.nextSession}</span>` : ''}
            </div>
        </div>
        <div style="flex-shrink:0;">
            <span style="color:var(--text-muted);font-size:18px;">›</span>
        </div>
    `;
    return card;
}

function createRequestItem(req) {
    const statusColors = {
        pending:  { bg: 'var(--warning-bg)', color: 'var(--warning-text)', label: '⏳ Pending' },
        approved: { bg: 'var(--success-bg)', color: 'var(--success-text)', label: '✅ Approved' },
        rejected: { bg: 'var(--error-bg)',   color: 'var(--error-text)',   label: '❌ Rejected' }
    };
    const s = statusColors[req.status] || statusColors.pending;
    const updatedDate = req.updatedAt?.seconds
        ? new Date(req.updatedAt.seconds * 1000).toLocaleDateString()
        : '';

    const item = document.createElement('div');
    item.className = 'card';
    item.style.cssText = 'padding: 16px 20px; display: flex; align-items: center; gap: 12px;';

    item.innerHTML = `
        <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-weight:600;font-size:15px;">${req.groupName || 'Unknown Group'}</span>
                <span style="padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color};">${s.label}</span>
            </div>
            ${req.message ? `<p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">Message: "${req.message}"</p>` : ''}
            ${updatedDate ? `<p style="margin:0;font-size:11px;color:var(--text-muted);">Updated: ${updatedDate}</p>` : ''}
        </div>
        ${req.status === 'rejected' ? `<a href="group-details.html?id=${req.groupId}" class="btn btn-secondary btn-sm" style="flex-shrink:0;">Re-apply</a>` : ''}
        <a href="group-details.html?id=${req.groupId}" class="btn btn-ghost btn-sm" style="flex-shrink:0;">View Group ›</a>
    `;
    return item;
}
