'use strict';

const logger = require('../logger');
//const wamp = require('../wamp');
const db = require('../dbData/mongoDbData');

const PROJECT_AGE_TO_ARCHIVE = process.env.PROJECT_AGE_TO_ARCHIVE || null;

module.exports = async () => {
    logger.debug('Maintenance Job Fired - Skipped for now');
    return;
    try {
        if(PROJECT_AGE_TO_ARCHIVE) {
            const result = await db.setArchiveFlag(PROJECT_AGE_TO_ARCHIVE);
            logger.debug(`Set archive flag: archived ${result.project} projects and ${result.event} off-time events.`);
        }
        else logger.debug(`Set archive flag: no PROJECT_AGE_TO_ARCHIVE has been set, skipping.`);
    } catch (e) {
        logger.warn(`Maintenance:setArchiveFlag Error: ${e}`);
    }
};