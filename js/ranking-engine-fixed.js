/**
 * Ranking Engine for ECA-Connect
 * Two-phase ranking pipeline: hard filters → radius split → weighted scoring
 */

import { calculateRoute } from './route-utils.js';

// Default component weights (can be customized)
const DEFAULT_WEIGHTS = {
    interest: 0.40,      // 40%
    timeOverlap: 0.30,   // 30%
    distance: 0.15,      // 15%
    skill: 0.05,         // 5%
    health: 0.07,        // 7%
    textRelevance: 0.03  // 3%
};

const MIN_TIME_OVERLAP = 30; // Minimum overlap in minutes for time filter

/**
 * Main entry point: Rank groups with filters
 * @param {Array} groups - All groups to rank
 * @param {Object} user - Current user object
 * @param {Object} filters - Active filters
 * @param {Object} weights - Component weights (optional)
 * @returns {Object} {inRadius: [], outOfRadius: []}
 */
export async function rankGroups(groups, user, filters = {}, weights = DEFAULT_WEIGHTS) {
    console.log('🔄 rankGroups called with:', groups.length, 'groups');
    console.log('👤 User object:', JSON.stringify(user, null, 2));

    // Phase A: Apply hard filters
    const eligible = applyHardFilters(groups, user, filters);
    console.log('✅ After hard filters:', eligible.length, 'eligible groups');

    // Calculate distances for all eligible groups
    const groupsWithDistance = await Promise.all(
        eligible.map(async (group) => {
            const route = await calculateRoute(
                { lat: user.location.lat, lon: user.location.lng },
                { lat: group.location.lat, lon: group.location.lng },
                'car'
            );
            const distance = route ? route.distance / 1000 : group.distance; // km
            return { ...group, calculatedDistance: distance };
        })
    );
    console.log('✅ After distance calculation:', groupsWithDistance.length, 'groups with distances');

    // Phase B: Split by radius (Hard limit at maxRadius)
    // We pass maxRadius to splitByRadius now
    const { inRadius, outOfRadius } = splitByRadius(groupsWithDistance, user, filters.maxRadius);
    console.log('✅ After radius split: inRadius =', inRadius.length, ', outOfRadius =', outOfRadius.length);

    // Phase C: Calculate scores and rank each set
    const rankedInRadius = await rankGroupSet(inRadius, user, filters, weights, true);
    // Out of radius groups are those BEYOND the selected radius but still in the list
    // If we want to strictly HIDE them, we just return empty, or we separate them.
    // The previous design showed "Other groups". 
    // If requirement is "Sort groups on basis of that", maybe we just rank everything but highlight distance?
    // User said: "remove the contanst number 5 km ... sort the gorups on the basis of that"
    // Interpretation: The slider sets the "In Radius" threshold. Groups outside are "Out of Radius".

    const rankedOutOfRadius = await rankGroupSet(outOfRadius, user, filters, weights, false);
    console.log('✅ Final results: inRadius =', rankedInRadius.length, ', outOfRadius =', rankedOutOfRadius.length);

    return {
        inRadius: rankedInRadius,
        outOfRadius: rankedOutOfRadius
    };
}

/**
 * Apply hard filters (must-match constraints)
 */
function applyHardFilters(groups, user, filters) {
    return groups.filter(group => {
        // [DEBUG] Log rejection reason
        const logReject = (reason) => console.log(`❌ Group "${group.name}" rejected by: ${reason}`);

        // 1. Privacy (Hard) - Only show private groups to members
        if (group.privacy === 'private' && !group.members.includes(user.uid)) {
            logReject('Private Group');
            return false;
        }

        // 2. Search Query (Hard)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesName = group.name.toLowerCase().includes(searchLower);
            const matchesDesc = group.description.toLowerCase().includes(searchLower);
            const matchesTags = group.tags.some(t => t.toLowerCase().includes(searchLower));

            if (!matchesName && !matchesDesc && !matchesTags) {
                logReject('Search Mismatch');
                return false;
            }
        }

        // 3. Language (Hard) - Must match preferred language or be English
        if (user.language && group.language !== user.language && group.language !== 'English') {
            logReject('Language Mismatch');
            return false;
        }

        // 4. Skill Level (Hard if strict)
        if (filters.strictSkill && user.skillLevel && group.skillLevel !== user.skillLevel) {
            logReject('Skill Mismatch');
            return false;
        }

        // 5. Interest (Soft/Commented Out)
        // Keeping this disabled for now to ensure groups show up even if interests don't perfectly match code tags
        /*
        const hasInterest = group.tags && group.tags.some(t => user.interests.includes(t));
        if (!hasInterest) {
            // logReject('Interest Mismatch'); 
            // return false; 
        }
        */

        return true;
    });
}

