# TikTok Live Monitor - Desktop Application

A modern desktop application for monitoring TikTok Live streams in real-time. Built with Electron and featuring a distinctive retro-futuristic UI.

![TikTok Live Monitor](screenshot.png)

## Features

- 🎯 **Real-time Monitoring**: Track chat messages, gifts, likes, follows, and more
- 📊 **Live Statistics**: Visual dashboard showing real-time metrics
- 🔄 **Auto-Reconnection**: Automatic reconnection with exponential backoff
- 💎 **Event Feed**: Scrollable feed of all stream events
- 🎨 **Modern UI**: Retro-futuristic terminal-inspired design
- ⚡ **Performance**: Efficient event handling with rate limiting

## Supported Events

- 💬 Chat Messages
- 🎁 Gift Donations (with diamond count)
- 👥 New Members (joins/leaves)
- ❤️ Likes
- 👤 Follows
- 🔗 Shares
- 🔌 Connection Status

## Installation

### Prerequisites

- Node.js 16+ and npm

### Setup

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

## Usage

### Development Mode

Run the application in development mode:

```bash
npm start
```

### Building for Production

Build executables for your platform:

```bash
# Build for current platform
npm run build

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

Built applications will be in the `dist` folder.

## How to Use

1. **Launch the Application**
   - Open the TikTok Live Monitor application

2. **Enter Username**
   - Type the TikTok username (without @) of the streamer you want to monitor
   - Example: `barooonn__`

3. **Start Monitoring**
   - Click "Start Monitoring" or press Enter
   - The app will attempt to connect to the live stream

4. **View Events**
   - All events appear in real-time in the event feed
   - Statistics are updated automatically
   - Events are color-coded by type

5. **Stop Monitoring**
   - Click "Stop" to disconnect
   - You can start monitoring another stream

6. **Clear Feed**
   - Click "Clear" to empty the event feed

## Technical Details

### Architecture

- **Main Process** (`main.js`): Manages application window and IPC
- **Renderer Process** (`renderer.js`): Handles UI logic and user interactions
- **Preload Script** (`preload.js`): Secure bridge between main and renderer
- **TikTok Connector** (`tiktok-connector.js`): Manages TikTok Live API connection

### Connection Features

- **Exponential Backoff**: Intelligent retry logic (1s, 2s, 4s, 8s... up to 5 minutes)
- **Persistent Checking**: Attempts reconnection every 15 seconds if disconnected
- **Event Tracking**: All connection states are logged and displayed
- **Graceful Shutdown**: Proper cleanup on application close

### UI Features

- **Scanline Effect**: Retro CRT monitor aesthetic
- **Glow Effects**: Neon-style accents and animations
- **Real-time Stats**: Animated counters for each event type
- **Event Feed**: Auto-scrolling with 100 event limit
- **Responsive Design**: Works on various screen sizes

## Customization

### Changing Colors

Edit `styles.css` and modify the CSS variables:

```css
:root {
    --accent-primary: #00ff9d;    /* Primary accent color */
    --accent-secondary: #00ccff;  /* Secondary accent color */
    --accent-tertiary: #ff00ff;   /* Tertiary accent color */
    /* ... */
}
```

### Adjusting Reconnection

Edit `tiktok-connector.js`:

```javascript
this.MAX_BACKOFF = 5 * 60 * 1000; // Maximum backoff delay
```

### Event Limit

Edit `renderer.js`:

```javascript
const MAX_EVENTS = 100; // Maximum events in feed
```

## Troubleshooting

### Connection Issues

- **"Failed to connect"**: The user may not be live, or the username is incorrect
- **Frequent disconnections**: Network issues or TikTok rate limiting
- **No events appearing**: The stream may have no activity

### Performance

- If the app becomes slow with many events, click "Clear" to reset the feed
- The app automatically limits events to 100 items

### Building Issues

- Make sure all dependencies are installed: `npm install`
- Clear node_modules and reinstall if build fails: `rm -rf node_modules && npm install`

## Dependencies

- **Electron**: Desktop application framework
- **tiktok-live-connector**: TikTok Live API wrapper

## License

MIT

## Credits

Built by Asyrawi using Electron and the TikTok Live Connector library.

## Disclaimer

This application uses the unofficial TikTok Live API. Use responsibly and in accordance with TikTok's Terms of Service.
