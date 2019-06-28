'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const connectDb = require('./src/mongodb-connect');
const mongoose = require('mongoose');

const version = require('./package.json').version;
const logger = require('./src/logger');
const device = require('express-device');

const validateToken = require('./src/validateToken');
const authenticate =  require('./src/authenticate');
const basicAuth = require('basic-auth');

// *********************************************************************************************************************
const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTHENTICATION_COOKIE_OPTION = {httpOnly: false, secure: process.env.AUTH_COOKIE_HTTPS_ONLY !== 'false'};
const PUSHER_UPDATE_ENABLED = process.env.PUSHER_UPDATE_ENABLED === 'true';
const PUSHER_UPDATE_HOST = process.env.PUSHER_UPDATE_HOST;
const PUSHER_UPDATE_PORT = process.env.PUSHER_UPDATE_PORT ? `:${process.env.PUSHER_UPDATE_PORT}` : '';
const PUSHER_UPDATE_SSL = process.env.PUSHER_UPDATE_SSL && process.env.PUSHER_UPDATE_SSL === 'true';

const PLATFORM_RELEASE_FILE_TEMPLATE = {
    mac: 'Pusher-x.y.z-mac.zip',
    linux: 'pusher-x.y.z-x86_64.AppImage'
};

const PORT = 3000;
const HOST = '0.0.0.0';

const APPLICATIONS = [
    {path: '/login', file: '/www/html/login.html', authenticate: false, ignoreExpirationOnMobile: true, clearCookie: true},
    {path: '/logout', file: '/www/html/hub.html', authenticate: false, ignoreExpirationOnMobile: true, clearCookie: true},
    {path: '/', file: '/www/html/hub.html', authenticate: false, ignoreExpirationOnMobile: true, clearCookie: false},
    {path: '/hub', file: '/www/html/hub.html', authenticate: false, ignoreExpirationOnMobile: false, clearCookie: false},
    {path: '/projects', file: '/www/html/projects.html', authenticate: true, ignoreExpirationOnMobile: false, clearCookie: false},
    {path: '/admin', file: '/www/html/admin.html', authenticate: true, ignoreExpirationOnMobile: false, clearCookie: false},
    {path: '/booking', file: '/www/html/booking.html', authenticate: true, ignoreExpirationOnMobile: false, clearCookie: false},
    {path: '/budget', file: '/www/html/budget.html', authenticate: true, ignoreExpirationOnMobile: false, clearCookie: false},
    {path: '/analytics', file: '/www/html/analytics.html', authenticate: true, ignoreExpirationOnMobile: false, clearCookie: false},
    {path: '/pusher', file: '/www/html/pusher.html', authenticate: true, ignoreExpirationOnMobile: true, clearCookie: false}
];
// *********************************************************************************************************************

