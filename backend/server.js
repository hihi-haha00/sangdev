// ============================================
// SERVER ENTRY POINT
// File: backend/server.js
// ============================================

const express = require('express');
const path = require('path');
require('dotenv').config();

const app = require('./app');
const { ensureBootstrapped } = require('./bootstrap');
const humanGateService = require('./services/humanGateService');

const FRONTEND_ROOT = path.join(__dirname, '../frontend');
const APP_ENTRY_FILE = path.join(FRONTEND_ROOT, 'index.html');
const HUMAN_GATE_FILE = path.join(FRONTEND_ROOT, 'human-check.html');
const recaptchaService = require('./services/recaptchaService');

app.use((req, res, next) => {
    const requestPath = String(req.path || '').replace(/\\/g, '/');
    const isProtectedFrontendAsset =
        (requestPath.startsWith('/pages/') && requestPath.endsWith('.html')) ||
        (requestPath.startsWith('/css/') && requestPath.endsWith('.css'));

    if (isProtectedFrontendAsset) {
        return res.status(404).send('Not found');
    }

    return next();
});

function shouldGateHtmlRequest(req) {
    if (!['GET', 'HEAD'].includes(req.method)) {
        return false;
    }

    const requestPath = String(req.path || '').replace(/\\/g, '/');
    if (!requestPath || requestPath.startsWith('/api/') || requestPath.startsWith('/frames/')) {
        return false;
    }

    if (requestPath === '/blocked-ip.html') {
        return false;
    }

    if (requestPath === '/human-check.html') {
        return true;
    }

    const hasExtension = path.extname(requestPath) !== '';
    if (!hasExtension) {
        return true;
    }

    return requestPath.endsWith('.html');
}

app.use((req, res, next) => {
    // If captcha is not configured, skip human gate entirely
    if (!recaptchaService.isEnabled()) {
        return next();
    }

    if (!shouldGateHtmlRequest(req)) {
        return next();
    }

    if (humanGateService.hasClearance(req)) {
        if (req.path === '/human-check.html') {
            return res.redirect(302, '/');
        }
        return next();
    }

    return res.sendFile(HUMAN_GATE_FILE);
});

// Serve static files (local dev)
app.use(express.static(FRONTEND_ROOT, { index: false }));
app.use('/frames', express.static(path.join(__dirname, '../khungcanhan')));

// ============================================
// SERVE INDEX.HTML FOR ALL ROUTES (SPA)
// ============================================
app.get('*', (req, res) => {
    if (!recaptchaService.isEnabled() || humanGateService.hasClearance(req)) {
        return res.sendFile(APP_ENTRY_FILE);
    }

    return res.sendFile(HUMAN_GATE_FILE);
});

// ============================================
// START SERVER
// ============================================
async function startServer() {
    const PORT = process.env.PORT || 3000;

    await ensureBootstrapped({ startTelegramBot: true });

    app.listen(PORT, () => {
        console.log('\n============================================');
        console.log('SOURCE MARKET SERVER');
        console.log(`Server: http://localhost:${PORT}`);
        console.log(`API: http://localhost:${PORT}/api`);
        console.log('============================================\n');
    });
}

startServer();
