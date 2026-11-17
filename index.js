
const express = require('express');
const os = require('os');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Express API';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const START_TIME = new Date();

app.use(express.json());

// Request tracking and basic logging
app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    const start = Date.now();

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    res.on('finish', () => {
        console.log(JSON.stringify({
            requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString()
        }));
    });

    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: `Hello from ${APP_NAME}`,
        version: APP_VERSION,
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Liveness probe
app.get('/health', (req, res) => {
    res.status(200).json({
        ok: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Readiness probe
app.get('/ready', (req, res) => {
    res.status(200).json({
        ok: true,
        status: 'ready',
        uptime: process.uptime()
    });
});

// Application information
app.get('/info', (req, res) => {
    res.json({
        name: APP_NAME,
        version: APP_VERSION,
        environment: process.env.NODE_ENV || 'development',
        hostname: os.hostname(),
        platform: os.platform(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        startedAt: START_TIME
    });
});

// Runtime metrics
app.get('/metrics', (req, res) => {
    const memory = process.memoryUsage();

    res.json({
        uptimeSeconds: process.uptime(),
        memory: {
            rss: memory.rss,
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            external: memory.external
        },
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString()
    });
});

// Echo endpoint - test request payloads
app.post('/echo', (req, res) => {
    res.json({
        requestId: req.requestId,
        received: req.body,
        timestamp: new Date().toISOString()
    });
});

// Simulate application latency
app.get('/test/delay', async (req, res) => {
    const delay = Number(req.query.ms || 1000);

    if (!Number.isInteger(delay) || delay < 0 || delay > 30000) {
        return res.status(400).json({
            error: 'Delay must be between 0 and 30000 milliseconds'
        });
    }

    await new Promise(resolve => setTimeout(resolve, delay));

    res.json({
        message: 'Delay completed',
        delayMs: delay
    });
});

// Simulate application errors
app.get('/test/error', (req, res) => {
    const status = Number(req.query.status || 500);

    if (!Number.isInteger(status) || status < 400 || status > 599) {
        return res.status(400).json({
            error: 'Status must be between 400 and 599'
        });
    }

    res.status(status).json({
        error: 'Simulated application error',
        statusCode: status,
        requestId: req.requestId
    });
});

// Simulate temporary service unavailability
app.get('/test/unavailable', (req, res) => {
    res.status(503).json({
        status: 'unavailable',
        message: 'Simulated service unavailability'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        requestId: req.requestId
    });
});

// Centralized error handler
app.use((err, req, res, next) => {
    console.error({
        requestId: req.requestId,
        error: err.message
    });

    res.status(err.status || 500).json({
        error: 'Internal server error',
        requestId: req.requestId
    });
});

// Graceful shutdown
const server = app.listen(PORT, () => {
    console.log(`${APP_NAME} listening on port ${PORT}`);
});

function shutdown(signal) {
    console.log(`${signal} received. Shutting down...`);

    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
