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

// Webhook Configuration
let webhookConfig = {
    enabled: false,
    method: 'POST',
    baseUrl: '',
    universeId: '',
    headers: {},
    events: {
        gift: true,
        chat: false,
        member: false,
        like: false,
        follow: false
    },
    topic: 'TIKTOK_EVENT',
    bodyTemplate: '{"topic": "{topic}", "message": "{username}:{message}:{amount}"}'
};

// DOM Elements
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const webhookBtn = document.getElementById('webhook-btn');
const statusBar = document.getElementById('status-bar');
const eventContainer = document.getElementById('event-container');
const filterButtons = document.querySelectorAll('.filter-btn');
const webhookIndicator = document.getElementById('webhook-indicator');

// Modal Elements
const webhookModal = document.getElementById('webhook-modal');
const modalClose = document.getElementById('modal-close');
const saveWebhookBtn = document.getElementById('save-webhook-btn');
const testWebhookBtn = document.getElementById('test-webhook-btn');

const webhookEnabled = document.getElementById('webhook-enabled');
const webhookMethod = document.getElementById('webhook-method');
const webhookUrl = document.getElementById('webhook-url');
const webhookUniverseId = document.getElementById('webhook-universe-id');
const webhookHeaders = document.getElementById('webhook-headers');
const webhookTopic = document.getElementById('webhook-topic');
const webhookBodyTemplate = document.getElementById('webhook-body-template');
const testResult = document.getElementById('test-result');

const webhookEventCheckboxes = {
    gift: document.getElementById('webhook-event-gift'),
    chat: document.getElementById('webhook-event-chat'),
    member: document.getElementById('webhook-event-member'),
    like: document.getElementById('webhook-event-like'),
    follow: document.getElementById('webhook-event-follow')
};

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
webhookBtn.addEventListener('click', openWebhookModal);
modalClose.addEventListener('click', closeWebhookModal);
saveWebhookBtn.addEventListener('click', saveWebhookConfig);
testWebhookBtn.addEventListener('click', testWebhook);

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

// Close modal when clicking outside
webhookModal.addEventListener('click', (e) => {
    if (e.target === webhookModal) {
        closeWebhookModal();
    }
});

// Listen to TikTok events
window.electronAPI.onTikTokEvent((event) => {
    handleTikTokEvent(event.type, event.data);
});

// Load saved webhook config on startup
loadWebhookConfig();

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

    statusDot.classList.remove('idle', 'connecting', 'connected', 'error');
    statusDot.classList.add(state);

    statusText.textContent = message;
    statusInfo.textContent = info;
}

function updateWebhookIndicator() {
    const webhookDot = webhookIndicator.querySelector('.webhook-dot');
    const webhookText = webhookIndicator.querySelector('.webhook-text');
    
    if (webhookConfig.enabled) {
        webhookDot.classList.add('active');
        webhookText.textContent = 'Webhook: Active';
    } else {
        webhookDot.classList.remove('active');
        webhookText.textContent = 'Webhook: Off';
    }
}

function updateStat(type, value) {
    if (statElements[type]) {
        const element = statElements[type];
        element.textContent = value;
        
        element.style.animation = 'none';
        setTimeout(() => {
            element.style.animation = 'pulse-value 0.5s ease';
        }, 10);
    }
}

function addEvent(type, data) {
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
        case 'not-live':
            typeLabel = 'INFO';
            content = `User is not currently live. Will connect automatically when stream starts.`;
            break;
        case 'connection-failed':
            // Only show connection failed if it's a retry (attempt > 1)
            if (data.attempt && data.attempt > 1) {
                typeLabel = 'WARNING';
                content = `Connection attempt ${data.attempt} failed: ${escapeHtml(data.error)}`;
            } else {
                // Skip displaying first attempt failures
                return;
            }
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
        case 'webhook':
            typeLabel = 'WEBHOOK';
            content = `<span class="event-highlight">Sent to webhook</span>: ${escapeHtml(data.event)}`;
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

    if (currentFilter !== 'all' && !eventItem.classList.contains(currentFilter)) {
        eventItem.style.display = 'none';
    }

    while (eventContainer.children.length > MAX_EVENTS) {
        eventContainer.removeChild(eventContainer.lastChild);
    }

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
        case 'not-live':
            updateStatus('error', 'Not Live', 'Waiting for stream to start...');
            break;
        case 'connection-failed':
            // Only show error if it's not the first attempt (connection likely won't succeed)
            if (data.attempt > 1) {
                updateStatus('error', 'Connection Failed', data.error);
            }
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

    // Send to webhook if enabled and event type is selected
    if (webhookConfig.enabled && webhookConfig.events[type]) {
        sendToWebhook(type, data);
    }

    // Add to event feed
    addEvent(type, data);
}

// Webhook Functions
function buildWebhookUrl() {
    let url = webhookConfig.baseUrl;
    
    if (webhookConfig.universeId) {
        url = url.replace('{universeId}', webhookConfig.universeId);
    }
    
    if (webhookConfig.topic) {
        url = url.replace('{topic}', webhookConfig.topic);
    }
    
    return url;
}

