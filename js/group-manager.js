// Group Manager Integration — Lets group creators approve/reject join requests.
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { firestoreService } from './firestore-service.js';
import { joinRequestService } from './join-request-service.js';
import { initDarkModeToggle } from './dark-mode.js';
import { initNotificationDropdown } from './notification-dropdown.js';

initDarkModeToggle();

let currentUser = null;
let allRequests = [];
let activeGroupId = null;
let unsubRequests = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;

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

    await loadCreatedGroups(user.uid);
});

async function loadCreatedGroups(userId) {
    const container = document.getElementById('groups-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);">Loading your groups...</div>';

    try {
        const groups = await firestoreService.queryDocuments('groups', [
            { field: 'creatorId', operator: '==', value: userId }
        ]);

        if (groups.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:64px 24px;color:var(--text-muted);">
                    <div style="font-size:56px;margin-bottom:20px;">👑</div>
                    <h3 style="margin-bottom:8px;">No Groups Created</h3>
                    <p style="margin-bottom:24px;">You haven't created any groups yet.</p>
                    <a href="create-group.html" class="btn btn-primary">Create a Group</a>
                </div>`;
            return;
        }

        container.innerHTML = '';
        groups.forEach(group => {
            const btn = createGroupTab(group);
            container.appendChild(btn);
        });

        // Auto-select first group
        if (groups.length > 0) {
            selectGroup(groups[0]);
        }

    } catch (err) {
        console.error('Failed to load created groups:', err);
        container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--error-text);">❌ Failed to load groups. ${err.message}</div>`;
    }
}

function createGroupTab(group) {
    const btn = document.createElement('button');
    btn.dataset.groupId = group.id;
    btn.style.cssText = `
        width: 100%; text-align: left; padding: 14px 16px;
        background: var(--surface-100); border: 1px solid var(--surface-200);
        border-radius: var(--radius-md); cursor: pointer; color: var(--base-white);
        font-family: var(--font-body); font-size: 14px; transition: all 0.2s;
        display: flex; align-items: center; gap: 12px;
    `;
    btn.innerHTML = `
        <div style="width:36px;height:36px;border-radius:8px;background:${group.imageColor || '#0096D6'};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:rgba(255,255,255,0.9);flex-shrink:0;">${(group.name || '?')[0]}</div>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${group.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">👥 ${(group.members || []).length} members · ${group.privacy || 'open'}</div>
        </div>
        <span class="pending-badge-${group.id}" style="display:none;background:#ef4444;color:white;border-radius:999px;min-width:18px;height:18px;padding:0 4px;font-size:10px;font-weight:700;align-items:center;justify-content:center;"></span>
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--surface-200)'; btn.style.borderColor = 'var(--primary-500)'; });
    btn.addEventListener('mouseleave', () => {
        if (activeGroupId !== group.id) { btn.style.background = 'var(--surface-100)'; btn.style.borderColor = 'var(--surface-200)'; }
    });
    btn.onclick = () => selectGroup(group);

    // Real-time pending badge
    joinRequestService.subscribeToPendingCount(currentUser.uid, (count) => {
        const badge = btn.querySelector(`.pending-badge-${group.id}`);
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    });

    return btn;
}

function selectGroup(group) {
    activeGroupId = group.id;

    // Highlight active tab
    document.querySelectorAll('#groups-list button').forEach(b => {
        const isActive = b.dataset.groupId === group.id;
        b.style.background = isActive ? 'var(--primary-50)' : 'var(--surface-100)';
        b.style.borderColor = isActive ? 'var(--primary-500)' : 'var(--surface-200)';
    });

    loadRequestsForGroup(group);
}

function loadRequestsForGroup(group) {
    const panel = document.getElementById('requests-panel');
    if (!panel) return;

    // Show group header
    const header = document.getElementById('selected-group-header');
    if (header) {
        header.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
                <div style="width:48px;height:48px;border-radius:12px;background:${group.imageColor || '#0096D6'};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:rgba(255,255,255,0.9);">${(group.name || '?')[0]}</div>
                <div>
                    <h3 style="margin:0;font-size:20px;">${group.name}</h3>
                    <div style="font-size:13px;color:var(--text-muted);">👥 ${(group.members || []).length} members · 📍 ${group.locationName || 'No location'}</div>
                </div>
                <div style="margin-left:auto;display:flex;gap:8px;">
                    <a href="edit-group.html?id=${group.id}" class="btn btn-secondary btn-sm">⚙️ Edit Group</a>
                    <a href="group-details.html?id=${group.id}" class="btn btn-ghost btn-sm">View Page ›</a>
                </div>
            </div>
        `;
    }

    // Unsubscribe old listener
    if (unsubRequests) unsubRequests();

    // Real-time requests
    unsubRequests = firestoreService.onCollectionChange(
        'joinRequests',
        [{ field: 'groupId', operator: '==', value: group.id }],
        (requests) => {
            allRequests = requests;
            renderRequests(requests, panel);
        }
    );
}

function renderRequests(requests, panel) {
    const pending  = requests.filter(r => r.status === 'pending');
    const approved = requests.filter(r => r.status === 'approved');
    const rejected = requests.filter(r => r.status === 'rejected');

    panel.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:24px;border-bottom:1px solid var(--surface-200);padding-bottom:16px;">
            <button data-tab="pending"  class="tab-btn ${pending.length  > 0 ? 'active-tab' : ''}" style="${tabBtnStyle(pending.length > 0)}">⏳ Pending (${pending.length})</button>
            <button data-tab="approved" class="tab-btn" style="${tabBtnStyle(false)}">✅ Approved (${approved.length})</button>
            <button data-tab="rejected" class="tab-btn" style="${tabBtnStyle(false)}">❌ Rejected (${rejected.length})</button>
        </div>
        <div id="tab-content"></div>
    `;

    // Tab switching
    const tabContent = panel.querySelector('#tab-content');
    panel.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.tab-btn').forEach(b => {
                b.style.cssText = tabBtnStyle(false);
            });
            btn.style.cssText = tabBtnStyle(true);

            const tab = btn.dataset.tab;
            const list = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;
            renderRequestList(tabContent, list, tab);
        });
    });

    // Default to pending tab
    renderRequestList(tabContent, pending, 'pending');
}

function tabBtnStyle(active) {
    return `padding:8px 16px;border-radius:var(--radius-full);font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid ${active ? 'var(--primary-500)' : 'var(--surface-300)'};background:${active ? 'var(--primary-50)' : 'var(--surface-100)'};color:${active ? 'var(--primary-500)' : 'var(--base-white)'};transition:all 0.2s;font-family:var(--font-body);`;
}

function renderRequestList(container, requests, tab) {
    if (requests.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:48px 24px;color:var(--text-muted);">
                <div style="font-size:40px;margin-bottom:12px;">📭</div>
                No ${tab} requests.
            </div>`;
        return;
    }

    container.innerHTML = '';
    requests.forEach(req => {
        const card = createRequestCard(req, tab);
        container.appendChild(card);
    });
}

