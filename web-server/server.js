'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const version = require('./package.json').version;
const logger = require('./src/logger');

const validateToken = require('./src/validateToken');
const authenticate =  require('./src/authenticate');

// *********************************************************************************************************************
const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTHENTICATION_COOKIE_OPTION = {httpOnly: true, secure: process.env.AUTH_COOKIE_HTTPS_ONLY !== 'false'};

const PORT = 3000;
const HOST = '0.0.0.0';

const APPLICATIONS = [
    {path: '/login', file: '/www/html/login.html', authenticate: false, clearCookie: true},
    {path: '/logout', file: '/www/html/hub.html', authenticate: false, clearCookie: true},
    {path: '/', file: '/www/html/hub.html', authenticate: false, clearCookie: false},
    {path: '/hub', file: '/www/html/hub.html', authenticate: false, clearCookie: false},
    {path: '/projects', file: '/www/html/projects.html', authenticate: true, clearCookie: false},
    {path: '/admin', file: '/www/html/admin.html', authenticate: true, clearCookie: false},
    {path: '/booking', file: '/www/html/booking.html', authenticate: true, clearCookie: false},
    {path: '/budget', file: '/www/html/budget.html', authenticate: true, clearCookie: false},
    {path: '/analytics', file: '/www/html/analytics.html', authenticate: true, clearCookie: false}
];
// *********************************************************************************************************************

logger.info(`Chameleon Web Server version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// reset authenticate and set token if valid user
app.post('/authenticate', async (req, res) => {
    const tokenData = await authenticate(req.body.username, req.body.password);
    if(tokenData.token) {
        logger.info(`User '${req.body.username}' authenticated, token: ${tokenData.token}.`);
        res.cookie(AUTHENTICATION_COOKIE_NAME, tokenData.token, AUTHENTICATION_COOKIE_OPTION);
        res.status(200).json();
    } else {
        logger.warn(`User '${req.body.username}' not authenticated. ${tokenData.error}`);
        res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.status(401).json(tokenData);
    }
});

// reset authentication token
app.delete('/authenticate', (req, res) => {
    res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
    res.status(200).json();
});

// applications entry points
for(const application of APPLICATIONS) {
    if(application.authenticate) app.get(application.path, validateToken, (req, res) => {
        if(application.clearCookie) res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.sendFile(path.join(__dirname, application.file))
    });
    else app.get(application.path, (req, res) => {
        if(application.clearCookie) res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.sendFile(path.join(__dirname, application.file))
    });
}

// serve static files
app.use(express.static(__dirname + '/www/static'));

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
