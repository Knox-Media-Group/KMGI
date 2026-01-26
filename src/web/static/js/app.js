// KMGI Radio Automation - Web Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize any components
    initSearch();
    initModals();
});

// Quick search functionality
function initSearch() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (searchInput.value.length >= 2) {
                    quickSearch(searchInput.value);
                }
            }, 300);
        });
    }
}

async function quickSearch(query) {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        // Could display results in a dropdown
        console.log('Search results:', results);
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Modal functionality
function initModals() {
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
}

// API helpers
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);
    return response.json();
}

// Notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '10000';
    notification.style.minWidth = '200px';

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Refresh stats periodically
function startStatsRefresh(interval = 60000) {
    setInterval(async () => {
        try {
            const stats = await apiCall('/api/stats');
            updateStatsDisplay(stats);
        } catch (error) {
            console.error('Stats refresh error:', error);
        }
    }, interval);
}

function updateStatsDisplay(stats) {
    // Update stat cards if they exist
    const statCards = document.querySelectorAll('.stat-card');
    // Implementation depends on page structure
}

// Format duration helper
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format date helper
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
