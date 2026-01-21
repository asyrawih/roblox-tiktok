// State
let stats = {
    chat: 0,
    gift: 0,
    member: 0,
    like: 0
};

let isMonitoring = false;
let currentFilter = 'all';
const MAX_EVENTS = 100;

// DOM Elements
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const statusBar = document.getElementById('status-bar');
const eventContainer = document.getElementById('event-container');
const filterButtons = document.querySelectorAll('.filter-btn');

const statElements = {
    chat: document.getElementById('chat-count'),
    gift: document.getElementById('gift-count'),
    member: document.getElementById('member-count'),
    like: document.getElementById('like-count')
};

// Event Listeners
startBtn.addEventListener('click', startMonitoring);
stopBtn.addEventListener('click', stopMonitoring);
clearBtn.addEventListener('click', clearEvents);

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isMonitoring) {
        startMonitoring();
    }
});

// Filter button listeners
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        setFilter(filter);
    });
});

// Listen to TikTok events
window.electronAPI.onTikTokEvent((event) => {
    handleTikTokEvent(event.type, event.data);
});

// Functions
async function startMonitoring() {
    const username = usernameInput.value.trim();
    
    if (!username) {
        updateStatus('error', 'Please enter a username');
        return;
    }

    updateStatus('connecting', `Connecting to @${username}...`);
    startBtn.disabled = true;
    usernameInput.disabled = true;

    const result = await window.electronAPI.startMonitoring(username);

    if (result.success) {
        isMonitoring = true;
        stopBtn.disabled = false;
    } else {
        updateStatus('error', `Failed: ${result.error}`);
        startBtn.disabled = false;
        usernameInput.disabled = false;
    }
}

async function stopMonitoring() {
    updateStatus('idle', 'Disconnecting...');
    
    await window.electronAPI.stopMonitoring();
    
    isMonitoring = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    usernameInput.disabled = false;
    
    updateStatus('idle', 'Stopped');
    
    // Add system message
    addEvent('system', {
        message: 'Monitoring stopped',
        timestamp: new Date().toISOString()
    });
}

function clearEvents() {
    eventContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">◇</div><div class="empty-text">Event feed cleared</div></div>';
}

function setFilter(filter) {
    currentFilter = filter;
    
    // Update button states
    filterButtons.forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Apply filter to existing events
    applyFilter();
}

function applyFilter() {
    const events = eventContainer.querySelectorAll('.event-item');
    
    events.forEach(event => {
        if (currentFilter === 'all') {
            event.style.display = '';
        } else {
            // Check if event has the filter class
            if (event.classList.contains(currentFilter)) {
                event.style.display = '';
            } else {
                event.style.display = 'none';
            }
        }
    });
    
    // Check if all events are hidden
    const visibleEvents = Array.from(events).filter(e => e.style.display !== 'none');
    if (visibleEvents.length === 0 && events.length > 0) {
        const emptyState = eventContainer.querySelector('.empty-state');
        if (!emptyState) {
            const noResults = document.createElement('div');
            noResults.className = 'empty-state';
            noResults.innerHTML = `
                <div class="empty-icon">◇</div>
                <div class="empty-text">No ${currentFilter} events found</div>
                <div class="empty-subtext">Try a different filter</div>
            `;
            eventContainer.appendChild(noResults);
        }
    } else {
        const emptyState = eventContainer.querySelector('.empty-state');
        if (emptyState && events.length > 0) {
            emptyState.remove();
        }
    }
}

function updateStatus(state, message, info = '') {
    const statusIndicator = statusBar.querySelector('.status-indicator');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    const statusInfo = statusBar.querySelector('.status-info');

    // Remove all state classes
    statusDot.classList.remove('idle', 'connecting', 'connected', 'error');
    statusDot.classList.add(state);

    statusText.textContent = message;
    statusInfo.textContent = info;
}

function updateStat(type, value) {
    if (statElements[type]) {
        const element = statElements[type];
        element.textContent = value;
        
        // Add pulse animation
        element.style.animation = 'none';
        setTimeout(() => {
            element.style.animation = 'pulse-value 0.5s ease';
        }, 10);
    }
}

