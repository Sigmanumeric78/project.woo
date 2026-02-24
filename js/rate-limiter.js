// Rate Limiting Service
// Prevents abuse by limiting API calls per user

class RateLimiter {
    constructor() {
        this.limits = new Map();
        this.WINDOW_MS = 60000; // 1 minute window
        this.MAX_REQUESTS = {
            createGroup: 5,      // 5 groups per minute
            joinGroup: 10,       // 10 joins per minute
            updateProfile: 10,   // 10 updates per minute
            search: 30,          // 30 searches per minute
            default: 20          // 20 requests per minute for other actions
        };
    }

    /**
     * Check if action is allowed
     * @param {string} userId - User ID
     * @param {string} action - Action type
     * @returns {boolean} Whether action is allowed
     */
    checkLimit(userId, action = 'default') {
        const key = `${userId}:${action}`;
        const now = Date.now();

        if (!this.limits.has(key)) {
            this.limits.set(key, []);
        }

        const timestamps = this.limits.get(key);

        // Remove old timestamps outside the window
        const validTimestamps = timestamps.filter(t => now - t < this.WINDOW_MS);
        this.limits.set(key, validTimestamps);

        // Check if limit exceeded
        const maxRequests = this.MAX_REQUESTS[action] || this.MAX_REQUESTS.default;

        if (validTimestamps.length >= maxRequests) {
            console.warn(`⚠️ Rate limit exceeded for ${action} by user ${userId}`);
            return false;
        }

        // Add current timestamp
        validTimestamps.push(now);
        this.limits.set(key, validTimestamps);

        return true;
    }

    /**
     * Get remaining requests for action
     * @param {string} userId - User ID
     * @param {string} action - Action type
     * @returns {number} Remaining requests
     */
    getRemaining(userId, action = 'default') {
        const key = `${userId}:${action}`;
        const now = Date.now();

        if (!this.limits.has(key)) {
            return this.MAX_REQUESTS[action] || this.MAX_REQUESTS.default;
        }

        const timestamps = this.limits.get(key);
        const validTimestamps = timestamps.filter(t => now - t < this.WINDOW_MS);

        const maxRequests = this.MAX_REQUESTS[action] || this.MAX_REQUESTS.default;
        return Math.max(0, maxRequests - validTimestamps.length);
    }

    /**
     * Clear all limits (for testing)
     */
    clear() {
        this.limits.clear();
    }

    /**
     * Clear limits for specific user
     * @param {string} userId - User ID
     */
    clearUser(userId) {
        for (const key of this.limits.keys()) {
            if (key.startsWith(userId + ':')) {
                this.limits.delete(key);
            }
        }
    }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

// Export for debugging
window.rateLimiter = rateLimiter;


export { RateLimiter };