logger.info(`Chameleon Web Server version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(device.capture());

// pusher app authentication
app.get('/pusher/auth', async (req, res) => {
    try {
        const user = basicAuth(req);
        const authenticatedUser = await authenticate(user.name, user.pass, true);
        if(authenticatedUser.error) res.status(403).send('403 Forbidden');
        else res.status(200).json(authenticatedUser);
    } catch (e) {
        res.status(403).send('403 Forbidden');
    }
});

// reset authenticate and set token if valid user
app.post('/authenticate', async (req, res) => {
    const authenticationData = await authenticate(req.body.username, req.body.password);
    if(authenticationData.token) {
        logger.info(`User '${req.body.username}' authenticated, token: ${authenticationData.token}, name: ${authenticationData.userName}`);
        res.cookie(AUTHENTICATION_COOKIE_NAME, authenticationData.token, AUTHENTICATION_COOKIE_OPTION);
        res.status(200).json();
    } else {
        logger.warn(`User '${req.body.username}' not authenticated. ${authenticationData.error}`);
        res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.status(401).json(authenticationData);
    }
});

// reset authentication token
app.delete('/authenticate', (req, res) => {
    res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
    res.status(200).json();
});

// applications entry points
for(const application of APPLICATIONS) {
    app.get(application.path, application.authenticate? [setIgnoreExpirationOnMobile(application.ignoreExpirationOnMobile), validateToken] : [], (req, res) => {
        if(application.clearCookie) res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        //else if(req.cookies[AUTHENTICATION_COOKIE_NAME]) res.setHeader(`Auth-Token`, req.cookies[AUTHENTICATION_COOKIE_NAME]);
        res.sendFile(path.join(__dirname, application.file))
    });
}

function setIgnoreExpirationOnMobile(ignoreExpirationOnMobile) {
    return (req, res, next) => {
        req.ignoreExpiration = ignoreExpirationOnMobile && req.device.type === 'phone';
        next();
    };
}

// serve static files
app.use(express.static(__dirname + '/www/static'));

// ================ PUSHER UPDATE SUPPORT ==============================================================================
if(PUSHER_UPDATE_ENABLED) {
    logger.info(`Pusher update enabled.`);
    app.use('/pusher/releases', (req, res, next) => {
        if(req.url[req.url.length - 1] === '/') req.url = req.url.substr(0, req.url.length - 1);
        next();
    }, express.static(path.join(__dirname, 'pusher-releases')));
    app.use('/pusher/releases/:platform/latest', pusherReleaseRouter);
}

function pusherReleaseRouter(req, res) {
    const latest = getLatestRelease(req.params.platform, req.query.v);
    if (!latest ) {
        logger.debug(`Pusher update requested, platform: ${req.params.platform} - no new version.`);
        res.status(204).end();
    } else {
        logger.debug(`Pusher update requested, platform: ${req.params.platform} - new version: ${latest}`);
        res.json({url: `http${PUSHER_UPDATE_SSL ? 's' : ''}://${PUSHER_UPDATE_HOST}${PUSHER_UPDATE_PORT}/pusher/releases/${req.params.platform}/${latest}`});
    }
}


function getLatestRelease(platform, currentVersion) {
    if(!PLATFORM_RELEASE_FILE_TEMPLATE[platform]) return null;
    const dir = path.join(__dirname, 'pusher-releases', platform);
    const fileRegex = new RegExp(`^${PLATFORM_RELEASE_FILE_TEMPLATE[platform].replace('x.y.z', '(\\d+\\.\\d+\\.\\d+)')}$`, 'i');
    const versionsDesc = fs.readdirSync(dir)
        .filter(file => fileRegex.test(file))
        .map(file => file.match(fileRegex)[1] || '0.0.0')
        .sort(compareVersion);
    const latest = versionsDesc[0];
    if(!latest || latest === currentVersion) return null;
    else return PLATFORM_RELEASE_FILE_TEMPLATE[platform].replace('x.y.z', latest);
}

function compareVersion(a, b) {
    let i, cmp, len, re = /(\.0)+[^\.]*$/;
    a = (a + '').replace(re, '').split('.');
    b = (b + '').replace(re, '').split('.');
    len = Math.min(a.length, b.length);
    for( i = 0; i < len; i++ ) {
        cmp = parseInt(b[i], 10) - parseInt(a[i], 10);
        if( cmp !== 0 ) {
            return cmp;
        }
    }
    return b.length - a.length;
}
// =====================================================================================================================

// *********************************************************************************************************************
const server = app.listen(PORT, HOST, (err) => {
    if (err) {
        logger.error(err);
        process.exit(1);
    } else {
        logger.info(`Server listening on port: ${PORT}`);
        connectDb();
    }
});

// gracefully shutdown -------------------------------------------------------------------------------------------------
const signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

Object.keys(signals).forEach(signal => {
    process.on(signal, async () => {
        logger.info(`Received Signal ${signal}, shutting down.`);
        // Mongo DB
        logger.info('Disconnecting MongoDb...');
        await mongoose.connection.close();
        logger.info(`MongoDb disconnected.`);
        // Server
        logger.info('Stopping server gracefully...');
        await server.close();
        logger.info(`Server stopped.`);
        // Shutdown
        process.exit(128 + signals[signal]);
    });
});
