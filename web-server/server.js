'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const version = require('./package.json').version;
const logger = require('./src/logger');
const device = require('express-device');

const validateToken = require('./src/validateToken');
const authenticate =  require('./src/authenticate');

// *********************************************************************************************************************
const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTHENTICATION_COOKIE_OPTION = {httpOnly: true, secure: process.env.AUTH_COOKIE_HTTPS_ONLY !== 'false'};
const PUSHER_UPDATE_ENABLED = process.env.PUSHER_UPDATE_ENABLED === 'true';

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

// reset authenticate and set token if valid user
app.post('/authenticate', async (req, res) => {
    const authenticationData = await authenticate(req.body.username, req.body.password);
    if(authenticationData.token) {
        logger.info(`User '${req.body.username}' authenticated, token: ${authenticationData.token}.`);
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
    if(application.authenticate) app.get(application.path, [setIgnoreExpirationOnMobile(application.ignoreExpirationOnMobile), validateToken], (req, res) => {
        if(application.clearCookie) res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.sendFile(path.join(__dirname, application.file))
    });
    else app.get(application.path, (req, res) => {
        if(application.clearCookie) res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
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
    //TODO validate user (token) ???
    /*app.use('/pusher/releases', express.static(path.join(__dirname, 'pusher-releases')));

    app.get('/pusher/releases/mac/latest', function(req, res) {
        const latest = getLatestRelease('mac','.zip');
        const clientVersion = req.query.v;
        if (!latest || clientVersion === latest) {
            res.status(204).end();
        } else {
            res.json({
                url: "https://booking.upp.cz/pusher/releases/mac/Pusher-" + latest + "-mac.zip"
            });
        }
    });

    app.get('/pusher/releases/linux/latest', function(req, res) {
        const latest = getLatestRelease('linux', '.AppImage');
        const clientVersion = req.query.v;
        if (!latest || clientVersion === latest) {
            res.status(204).end();
        } else {
            res.json({
                url: "https://booking.upp.cz/pusher/releases/linux/pusher-" + latest + "-x86_64.AppImage"
            });
        }
    });

    app.get('/pusher', function (req, res) {
        res.sendFile(path.join(__dirname, 'html/pusher.html'));
    });

    function getLatestRelease(platformFolder, platformExtension) {
        const dir = path.join(__dirname, 'pusher_releases', platformFolder);
        const versionsDesc = fs.readdirSync(dir)
            .filter(function(file){ return file.indexOf(platformExtension) === file.length - platformExtension.length})
            .map(function(file){
                const f = file.split('-');
                if(f.length === 3) return f[1];
                else return '0.0.0';
            }).sort(compareVersion);
        return versionsDesc[0];
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
    }*/
}
// =====================================================================================================================

// *********************************************************************************************************************
const server = app.listen(PORT, HOST, (err) => {
    if (err) {
        logger.error(err);
        process.exit(1);
    } else logger.info(`Server listening on port: ${PORT}`);
});

// gracefully shutdown -------------------------------------------------------------------------------------------------
const signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

Object.keys(signals).forEach(signal => {
    process.on(signal, async () => {
        logger.info(`Received Signal ${signal}, shutting down.`);
        // Server
        logger.info('Stopping server gracefully...');
        await server.close();
        logger.info(`Server stopped.`);
        // Shutdown
        process.exit(128 + signals[signal]);
    });
});
