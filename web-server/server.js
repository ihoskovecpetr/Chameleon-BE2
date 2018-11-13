'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const version = require('./package.json').version;
const logger = require('./src/logger');

const validateToken = require('./src/validateToken');
const authenticate =  require('./src/authenticate');

const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTHENTICATION_COOKIE_OPTION = {httpOnly: true, secure: process.env.NODE_ENV !== 'development'};

// *********************************************************************************************************************
const PORT = 3000;
const HOST = '0.0.0.0';
// *********************************************************************************************************************

logger.info("=========================================================================");
logger.info(`Chameleon Web Server version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);
logger.info("=========================================================================");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/login', (req, res) => {
    res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
    res.sendFile(path.join(__dirname, '/www/html/login.html'));
});

app.get('/logout', (req, res) => {
    res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
    res.sendFile(path.join(__dirname, '/www/html/hub.html'));
});

app.delete('/authenticate', (req, res) => {
    res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
    res.status(200).json();
});

app.post('/authenticate', async (req, res) => {
    const tokenData = await authenticate(req.body.username, req.body.password);
    //logger.info(tokenData);
    if(tokenData.token) {
        res.cookie(AUTHENTICATION_COOKIE_NAME, tokenData.token, AUTHENTICATION_COOKIE_OPTION);
        res.status(200).json();
    } else {
        res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.status(401).json(tokenData);
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/www/html/hub.html')));
app.get('/hub', (req, res) => res.sendFile(path.join(__dirname, '/www/html/hub.html')));
app.get('/projects',  validateToken, (req, res) => res.sendFile(path.join(__dirname, '/www/html/projects.html')));


app.use(express.static(__dirname + '/www/static'));

// *********************************************************************************************************************
app.listen(PORT, HOST, (err) => {
    if (err) logger.error(err);
    else logger.info(`Server listening on port: ${PORT}`);
});
