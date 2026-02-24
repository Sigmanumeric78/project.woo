/**
 * Dark Mode Manager - ECA-Connect
 * Defaults to light mode. Persists user preference in localStorage.
 * Apply applyThemeEarly() as early as possible to avoid flash.
 */

const STORAGE_KEY = 'eca-theme';

// Apply saved theme before paint — call this inline in <head>
export function applyThemeEarly() {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Default to light unless user explicitly chose dark
    if (saved === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
    }
}

export function isDarkMode() {
    return document.documentElement.classList.contains('dark');
}

export function toggleDarkMode() {
    const isDark = isDarkMode();
    if (isDark) {
        // Switch to light
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem(STORAGE_KEY, 'light');
    } else {
        // Switch to dark
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem(STORAGE_KEY, 'dark');
    }
    updateToggleButton();
}

export function updateToggleButton() {
    const btn = document.getElementById('dark-mode-toggle');
    if (!btn) return;
    const dark = isDarkMode();
    // Label shows where you are, icon shows where you can go
    btn.innerHTML = dark
        ? '☀️ Switch to Light'
        : '🌙 Switch to Dark';
}

export function initDarkModeToggle() {
    applyThemeEarly();
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) {
        btn.addEventListener('click', toggleDarkMode);
        updateToggleButton();
    }
}