function createRequestCard(req, tab) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:16px 20px;margin-bottom:12px;display:flex;align-items:center;gap:16px;';

    const initials = (req.requesterName || '?')[0].toUpperCase();
    const dateStr = req.createdAt?.seconds
        ? new Date(req.createdAt.seconds * 1000).toLocaleDateString()
        : '';

    card.innerHTML = `
        <div style="width:44px;height:44px;border-radius:50%;background:var(--surface-200);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--primary-500);flex-shrink:0;overflow:hidden;">
            ${req.requesterPhotoURL ? `<img src="${req.requesterPhotoURL}" style="width:100%;height:100%;object-fit:cover;" alt="avatar">` : initials}
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:15px;margin-bottom:2px;">${req.requesterName || 'Unknown'}</div>
            ${req.message ? `<p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">"${req.message}"</p>` : ''}
            <div style="font-size:11px;color:var(--text-muted);">${dateStr}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;" id="actions-${req.id}">
            <a href="public-profile.html?uid=${req.requesterId}" class="btn btn-ghost btn-sm" title="View Profile">👤 Profile</a>
            ${tab === 'pending' ? `
                <button onclick="handleApprove('${req.id}')" class="btn btn-primary btn-sm">✅ Approve</button>
                <button onclick="handleReject('${req.id}')"  class="btn btn-secondary btn-sm">❌ Reject</button>
            ` : ''}
        </div>
    `;
    return card;
}

// Global handlers (called from inline onclick)
window.handleApprove = async function(requestId) {
    const btn = document.querySelector(`#actions-${requestId} .btn-primary`);
    if (btn) { btn.disabled = true; btn.textContent = 'Approving...'; }
    try {
        await joinRequestService.approveRequest(requestId, currentUser.uid);
        showToast('✅ Request approved!', 'success');
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✅ Approve'; }
    }
};

window.handleReject = async function(requestId) {
    const btn = document.querySelector(`#actions-${requestId} .btn-secondary`);
    if (btn) { btn.disabled = true; btn.textContent = 'Rejecting...'; }
    try {
        await joinRequestService.rejectRequest(requestId, currentUser.uid);
        showToast('Request rejected.', 'info');
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = '❌ Reject'; }
    }
};

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const colors = { success: '#22c55e', error: '#ef4444', info: '#38b6ff' };
    toast.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        background:var(--surface-100);border:1px solid var(--surface-300);
        border-radius:var(--radius-md);padding:12px 20px;
        box-shadow:var(--shadow-lg);font-size:14px;color:var(--base-white);
        display:flex;align-items:center;gap:8px;
        border-left:4px solid ${colors[type] || colors.success};
        animation:slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}
