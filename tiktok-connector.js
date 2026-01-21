const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

class TikTokConnector {
    constructor(username, eventCallback) {
        this.username = username;
        this.eventCallback = eventCallback;
        this.connection = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes
        this.reconnectTimer = null;
        this.persistentCheckInterval = null;
    }

    attachHandlers(conn) {
        conn.on(WebcastEvent.CONNECTED, (state) => {
            this.eventCallback('connected', {
                roomId: state.roomId,
                username: this.username,
                timestamp: new Date().toISOString()
            });
        });

        conn.on(WebcastEvent.CHAT, data => {
            this.eventCallback('chat', {
                username: data.user.uniqueId,
                userId: data.user.userId,
                comment: data.comment,
                timestamp: new Date().toISOString()
            });
        });

        conn.on(WebcastEvent.GIFT, data => {
            this.eventCallback('gift', {
                username: data.user.uniqueId,
                userId: data.user.userId,
                giftId: data.giftId,
                giftName: data.giftName || 'Unknown',
                diamondCount: data.diamondCount || 0,
                timestamp: new Date().toISOString()
            });
        });

        conn.on(WebcastEvent.MEMBER, data => {
            this.eventCallback('member', {
                username: data.user.uniqueId,
                action: data.actionId === 1 ? 'joined' : 'left',
                timestamp: new Date().toISOString()
            });
        });

        conn.on(WebcastEvent.LIKE, data => {
            this.eventCallback('like', {
                username: data.user.uniqueId,
                likeCount: data.likeCount || 1,
                totalLikeCount: data.totalLikeCount || 0,
                timestamp: new Date().toISOString()
            });
        });

        conn.on(WebcastEvent.SHARE, data => {
            this.eventCallback('share', {
                username: data.user.uniqueId,
                timestamp: new Date().toISOString()
            });
        });

        conn.on(WebcastEvent.FOLLOW, data => {
            this.eventCallback('follow', {
                username: data.user.uniqueId,
                timestamp: new Date().toISOString()
            });
        });

        conn.on('error', err => {
            console.error('Connection error:', err);
            this.eventCallback('error', {
                message: err.message,
                timestamp: new Date().toISOString()
            });
            
            if (this.isConnected) {
                this.isConnected = false;
                this.scheduleReconnect();
            }
        });

        conn.on('disconnected', () => {
            console.warn('Disconnected event received');
            this.eventCallback('disconnected', {
                timestamp: new Date().toISOString()
            });
            this.isConnected = false;
            this.scheduleReconnect();
        });

        conn.on('close', () => {
            console.warn('Close event received');
            this.eventCallback('closed', {
                timestamp: new Date().toISOString()
            });
            this.isConnected = false;
            this.scheduleReconnect();
        });
    }

    async connect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        this.isConnecting = true;
        this.eventCallback('connecting', {
            username: this.username,
            timestamp: new Date().toISOString()
        });

        try {
            this.connection = new TikTokLiveConnection(this.username);
            this.attachHandlers(this.connection);
            
            const state = await this.connection.connect();
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            console.info(`Connected to roomId ${state.roomId}`);

            // Start persistent check
            this.startPersistentCheck();
            
        } catch (err) {
            this.isConnected = false;
            this.reconnectAttempts += 1;
            console.error('Failed to connect', err);
            
            this.eventCallback('connection-failed', {
                error: err.message,
                attempt: this.reconnectAttempts,
                timestamp: new Date().toISOString()
            });

            const backoff = Math.min(
                1000 * Math.pow(2, this.reconnectAttempts),
                this.MAX_BACKOFF
            ) + Math.floor(Math.random() * 1000);

            this.eventCallback('reconnecting', {
                delayMs: backoff,
                attempt: this.reconnectAttempts,
                timestamp: new Date().toISOString()
            });

            setTimeout(() => this.connect(), backoff);
        } finally {
            this.isConnecting = false;
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 1000);
    }

    startPersistentCheck() {
        if (this.persistentCheckInterval) return;

        this.persistentCheckInterval = setInterval(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.connect();
            }
        }, 15 * 1000);
    }

    cleanup() {
        console.info('Cleaning up TikTok connector...');
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.persistentCheckInterval) {
            clearInterval(this.persistentCheckInterval);
            this.persistentCheckInterval = null;
        }

        if (this.connection) {
            try {
                if (typeof this.connection.disconnect === 'function') {
                    this.connection.disconnect();
                } else if (typeof this.connection.close === 'function') {
                    this.connection.close();
                }
            } catch (err) {
                console.error('Error during cleanup:', err);
            }
            this.connection = null;
        }

        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
}

module.exports = TikTokConnector;
