'use strict';

const winston = require('winston');
const logTag = require('../package')['log-tag'];

const config = {
    host: process.env.FLUENTD_IPV4,
    port: 24224,
    timeout: 3.0,
    requireAckResponse: true // Add this option to wait response from Fluentd certainly
};
const fluentTransport = require('fluent-logger').support.winstonTransport();
const logger = winston.createLogger({
    transports: [new fluentTransport(`chameleon.${logTag}`, config), new (winston.transports.Console)()]
});
logger.level = process.env.LOGGER_LEVEL ? process.env.LOGGER_LEVEL : 'info';

logger.on('logging', (transport, level, message, meta) => {
    if (meta.end && transport.sender && transport.sender.end) {
        transport.sender.end();
    }
});

module.exports = logger;