function buildWebhookBody(type, data) {
    // Get the template
    let template = webhookConfig.bodyTemplate || '{"topic": "{topic}", "message": "{username}:{message}:{amount}"}';
    
    // Prepare variables based on event type
    let variables = {
        topic: webhookConfig.topic || 'TIKTOK_EVENT',
        eventType: type,
        username: data.username || 'unknown',
        timestamp: data.timestamp || new Date().toISOString(),
        message: '',
        amount: 0
    };
    
    // Set message and amount based on event type
    switch (type) {
        case 'gift':
            variables.message = data.giftName || 'Unknown Gift';
            variables.amount = data.diamondCount || 0;
            variables.giftName = data.giftName || 'Unknown Gift';
            variables.diamondCount = data.diamondCount || 0;
            break;
        case 'chat':
            variables.message = data.comment || '';
            variables.amount = 0;
            variables.comment = data.comment || '';
            break;
        case 'member':
            variables.message = data.action || 'joined';
            variables.amount = 0;
            variables.action = data.action || 'joined';
            break;
        case 'like':
            variables.message = 'liked';
            variables.amount = data.likeCount || 1;
            variables.likeCount = data.likeCount || 1;
            break;
        case 'follow':
            variables.message = 'followed';
            variables.amount = 0;
            break;
        default:
            variables.message = type;
            variables.amount = 0;
    }
    
    // Replace all placeholders in the template
    let bodyString = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        bodyString = bodyString.replace(regex, value);
    }
    
    // Try to parse as JSON, if it fails return as string
    try {
        return JSON.parse(bodyString);
    } catch (error) {
        console.warn('Body template is not valid JSON, sending as string:', error);
        return bodyString;
    }
}

async function sendToWebhook(type, data) {
    if (!webhookConfig.enabled || !webhookConfig.baseUrl) {
        return;
    }
    
    try {
        const url = buildWebhookUrl();
        const body = buildWebhookBody(type, data);
        
        const response = await fetch(url, {
            method: webhookConfig.method,
            headers: webhookConfig.headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error(`Webhook failed: ${response.status} ${response.statusText}: ${text}`);
            
            addEvent('webhook', {
                event: `Failed - ${type}`,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`Webhook sent successfully: ${type}`);
            
            addEvent('webhook', {
                event: `Success - ${type}`,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        
        addEvent('webhook', {
            event: `Error - ${error.message}`,
            timestamp: new Date().toISOString()
        });
    }
}

async function testWebhook() {
    testResult.textContent = 'Testing...';
    testResult.className = 'test-result testing';
    
    try {
        const testConfig = {
            method: webhookMethod.value,
            baseUrl: webhookUrl.value,
            universeId: webhookUniverseId.value,
            topic: webhookTopic.value,
            headers: JSON.parse(webhookHeaders.value || '{}')
        };
        
        const tempConfig = { ...webhookConfig };
        webhookConfig = { ...webhookConfig, ...testConfig, enabled: true };
        
        const testData = {
            username: 'TestUser',
            giftName: 'TestGift',
            diamondCount: 100,
            timestamp: new Date().toISOString()
        };
        
        await sendToWebhook('gift', testData);
        
        webhookConfig = tempConfig;
        
        testResult.textContent = '✓ Test sent successfully';
        testResult.className = 'test-result success';
        
        setTimeout(() => {
            testResult.textContent = '';
        }, 3000);
    } catch (error) {
        testResult.textContent = `✗ Error: ${error.message}`;
        testResult.className = 'test-result error';
    }
}

function openWebhookModal() {
    webhookModal.style.display = 'flex';
    loadWebhookToUI();
}

function closeWebhookModal() {
    webhookModal.style.display = 'none';
}

function loadWebhookToUI() {
    webhookEnabled.checked = webhookConfig.enabled;
    webhookMethod.value = webhookConfig.method;
    webhookUrl.value = webhookConfig.baseUrl;
    webhookUniverseId.value = webhookConfig.universeId;
    webhookHeaders.value = JSON.stringify(webhookConfig.headers, null, 2);
    webhookTopic.value = webhookConfig.topic;
    webhookBodyTemplate.value = webhookConfig.bodyTemplate || '{"topic": "{topic}", "message": "{username}:{message}:{amount}"}';
    
    Object.keys(webhookEventCheckboxes).forEach(key => {
        if (webhookEventCheckboxes[key]) {
            webhookEventCheckboxes[key].checked = webhookConfig.events[key] || false;
        }
    });
}

function saveWebhookConfig() {
    try {
        webhookConfig.enabled = webhookEnabled.checked;
        webhookConfig.method = webhookMethod.value;
        webhookConfig.baseUrl = webhookUrl.value;
        webhookConfig.universeId = webhookUniverseId.value;
        webhookConfig.headers = JSON.parse(webhookHeaders.value || '{}');
        webhookConfig.topic = webhookTopic.value;
        webhookConfig.bodyTemplate = webhookBodyTemplate.value;
        
        // Validate body template is valid JSON
        try {
            const testBody = webhookConfig.bodyTemplate.replace(/\{[^}]+\}/g, '""');
            JSON.parse(testBody);
        } catch (error) {
            if (!confirm('Body template may not be valid JSON. Save anyway?')) {
                return;
            }
        }
        
        Object.keys(webhookEventCheckboxes).forEach(key => {
            if (webhookEventCheckboxes[key]) {
                webhookConfig.events[key] = webhookEventCheckboxes[key].checked;
            }
        });
        
        // Save to localStorage
        localStorage.setItem('webhookConfig', JSON.stringify(webhookConfig));
        
        updateWebhookIndicator();
        closeWebhookModal();
        
        addEvent('system', {
            message: 'Webhook configuration saved',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        alert(`Error saving config: ${error.message}`);
    }
}

function loadWebhookConfig() {
    try {
        const saved = localStorage.getItem('webhookConfig');
        if (saved) {
            webhookConfig = { ...webhookConfig, ...JSON.parse(saved) };
            updateWebhookIndicator();
        }
    } catch (error) {
        console.error('Error loading webhook config:', error);
    }
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
updateWebhookIndicator();