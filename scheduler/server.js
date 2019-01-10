'use strict';

const connectDb = require('./src/mongodb-connect');
const wamp = require('./src/wamp');
const mongoose = require('mongoose');

const version = require('./package.json').version;
const logger = require('./src/logger');

logger.info(`Chameleon Scheduler version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

wamp.open();
connectDb();

setInterval(() => logger.debug('Scheduler Tick'), 10000);

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
        // Shutdown
        process.exit(128 + signals[signal]);
    });
});
