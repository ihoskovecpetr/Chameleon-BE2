'use strict';

const db = require('../dbData/mongoDb-booking');
const logger = require('../logger');
const moment = require('moment');
const wamp = require('../wamp');

const LOCK_VALID_TIME = 1000;

let lockedEvents = [];

setInterval(checkLockedEvents, LOCK_VALID_TIME + 500);;

module.exports = {
    'getData': getData,
    'updateEvent': updateEvent,
    'addEvent': addEvent,
    'removeEvent': removeEvent,
    'splitEvent': splitEvent,
    'joinEvents': joinEvents/*,
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
    'changeUserPin': changeUserPin*/,

    'lockEvent': lockEvent,
    'releaseEvent': releaseEvent
};

// *********************************************************************************************************************
// GET ALL DATA
// *********************************************************************************************************************
async function getData(args, kwargs, details) {
    try {
        const start = Date.now();
        logger.debug(`Requested data. Caller: ${args.length > 0 ? `${args[0]}, ` : ''}${details.caller}`);
        const [groups, resources, holidays, projects, events, jobs, users] = await Promise.all([
            db.getResourceGroups(),
            db.getResources(),
            db.getHolidays(),
            db.getProjects(),
            db.getEvents(),
            db.getJobs(),
            db.getUsers()
        ]);
        logger.debug(`Getdata time: ${Date.now() - start}ms`);
        return {groups, resources, holidays, projects, events, jobs, users, lockedEvents: lockedEvents.map(item => item.id)}
    } catch (error) {
        logger.error(`getData error, user: "${args.length > 0 ? `${args[0]}, ` : 'Unknown'}" :: ${error}`);
        throw error;
    }
}

// *********************************************************************************************************************
// EVENTS
// *********************************************************************************************************************
async function updateEvent(args, kwargs, details) {
    try {
        logger.debug('updateEvent');
        let oldEvent = await db.updateEvent(kwargs.id, kwargs.event);
        oldEvent = oldEvent.toObject({versionKey: false});
        delete oldEvent._id;
        oldEvent.startDate = moment(oldEvent.startDate).format('YYYY-MM-DD');
        for(const day of oldEvent.days) delete day._id;
        const result = {id: kwargs.id, event: kwargs.event, fromProject: kwargs.fromProject, oldEvent: oldEvent};
        wamp.publish('updateEvent', [], result, {exclude : [details.caller]});
        await db.logOp('updateEvent', args[0], kwargs, null);
        /*
        updatePusherData({
            event: {
                id: kwargs.id,
                previous: oldEvent,
                current:  kwargs.event
            }
        });
        if(oldEvent.isShooting || kwargs.event.isShooting) pusherCheck(session, false);
        */
        return result;
    } catch (error) {
        await db.logOp('updateEvent', args[0], kwargs, error);
        logger.error("Update Event Rejected: " + error);
        throw error;
    }
}

async function addEvent(args, kwargs, details) {
    try {
        logger.debug('addEvent');
        await db.addEvent(kwargs.id, kwargs.event);
        const result = {id: kwargs.id, event: kwargs.event};
        wamp.publish('addEvent', [], result, {exclude : [details.caller]});
        await db.logOp('addEvent', args[0], kwargs, null);
        /*
        updatePusherData({
            event: {
                id: kwargs.id,
                previous: null,
                current:  kwargs.event
            }
        });
        if(kwargs.event.isShooting) pusherCheck(session, false);
        */
        return result;
    } catch (error) {
        await db.logOp('addEvent', args[0], kwargs, error);
        logger.error("Add Event Rejected: " + error);
        throw error;
    }
}

async function removeEvent(args, kwargs, details) {
    try {
        logger.debug('removeEvent');
        await db.removeEvent(kwargs.id);
        const result = {id: kwargs.id, event: kwargs.event};
        wamp.publish('removeEvent', [], result, {exclude : [details.caller]});
        await db.logOp('removeEvent', args[0], kwargs, null);
        /*
        updatePusherData({
            event: {
                id: kwargs.id,
                previous: kwargs.event,
                current:  null
            }
        });
        if(kwargs.event.isShooting) pusherCheck(session, false);
        */
        return result;
    } catch (error) {
        await db.logOp('removeEvent', args[0], kwargs, error);
        logger.error("Remove Event Rejected: " + error);
        throw error;
    }
}

async function splitEvent(args, kwargs, details) {
    try {
        logger.debug('splitEvent');
        await db.splitEvent(kwargs.id, kwargs.event, kwargs.id2, kwargs.event2);
        const result = {id: kwargs.id, event: kwargs.event, id2: kwargs.id2, event2: kwargs.event2};
        wamp.publish('splitEvent', [], result, {exclude : [details.caller]});
        await db.logOp('splitEvent', args[0], kwargs, null);
        /*
        updatePusherData({
            joinSplitEvent: {
                id: kwargs.id,
                id2: kwargs.id2,
                event: kwargs.event,
                event2: kwargs.event2
            }
        });
        */
        return result;
    } catch (error) {
        await db.logOp('splitEvent', args[0], kwargs, error);
        logger.error("Split Event Rejected: " + error);
        throw error;
    }
}

async function joinEvents(args, kwargs, details) {
    try {
        logger.debug('joinEvent');
        await db.joinEvents(kwargs.id, kwargs.event, kwargs.id2);
        const result = {id: kwargs.id, event: kwargs.event, id2: kwargs.id2};
        wamp.publish('joinEvents', [], result, {exclude : [details.caller]});
        await db.logOp('joinEvent', args[0], kwargs, null);
        /*
        updatePusherData({
            joinSplitEvent: {
                id: kwargs.id,
                id2: kwargs.id2,
                event: kwargs.event
            }
        });
        */
        return result;
    } catch (error) {
        await db.logOp('joinEvents', args[0], kwargs, error);
        logger.error("Join Events Rejected: " + error);
        throw error;
    }
}


// *********************************************************************************************************************
// EVENT LOCK
// *********************************************************************************************************************
function lockEvent(args, kwargs, details) {
    const index = lockedEvents.findIndex(event => event.id === args[0]);
    if(index < 0) {
        lockedEvents.push({timestamp: +new Date, id: args[0]});
        session.publish('lockedEventsChanged', lockedEvents.map(item => item.id), {}, {exclude : [details.publisher]});
    } else {
        lockedEvents[index].timestamp = +new Date;
    }
}

function releaseEvent(args, kwargs, details) {
    const index = lockedEvents.findIndex(event => event.id === args[0]);
    if(index >= 0) {
        lockedEvents.splice(index, 1);
        session.publish('lockedEventsChanged', lockedEvents.map(item => item.id), {}, {exclude : [details.publisher]});
    }
}

function checkLockedEvents() {
    if(lockedEvents.length === 0) return;
    const timeStamp = +new Date;
    const length = lockedEvents.length;
    lockedEvents = lockedEvents.filter(item => (timeStamp - item.timestamp) <= LOCK_VALID_TIME);
    if(lockedEvents.length < length) session.publish('lockedEventsChanged', lockedEvents.map(item => item.id));
}