/**
 * Split groups by radius
 */
/**
 * Split groups by radius
 */
function splitByRadius(groups, user, maxRadius) {
    const inRadius = [];
    const outOfRadius = [];

    // Use the filter maxRadius, defaulting to user.radius or 50 if undefined
    const threshold = maxRadius || user.radius || 50;
    console.log('📏 Radius threshold:', threshold, 'km');

    groups.forEach(group => {
        console.log(`📍 Group "${group.name}": distance = ${group.calculatedDistance} km, threshold = ${threshold} km`);

        if (group.calculatedDistance <= threshold) {
            inRadius.push(group);
            console.log(`  ✅ Added to IN-RADIUS`);
        } else {
            outOfRadius.push(group);
            console.log(`  ❌ Added to OUT-OF-RADIUS`);
        }
    });

    return { inRadius, outOfRadius };
}

/**
 * Rank a set of groups (in-radius or out-of-radius)
 */
async function rankGroupSet(groups, user, filters, weights, isInRadius) {
    const groupsWithScores = groups.map(group => {
        const componentScores = calculateComponentScores(group, user, filters, isInRadius);
        const finalScore = calculateFinalScore(componentScores, weights);

        return {
            ...group,
            componentScores,
            finalScore,
            // Calculate compatibility percentage (exclude health and text relevance)
            compatibilityScore: calculateCompatibilityScore(componentScores, weights)
        };
    });

    // Sort based on filters.sortBy
    const sortBy = filters.sortBy || 'best-match';

    return groupsWithScores.sort((a, b) => {
        if (sortBy === 'nearest') {
            return a.calculatedDistance - b.calculatedDistance;
        } else if (sortBy === 'most-active') {
            // Sort by activity score (mock calculation using messages per day)
            const activityA = (a.healthMetrics?.messagesPerDay || 0) + (a.healthMetrics?.eventsPerMonth || 0) * 2;
            const activityB = (b.healthMetrics?.messagesPerDay || 0) + (b.healthMetrics?.eventsPerMonth || 0) * 2;
            return activityB - activityA;
        } else {
            // Default: Best Match (Final Score)
            return b.finalScore - a.finalScore;
        }
    });
}

/**
 * Calculate all component scores for a group
 */
function calculateComponentScores(group, user, filters, isInRadius) {
    return {
        interest: calculateInterestScore(group, user),
        timeOverlap: calculateTimeOverlapScore(group, user),
        distance: calculateDistanceScore(group.calculatedDistance, user.radius, isInRadius),
        skill: calculateSkillScore(group, user),
        health: calculateHealthScore(group),
        textRelevance: calculateTextRelevance(group, filters.searchQuery || '')
    };
}

/**
 * Calculate final score from component scores and weights
 */
function calculateFinalScore(componentScores, weights) {
    const activeWeights = Object.keys(weights).filter(key => weights[key] > 0);
    const activeWeightsSum = activeWeights.reduce((sum, key) => sum + weights[key], 0);

    let finalScore = 0;
    activeWeights.forEach(key => {
        const normalizedWeight = weights[key] / activeWeightsSum;
        finalScore += normalizedWeight * componentScores[key];
    });

    return finalScore;
}

/**
 * Calculate compatibility score (user-visible, excludes platform boosts)
 * Only includes: interest, time, distance, skill
 */
function calculateCompatibilityScore(componentScores, weights) {
    const visibleComponents = ['interest', 'timeOverlap', 'distance', 'skill'];
    const visibleWeights = visibleComponents.reduce((sum, key) => sum + weights[key], 0);

    let compatScore = 0;
    visibleComponents.forEach(key => {
        const normalizedWeight = weights[key] / visibleWeights;
        compatScore += normalizedWeight * componentScores[key];
    });

    return Math.round(compatScore * 100); // Return as percentage
}

// ============================================================================
// COMPONENT SCORE CALCULATIONS (each returns 0-1)
// ============================================================================

/**
 * Interest Score: How well group tags match user interests
 */
function calculateInterestScore(group, user) {
    const matchedTags = group.tags.filter(tag =>
        user.interests.includes(tag)
    );

    if (group.tags.length === 0) return 0;
    return matchedTags.length / group.tags.length;
}

/**
 * Time Overlap Score: How well group schedule matches user availability
 */
function calculateTimeOverlapScore(group, user) {
    const overlapMinutes = calculateTimeOverlapMinutes(group, user);
    const groupDuration = getGroupDurationMinutes(group);

    if (groupDuration === 0) return 0;
    return Math.min(1, overlapMinutes / groupDuration);
}

