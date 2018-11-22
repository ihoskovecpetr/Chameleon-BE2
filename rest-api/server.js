'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const connectDb = require('./src/mongodb-connect');
const mongoose = require('mongoose');

const version = require('./package.json').version;
const logger = require('./src/logger');

const validateToken = require('./src/validateToken');

const apiRouterUser = require('./src/routers/api-router-user');
const apiRouterProject = require('./src/routers/api-router-project');

// *********************************************************************************************************************
const PORT = 3000;
const HOST = '0.0.0.0';
// *********************************************************************************************************************

logger.info(`Chameleon RESTful Api version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/api', validateToken, (req, res) => res.status(200).end('Chameleon RESTful API'));

app.use('/api/users', apiRouterUser);
app.use('/api/project', apiRouterProject);

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
