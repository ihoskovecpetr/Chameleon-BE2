'use strict';
const mongoose = require('mongoose');
const logger = require('../src/logger');

const config = {
    host: process.env.MONGO_DB_HOST,
    port: process.env.MONGO_DB_PORT,
    database: process.env.MONGO_DB_DATABASE,
    user: process.env.MONGO_DB_USER,
    password: process.env.MONGO_DB_PASSWORD,
    reconnectInterval: 15, //seconds
    firstConnectionTriesToError: 8, //tries * reconnectInterval => 8 = 2min
    connectionTriesToError: 40 //tries * reconnectInterval => 40 = 10min
};

let mongoWasConnectedBefore = false;
let mongoStartupConnectionTry = 0;

let disconnectTimer = null;

mongoose.Promise = global.Promise;

const dbURI = `mongodb://${config.host}:${config.port}/${config.database}?authSource=admin`;
const dbOptions = {
    user: config.user,
    pass: config.password,
    autoReconnect: true,
    keepAlive: 1,
    connectTimeoutMS: 30000,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: config.reconnectInterval * 1000,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
};

module.exports = async () => {
    const connect = async function() {
        await mongoose.connect(dbURI, dbOptions);
    };

    mongoose.connection.on('connected', function () {
        if(disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
        }
        logger.info('Connected to ' + dbURI);
    });

    mongoose.connection.on('error', function (err) {
        if (mongoWasConnectedBefore) logger.error('Connection error: ' + err);
    });

    mongoose.connection.on('disconnected', function () {
        if (mongoWasConnectedBefore) {
            logger.warn(`Mongo DB disconnected - retrying interval ${config.reconnectInterval} seconds.`);
            disconnectTimer = setTimeout(() => {
                logger.error(`Failed to reconnect to Mongo DB  in ${config.connectionTriesToError * config.reconnectInterval} seconds, keep retrying.`);
            }, config.reconnectInterval * config.connectionTriesToError * 1000);
        } else {
            if(mongoStartupConnectionTry === 0) logger.warn(`Failed to connect to Mongo DB on startup - retrying interval ${config.reconnectInterval} seconds.`);
            if(mongoStartupConnectionTry === config.firstConnectionTriesToError) logger.error(`Failed to connect to Mongo DB on startup in ${config.firstConnectionTriesToError * config.reconnectInterval} seconds, keep retrying.`);
            mongoStartupConnectionTry += 1;
            setTimeout(connect, config.reconnectInterval * 1000);
        }
    });

    mongoose.connection.once('open', function () {
        mongoWasConnectedBefore = true;
    });

    await connect()
};
