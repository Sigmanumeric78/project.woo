// Pagination Configuration
const GROUPS_PER_PAGE = 20;
let currentPage = 1;
let totalPages = 1;
let paginatedGroups = [];

/**
 * Initialize pagination
 * @param {Array} groups - All groups to paginate
 */
function initPagination(groups) {
    paginatedGroups = groups;
    totalPages = Math.ceil(groups.length / GROUPS_PER_PAGE);
    currentPage = 1;

    renderPaginationControls();
    displayCurrentPage();
}

/**
 * Display groups for current page
 */
function displayCurrentPage() {
    const startIndex = (currentPage - 1) * GROUPS_PER_PAGE;
    const endIndex = startIndex + GROUPS_PER_PAGE;
    const pageGroups = paginatedGroups.slice(startIndex, endIndex);

    // Use existing renderGroups function
    if (window.renderGroups) {
        window.renderGroups(pageGroups);
    }

    // Update pagination controls
    updatePaginationControls();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Render pagination controls
 */
function renderPaginationControls() {
    const container = document.getElementById('groups-container');
    if (!container) return;

    // Remove existing pagination
    const existingPagination = document.getElementById('pagination-controls');
    if (existingPagination) {
        existingPagination.remove();
    }

    // Only show pagination if more than one page
    if (totalPages <= 1) return;

    const paginationHTML = `
        <div id="pagination-controls" style="
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            margin-top: 32px;
            padding: 20px;
        ">
            <button id="prev-page" class="btn btn-secondary" style="min-width: 100px;">
                ← Previous
            </button>
            <span id="page-info" style="
                color: var(--text-muted);
                font-size: 14px;
                min-width: 120px;
                text-align: center;
            ">
                Page ${currentPage} of ${totalPages}
            </span>
            <button id="next-page" class="btn btn-secondary" style="min-width: 100px;">
                Next →
            </button>
        </div>
    `;

    container.insertAdjacentHTML('afterend', paginationHTML);

    // Add event listeners
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
        }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayCurrentPage();
        }
    });

    updatePaginationControls();
}

/**
 * Update pagination button states
 */
function updatePaginationControls() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.style.opacity = currentPage === totalPages ? '0.5' : '1';
    }

    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

// Export for use in dashboard-integration.js
export { initPagination, GROUPS_PER_PAGE };