/**
 * Distance Score: Normalized by radius
 */
function calculateDistanceScore(distance, userRadius, isInRadius) {
    if (distance <= 0) return 1;

    if (isInRadius) {
        // Linear decay within radius: 1.0 at 0km, 0.0 at radius
        return Math.max(0, 1 - (distance / userRadius));
    } else {
        // Out of radius: decay from radius to 2× radius
        const maxDistance = userRadius * 2;
        return Math.max(0, 1 - (distance - userRadius) / (maxDistance - userRadius));
    }
}

/**
 * Skill Score: Match between user skill and group requirement
 */
function calculateSkillScore(group, user) {
    // Safety check for user.skillLevels
    const userLevels = user.skillLevels || {};
    let userSkill = userLevels[group.category] || 'beginner';
    userSkill = userSkill.toLowerCase();

    const skillLevels = { beginner: 1, intermediate: 2, advanced: 3 };

    const userLevel = skillLevels[userSkill];
    const groupLevel = skillLevels[group.skillLevel];

    if (userLevel >= groupLevel) {
        return 1.0; // User meets or exceeds requirement
    } else if (group.skillLevel === 'beginner') {
        return 1.0; // Beginner-friendly groups
    } else {
        return 0.5; // Mismatch but acceptable
    }
}

/**
 * Health Score: Group activity and engagement
 */
function calculateHealthScore(group) {
    const metrics = group.healthMetrics;

    // Recency score (0-1)
    const daysSinceActivity = (new Date() - new Date(metrics.lastActivityDate)) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - (daysSinceActivity / 30)); // Decay over 30 days

    // Activity score (0-1) - normalize messages per day
    const activityScore = Math.min(1, metrics.messagesPerDay / 50);

    // Attendance score (0-1)
    const attendanceScore = Math.min(1, metrics.averageAttendance / group.members);

    // Weighted combination
    return (recencyScore * 0.4 + activityScore * 0.3 + attendanceScore * 0.3);
}

/**
 * Text Relevance Score: Match to search query
 */
function calculateTextRelevance(group, searchQuery) {
    if (!searchQuery || searchQuery.trim() === '') return 0;

    const query = searchQuery.toLowerCase().trim();
    const groupText = `${group.name} ${group.description} ${group.tags.join(' ')}`.toLowerCase();

    // Exact name match (prefix)
    if (group.name.toLowerCase().startsWith(query)) return 1.0;

    // Contains in text
    if (groupText.includes(query)) return 0.7;

    // Word matching
    const queryWords = query.split(' ').filter(w => w.length > 2);
    const matchedWords = queryWords.filter(word => groupText.includes(word));

    if (queryWords.length === 0) return 0;
    return (matchedWords.length / queryWords.length) * 0.5;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate time overlap in minutes between group schedule and user availability
 */
function calculateTimeOverlapMinutes(group, user) {
    let totalOverlap = 0;

    user.availability.forEach(userWindow => {
        if (userWindow.day === group.schedule.dayOfWeek) {
            const overlap = getTimeWindowOverlap(
                userWindow.startTime,
                userWindow.endTime,
                group.schedule.startTime,
                group.schedule.endTime
            );
            totalOverlap += overlap;
        }
    });

    return totalOverlap;
}

/**
 * Get overlap between two time windows in minutes
 */
function getTimeWindowOverlap(start1, end1, start2, end2) {
    const start1Min = timeToMinutes(start1);
    const end1Min = timeToMinutes(end1);
    const start2Min = timeToMinutes(start2);
    const end2Min = timeToMinutes(end2);

    const overlapStart = Math.max(start1Min, start2Min);
    const overlapEnd = Math.min(end1Min, end2Min);

    return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeStr) {
    // Handle null/undefined
    if (!timeStr) return 0;

    // Handle non-string
    if (typeof timeStr !== 'string') return 0;

    // Handle descriptive slots
    const descriptive = {
        'morning': 360,
        'afternoon': 720,
        'evening': 1020,
        'night': 1200
    };

    const lower = timeStr.toLowerCase().trim();
    if (descriptive[lower]) return descriptive[lower];

    // Handle HH:mm format
    if (!timeStr.includes(':')) return 0;

    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;

    return hours * 60 + minutes;
}

/**
 * Get group duration in minutes
 */
function getGroupDurationMinutes(group) {
    const startMin = timeToMinutes(group.schedule.startTime);
    const endMin = timeToMinutes(group.schedule.endTime);
    return endMin - startMin;
}

export { DEFAULT_WEIGHTS, MIN_TIME_OVERLAP };
