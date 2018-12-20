'use strict';

const db = require('../dbData/mongoDb-booking');
const k2 = require('../dbData/mssqlK2-data');
const logger = require('../logger');
const wamp = require('../wamp');

const LOCK_VALID_TIME = 1000;

let lockedEvents = [];

setInterval(checkLockedEvents, LOCK_VALID_TIME + 500);;

module.exports = {
    'getData': getData,
    // ** Events
    'addEvent': addEvent,
    'updateEvent': updateEvent,
    'removeEvent': removeEvent,
    'splitEvent': splitEvent,
    'joinEvents': joinEvents,
    // ** Projects
    'addProject': addProject,
    'updateProject': updateProject,
    'removeProject': removeProject,
    'addProjectAndEvent': addProjectAndEvent,
    // ** Resource
    //'addResource': addResource,
    //'updateResource': updateResource,
    //'removeResource': removeResource,
    //'reorderResource': reorderResource,
    //'getNumberOfEventsForResource': getNumberOfEventsForResource,
    // ** Group
    //'addGroup': addGroup,
    //'updateGroup': updateGroup,
    //'removeGroup': removeGroup,
    //'reorderGroups': reorderGroups,
    // ** Pin
    'changeUserPin': changeUserPin,
    // ** Event lock
    'lockEvent': lockEvent,
    'releaseEvent': releaseEvent,
    // ** K2
    'getK2projects': getK2projects,
    // ** Budget
    'getBudgetLabel': getBudgetLabel,
    'getAvailableBudgets': getAvailableBudgets,
    'getBudgetMinutes': getBudgetMinutes
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
        const oldEvent = await db.updateEvent(kwargs.id, kwargs.event);
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
// PROJECTS
// *********************************************************************************************************************
async function addProject(args, kwargs, details) {
    try {
        logger.debug('addProject');
        const project = await db.addProject(kwargs.id, kwargs.project);
        const result = {id: kwargs.id, project: project};
        wamp.publish('addProject', [], result, {exclude : [details.caller]});
        await db.logOp('addProject', args[0], kwargs, null);
        /*
        if(project.K2rid) K2check(result.id, session);
        pusherCheck(session, false);
        projectLinkedOrUnlinkedWithBudget({id: result.id.toString(), label: result.project.label, budget: null}, {id: result.id.toString(), label: result.project.label, budget: result.project.budget ? result.project.budget.toString() : null});
        */
        return result;
    } catch (error) {
        await db.logOp('addProject', args[0], kwargs, error);
        logger.error("Add Project Rejected: " + error);
        throw error;
    }
}

async function updateProject(args, kwargs, details) {
    try {
        logger.debug('updateProject');
        const data = await db.updateProject(kwargs.id, kwargs.project);
        const result = {id: kwargs.id, project: data.newProject};
        wamp.publish('updateProject', [], result, {exclude : [details.caller]});
        await db.logOp('updateProject', args[0], kwargs, null);
        /*
        if(result.project.K2rid && (result.project.K2rid !== data.oldProject.K2rid || jobsChanged(result.project.jobs, data.oldProject.jobs))) K2check(result.id, session);
        updatePusherData({
            project: {
                id: kwargs.id,
                previous: data.oldProject,
                current: data.newProject
            }
        });
        pusherCheck(session, false);
        projectLinkedOrUnlinkedWithBudget({id: data.oldProject._id.toString(), label: data.oldProject.label, budget: data.oldProject.budget ? data.oldProject.budget.toString() : null}, {id: kwargs.id.toString(), label: data.newProject.label, budget: data.newProject.budget ? data.newProject.budget.toString() : null});
        */
        return result;
    } catch (error) {
        await db.logOp('updateProject', args[0], kwargs, error);
        logger.error("Update Project Rejected: " + error);
        throw error;
    }
}

async function removeProject(args, kwargs, details) {
    try {
        logger.debug('removeProject');
        await db.removeProject(kwargs.id);
        const result = {id: kwargs.id, project: kwargs.project};
        wamp.publish('removeProject', [], result, {exclude : [details.caller]});
        await db.logOp('removeProject', args[0], kwargs, null);
        /*
        updatePusherData({
            project: {
                id: kwargs.id,
                previous: kwargs.project,
                current: null
            }
        });
        pusherCheck(session, false);
        projectLinkedOrUnlinkedWithBudget({id: result.id.toString(), label: result.project.label, budget: result.project.budget ? result.project.budget.toString() : null}, {id: result.id.toString(), label: result.project.label, budget: null});
        */
        return result;
    } catch (error) {
        await db.logOp('removeProject', args[0], kwargs, error);
        logger.error("Remove Project Rejected: " + error);
        throw error;
    }
}

async function addProjectAndEvent(args, kwargs, details) {
    try {
        logger.debug('addProjectAndEvent');
        const project = await db.addProject(kwargs.idProject, kwargs.project);
        await db.addEvent(kwargs.idEvent, kwargs.event, true);
        const result = {idProject: kwargs.idProject, project: project, idEvent: kwargs.idEvent, event: kwargs.event};
        wamp.publish('addProjectAndEvent', [], result, {exclude : [details.caller]});
        await db.logOp('addProjectAndEvent', args[0], kwargs, null);
        /*
        if(project.K2rid) K2check(result.idProject, session);
        updatePusherData({
            project: {
                id: kwargs.idProject,
                previous: null,
                current: result.project
            },
            event: {
                id: kwargs.idEvent,
                previous: null,
                current: kwargs.event
            }
        });
        pusherCheck(session, false);
        projectLinkedOrUnlinkedWithBudget({id: result.idProject.toString(), label: result.project.label, budget: null}, {id: result.idProject.toString(), label: result.project.label, budget: result.project.budget ? result.project.budget.toString() : null});
        */
        return result;
    } catch (error) {
        await db.logOp('addProjectAndEvent', args[0], kwargs, error);
        logger.error("Add Project and Event Rejected: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// K2
// *********************************************************************************************************************
async function getK2projects(args, kwargs, details) {
    try {
        logger.debug('getK2projects');
        const data = await k2.getK2projects();
        const K2projects = await db.getK2linkedProjects();
        return data.filter(item => K2projects.indexOf(item.RID) < 0);
    } catch (error) {
        logger.error("Get K2 projects error: " + error);
    }
}

// *********************************************************************************************************************
// BUDGET
// *********************************************************************************************************************
async function getBudgetLabel(args, kwargs, details) {
    try {
        logger.debug('getBudgetLabel');
        return await db.getBudgetLabel(kwargs.id);
    } catch (error) {
        logger.error("Get budget label error: " + error);
    }
}

async function getAvailableBudgets(args, kwargs, details) {
    try {
        logger.debug('getAvailableBudgets');
        return await db.getAvailableBudgets(kwargs.projectId);
    } catch (error) {
        logger.error("Get available budgets error: " + error);
    }
}

async function getBudgetMinutes(args, kwargs, details) {
    try {
        logger.debug('getBudgetMinutes');
        return await db.getBudgetMinutes(kwargs.id);
    } catch (error) {
        logger.error("Get budget minutes error: " + error);
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

// *********************************************************************************************************************
// PRODUCTION LOGIN PIN
// *********************************************************************************************************************
async function changeUserPin(args, kwargs, details) {
    try {
        logger.debug('changeUserPin');
        const data = await db.changeUserPin(kwargs.id, kwargs.group, kwargs.pin);
        const result = {users: data};
        wamp.publish('updateData', [], result, {exclude: [details.caller]});
        return result;
    } catch (error) {
        logger.error("Change user pin error: " + error);
    }
}