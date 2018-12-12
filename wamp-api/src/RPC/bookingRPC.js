'use strict';

const db = require('../dbData/mongoDb-booking');
const logger = require('../logger');

module.exports = {
    'initData': getInitData,
    /*'updateEvent': updateEvent,
    'addEvent': addEvent,
    'removeEvent': removeEvent,
    'splitEvent': splitEvent,
    'joinEvents': joinEvents,
    'addProject': addProject,
    'updateProject': updateProject,
    'removeProject': removeProject,
    'reorderGroups': reorderGroups,
    'reorderResource': reorderResource,
    'addGroup': addGroup,
    'updateGroup': updateGroup,
    'removeGroup': removeGroup,
    'addResource': addResource,
    'updateResource': updateResource,
    'addProjectAndEvent': addProjectAndEvent,
    'getNumberOfEventsForResource': getNumberOfEventsForResource,
    'removeResource': removeResource,
    'changeUserPin': changeUserPin*/
};

// *********************************************************************************************************************
// GET ALL DATA
// *********************************************************************************************************************
async function getInitData(args, kwargs, details) {
    try {
        const start = Date.now();
        logger.debug(`Requested init data. Caller: ${args.length > 0 ? `${args[0]}, ` : ''}${details.caller}`);
        const [groups, resources, holidays, projects, events, jobs, users] = await Promise.all([
            db.getResourceGroups(),
            db.getResources(),
            db.getHolidays(),
            db.getProjects(),
            db.getEvents(),
            db.getJobs(),
            db.getUsers()
        ]);
        logger.debug(`Init data time: ${Date.now() - start}ms`);
        return {groups, resources, holidays, projects, events, jobs, users, lockedEvents: []}//TODO lockedEvents.map(item => item.id)}
    } catch (error) {
        logger.error(`getInitData error for user "${args.length > 0 ? `${args[0]}, ` : 'Unknown'}": ${error}`);
        throw error;
    }
}