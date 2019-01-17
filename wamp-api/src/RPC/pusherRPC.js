'use strict';
const pusherClient = require('../lib/pusherClient');
const db = require('../dbData/mongoDb-pusher');
const logger = require('../logger');

module.exports = {
    'getPusherClients': getPusherClients,
    'getWorklogsForUser': getWorklogsForUser
};

function getPusherClients(args, kwargs, details) {
    try {
        return pusherClient.getClients()
    } catch(error) {
        logger.warn("getPusherClients error: " + error);
        throw error;
    }
}

async function getWorklogsForUser(args, kwargs, details) {
    try {
        logger.debug('getWorklogsForUser ' + kwargs.user + ' ' + kwargs.full);
        const worklogs = await db.getWorklogsForUser(kwargs.user, kwargs.full);
        return {projects: worklogs};
    } catch(error) {
        logger.warn("getWorklogsForUser error: " + error);
        throw error;
    }
}