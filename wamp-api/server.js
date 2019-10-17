'use strict';

const connectDb = require('./_common/mongodb-connect');
const wamp = require('./src/wamp');
const mongoose = require('mongoose');

const version = require('./package.json').version;
const logger = require('./src/logger');

logger.info(`Chameleon WAMP Api version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

(async () => {
    await wamp.open();
    await connectDb();
})();

// *********************************************************************************************************************
// gracefully shutdown
// *********************************************************************************************************************
const signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

Object.keys(signals).forEach(signal => {
    process.on(signal, async () => {
        try {
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
        } catch(e) {
            logger.warn(`Error during shutdown. ${e}`);
            process.exit(1)
        }
    });
});
