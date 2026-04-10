/**
 * pwa-init.js — Shared mobile/PWA initialization
 * Import this in every authenticated page's module script block:
 *   import { initPWA } from '../js/pwa-init.js';
 *   initPWA('dashboard');  // pass the page name for active nav highlight
 */

/** Register the service worker silently */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(reg => console.log('✅ SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    }
}

/**
 * Inject the mobile bottom navigation bar into the body.
 * @param {'discover'|'my-groups'|'manage'|'profile'} activePage
 */
export function injectBottomNav(activePage = 'discover') {
    // Don't duplicate
    if (document.getElementById('mobile-bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.id = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');

    const links = [
        { href: 'dashboard.html',     page: 'discover',   icon: '🔍', label: 'Discover' },
        { href: 'my-groups.html',     page: 'my-groups',  icon: '👥', label: 'My Groups' },
        { href: 'group-manager.html', page: 'manage',     icon: '👑', label: 'Manage' },
        { href: 'profile.html',       page: 'profile',    icon: '👤', label: 'Profile' },
    ];

    links.forEach(({ href, page, icon, label }) => {
        const a = document.createElement('a');
        a.href = href;
        if (page === activePage) a.className = 'active';
        a.setAttribute('aria-label', label);
        a.innerHTML = `<span class="nav-icon">${icon}</span>${label}`;
        nav.appendChild(a);
    });

    document.body.appendChild(nav);
}

/**
 * Show an Android-style PWA install prompt.
 * Only appears on mobile and once per session if user dismissed.
 */
export function initInstallBanner() {
    let deferredPrompt = null;

    // Create banner element
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
        <img src="/icons/icon-192.png" alt="SocialSpaces">
        <div class="banner-text">
            <strong>Install SocialSpaces</strong>
            <span>Add to home screen for offline use</span>
        </div>
        <div class="banner-actions">
            <button id="pwa-install-btn" class="btn btn-primary btn-sm" style="min-height:36px;font-size:13px;">Install</button>
            <button id="pwa-dismiss-btn" class="btn btn-ghost btn-sm" style="min-height:36px;font-size:13px;">✕</button>
        </div>
    `;
    document.body.appendChild(banner);

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!localStorage.getItem('pwa-dismissed')) {
            setTimeout(() => banner.classList.add('visible'), 5000);
        }
    });

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        banner.classList.remove('visible');
    });

    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
        banner.classList.remove('visible');
        localStorage.setItem('pwa-dismissed', '1');
    });
}

/**
 * Main init — call this from every authenticated page.
 * @param {'discover'|'my-groups'|'manage'|'profile'} activePage
 */
export function initPWA(activePage = 'discover') {
    registerServiceWorker();
    injectBottomNav(activePage);
    initInstallBanner();
}
