const http = require('http');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // Set CORS headers (optional, useful for browser requests)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Only accept POST requests
    if (req.method === 'POST') {
        let body = '';

        // Collect data chunks
        req.on('data', chunk => {
            body += chunk.toString();
        });

        // When all data is received
        req.on('end', () => {
            try {
                // Try to parse as JSON
                const data = JSON.parse(body);
                
                console.log('Received POST request:');
                console.log('Headers:', req.headers);
                console.log('Body:', data);

                // Send success response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Data received successfully',
                    receivedData: data
                }));
            } catch (error) {
                // If JSON parsing fails, treat as plain text
                console.log('Received POST request (plain text):');
                console.log('Body:', body);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Data received successfully',
                    receivedData: body
                }));
            }
        });

        // Handle errors
        req.on('error', (error) => {
            console.error('Request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Internal server error'
            }));
        });
    } else {
        // Reject non-POST requests
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Method not allowed. Only POST requests are accepted.'
        }));
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Ready to accept POST requests...');
});