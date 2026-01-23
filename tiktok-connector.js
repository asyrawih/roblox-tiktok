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
        this.manuallyStopped = false; // Track manual stops
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
            // Filter out non-critical TikTok API fallback errors
            const isFallbackWarning = err.message && (
                err.message.includes('Failed to extract the SIGI_STATE') ||
                err.message.includes('falling back to API source') ||
                err.message.includes('Failed to retrieve Room ID')
            );
            
            // Don't send error events if we're still connecting (these are internal library errors)
            if (!isFallbackWarning && this.isConnected) {
                console.error('Connection error:', err);
                this.eventCallback('error', {
                    message: err.message,
                    timestamp: new Date().toISOString()
                });
                
                this.isConnected = false;
                this.scheduleReconnect();
            } else if (!isFallbackWarning && !this.isConnecting) {
                // Only log errors that happen when not connecting
                console.error('Connection error:', err);
            }
            // Silently ignore fallback warnings and errors during connection
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
        if (this.isConnecting || this.isConnected || this.manuallyStopped) {
            return;
        }

        this.isConnecting = true;
        this.eventCallback('connecting', {
            username: this.username,
            timestamp: new Date().toISOString()
        });

        // Store original console methods
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        
        // Filter function to suppress TikTok library's expected errors
        const shouldSuppress = (args) => {
            const message = args.join(' ');
            return message.includes('Connection error:') ||
                   message.includes('SIGI_STATE') ||
                   message.includes('falling back to API') ||
                   message.includes('Failed to retrieve Room ID') ||
                   message.includes('you might be blocked by TikTok');
        };

        // Override console methods during connection
        console.error = (...args) => {
            if (!shouldSuppress(args)) {
                originalConsoleError.apply(console, args);
            }
        };
        
        console.warn = (...args) => {
            if (!shouldSuppress(args)) {
                originalConsoleWarn.apply(console, args);
            }
        };

        try {
            this.connection = new TikTokLiveConnection(this.username);
            this.attachHandlers(this.connection);
            
            const state = await this.connection.connect();
            
            // Restore console methods
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            
            console.info(`✓ Successfully connected to @${this.username} (Room ID: ${state.roomId})`);

            // Start persistent check
            this.startPersistentCheck();
            
        } catch (err) {
            // Restore console methods
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
            
            this.isConnected = false;
            this.isConnecting = false;
            this.reconnectAttempts += 1;
            
            // Only log real errors, not TikTok API fallback messages
            const isFallbackError = err.message && (
                err.message.includes('Failed to extract the SIGI_STATE') ||
                err.message.includes('falling back to API')
            );
            
            if (!isFallbackError) {
                console.error('✗ Connection failed:', err.message);
            }
            
            this.eventCallback('connection-failed', {
                error: err.message,
                attempt: this.reconnectAttempts,
                timestamp: new Date().toISOString()
            });

            // Only auto-reconnect if this wasn't the first attempt or if it's a network error
            const shouldRetry = this.reconnectAttempts > 1 || 
                               err.message.includes('LIVE') === false;

            if (shouldRetry && !this.manuallyStopped) {
                const backoff = Math.min(
                    1000 * Math.pow(2, this.reconnectAttempts),
                    this.MAX_BACKOFF
                ) + Math.floor(Math.random() * 1000);

                this.eventCallback('reconnecting', {
                    delayMs: backoff,
                    attempt: this.reconnectAttempts,
                    timestamp: new Date().toISOString()
                });

                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this.connect();
                }, backoff);
            } else {
                // First attempt failed - likely user is not live
                this.eventCallback('not-live', {
                    error: err.message,
                    timestamp: new Date().toISOString()
                });
            }
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
            if (!this.isConnected && !this.isConnecting && !this.manuallyStopped) {
                this.connect();
            }
        }, 15 * 1000);
    }

    cleanup() {
        console.info('Cleaning up TikTok connector...');
        
        // Set flags first to prevent reconnection
        this.manuallyStopped = true; // Mark as manually stopped
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Clear all timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.persistentCheckInterval) {
            clearInterval(this.persistentCheckInterval);
            this.persistentCheckInterval = null;
        }

        // Disconnect the connection
        if (this.connection) {
            try {
                // Remove all event listeners to prevent further events
                if (typeof this.connection.removeAllListeners === 'function') {
                    this.connection.removeAllListeners();
                }
                
                // Disconnect
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

        console.info('Cleanup completed');
    }
}

module.exports = TikTokConnector;