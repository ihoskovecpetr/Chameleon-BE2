'use strict';
const logger = require('winston');
require('./winston-mail2').Mail;
const fs = require('fs-extra');
const path = require('path');
const appName = require('../package').name;

const LOG_FILE_NAME = appName;
const APP_NAME = appName.replace(/(-|^)([^-]?)/g, (_, prep, letter) => (prep && ' ') + letter.toUpperCase());

logger.level = process.env.LOGGER_LEVEL ? process.env.LOGGER_LEVEL : 'info';

const logFolder = path.join(__dirname, '../logs');

fs.ensureDirSync(logFolder);

logger.remove(logger.transports.Console);

logger.exitOnError = false;

logger.add(logger.transports.Console, {
    handleExceptions: true,
    colorize: true,
    json: false,
    level: logger.level,
    humanReadableUnhandledException: true,
    timestamp: process.env.LOGGER_LEVEL && process.env.LOGGER_LEVEL === 'debug'
});

if(process.env.NODE_ENV !== 'development' && process.env.LOGGER_LEVEL !== 'debug') {
    logger.add(logger.transports.File, {
        filename: path.join(logFolder, `${LOG_FILE_NAME}.json`),
        name: 'json-log-file',
        json: true,
        level: logger.level,
        handleExceptions: true,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 10,
        tailable: true
    });
    logger.add(logger.transports.File, {
        filename: path.join(logFolder, `${LOG_FILE_NAME}.log`),
        name: 'log-file',
        json: false,
        level: logger.level,
        handleExceptions: true,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 10,
        tailable: true
    });
    logger.add(logger.transports.Mail, {
        to: 'mirek.kozel@gmail.com',
        from: `${APP_NAME} <noreply@upp.cz>`,
        host: 'mail.upp.cz',
        username: 'reklama.booking',
        password: 'gnkbmlkr+7',
        subject: `${APP_NAME} issue report.`,
        level: 'warn', //warn
        unique: false, //false
        frequency: 120
    });
} else {
    logger.info('Development environment - no logging to file and email')
}

module.exports = logger;