function addEvent(type, data) {
    // Remove empty state if exists
    const emptyState = eventContainer.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const eventItem = document.createElement('div');
    eventItem.className = `event-item ${type}`;

    const time = new Date(data.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let content = '';
    let typeLabel = type.toUpperCase();

    switch (type) {
        case 'chat':
            content = `<span class="event-username">@${data.username}</span>: ${escapeHtml(data.comment)}`;
            break;
        case 'gift':
            content = `<span class="event-username">@${data.username}</span> sent <span class="event-highlight">${data.giftName}</span> (${data.diamondCount} 💎)`;
            break;
        case 'member':
            content = `<span class="event-username">@${data.username}</span> ${data.action} the stream`;
            break;
        case 'like':
            content = `<span class="event-username">@${data.username}</span> sent ${data.likeCount} ❤️`;
            break;
        case 'follow':
            content = `<span class="event-username">@${data.username}</span> followed the streamer`;
            break;
        case 'share':
            content = `<span class="event-username">@${data.username}</span> shared the stream`;
            break;
        case 'connected':
            typeLabel = 'CONNECTED';
            content = `Connected to <span class="event-highlight">@${data.username}</span> (Room: ${data.roomId})`;
            break;
        case 'connecting':
            typeLabel = 'SYSTEM';
            content = `Attempting to connect to <span class="event-highlight">@${data.username}</span>...`;
            break;
        case 'disconnected':
            typeLabel = 'DISCONNECTED';
            content = 'Stream connection lost';
            break;
        case 'error':
            typeLabel = 'ERROR';
            content = `Error: ${escapeHtml(data.message)}`;
            break;
        case 'reconnecting':
            typeLabel = 'SYSTEM';
            content = `Reconnecting in ${Math.round(data.delayMs / 1000)}s (Attempt ${data.attempt})`;
            break;
        case 'system':
            typeLabel = 'SYSTEM';
            content = escapeHtml(data.message);
            break;
        default:
            content = JSON.stringify(data);
    }

    eventItem.innerHTML = `
        <div class="event-header">
            <span class="event-type">${typeLabel}</span>
            <span class="event-time">${time}</span>
        </div>
        <div class="event-content">${content}</div>
    `;

    eventContainer.insertBefore(eventItem, eventContainer.firstChild);

    // Apply current filter to new event
    if (currentFilter !== 'all' && !eventItem.classList.contains(currentFilter)) {
        eventItem.style.display = 'none';
    }

    // Limit events
    while (eventContainer.children.length > MAX_EVENTS) {
        eventContainer.removeChild(eventContainer.lastChild);
    }

    // Auto scroll to top for new events (only if filter matches)
    if (currentFilter === 'all' || eventItem.classList.contains(currentFilter)) {
        eventContainer.scrollTop = 0;
    }
}

function handleTikTokEvent(type, data) {
    // Update stats
    switch (type) {
        case 'chat':
            stats.chat++;
            updateStat('chat', stats.chat);
            break;
        case 'gift':
            stats.gift++;
            updateStat('gift', stats.gift);
            break;
        case 'member':
            if (data.action === 'joined') {
                stats.member++;
                updateStat('member', stats.member);
            }
            break;
        case 'like':
            stats.like += data.likeCount || 1;
            updateStat('like', stats.like);
            break;
    }

    // Update status
    switch (type) {
        case 'connected':
            updateStatus('connected', 'Connected', `@${data.username}`);
            break;
        case 'connecting':
            updateStatus('connecting', 'Connecting...', data.username);
            break;
        case 'disconnected':
        case 'closed':
            updateStatus('error', 'Disconnected', 'Attempting to reconnect...');
            break;
        case 'error':
            updateStatus('error', 'Error', data.message);
            break;
        case 'reconnecting':
            updateStatus('connecting', 'Reconnecting...', `Attempt ${data.attempt}`);
            break;
    }

    // Add to event feed
    addEvent(type, data);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animation for stat values
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse-value {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); color: var(--accent-primary); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// Initialize
updateStatus('idle', 'Idle');