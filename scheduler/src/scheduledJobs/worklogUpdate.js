'use strict';

const logger = require('../logger');
const wamp = require('../wamp');

module.exports = async () => {
    logger.debug('Worklog Update Job Fired');
    wamp.publish('all.worklogupdate');
};