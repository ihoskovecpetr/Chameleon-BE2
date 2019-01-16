'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const connectDb = require('./src/mongodb-connect');
const mongoose = require('mongoose');

const version = require('./package.json').version;
const logger = require('./src/logger');
const wamp = require('./src/wamp');

const validateToken = require('./src/validateToken');

const apiRouterChameleon = require('./src/routers/api-router-chameleon');
const apiRouterAdmin = require('./src/routers/api-router-admin');
const apiRouterProjects = require('./src/routers/api-router-projects');
const apiRouterBudget = require('./src/routers/api-router-budget');
const apiRouterAnalytics = require('./src/routers/api-router-analytics');

// *********************************************************************************************************************
const PORT = 3000;
const HOST = '0.0.0.0';
// *********************************************************************************************************************

logger.info(`Chameleon RESTful Api version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// api info
app.get('/api/v1', validateToken, (req, res) => res.status(200).end('Chameleon RESTful API v.1'));
// api for single applications
app.use('/api/v1/chameleon', apiRouterChameleon);
app.use('/api/v1/admin', apiRouterAdmin);
app.use('/api/v1/projects', apiRouterProjects);
app.use('/api/v1/budget', apiRouterBudget);
app.use('/api/v1/analytics', apiRouterAnalytics);

// *********************************************************************************************************************
// Error handler
// *********************************************************************************************************************
app.use((err, req, res, next) => {
    delete err.stack;
    let statusCode = err.statusCode || 500;
    if(statusCode >= 500) logger.error(`${err}`);
    else logger.warn(`${err}`);
    res.status(statusCode).json({Error: `${err}`});
});

// *********************************************************************************************************************
// SERVER start
// *********************************************************************************************************************
const server = app.listen(PORT, HOST, (err) => {
    if (err) {
        logger.error(err);
        process.exit(1);
    } else {
        logger.info(`Server listening on port: ${PORT}`);
        wamp.open();
        connectDb();
    }
});

// *********************************************************************************************************************
// gracefully shutdown
// *********************************************************************************************************************
const signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

Object.keys(signals).forEach(signal => {
    process.on(signal, async () => {
        logger.info(`Received Signal ${signal}, shutting down.`);
        // WAMP
        await wamp.close();
        logger.info(`WAMP disconnected.`);
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
