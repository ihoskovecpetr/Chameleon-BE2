'use strict';

const db = require('../dbData/mongoDb-booking');
const k2 = require('../dbData/mssqlK2-data');
const logger = require('../logger');
const wamp = require('../wamp');
const lockedEvent = require('../lib/lockedEvent');

module.exports = {
    //'getData': getData,
    'getBookingLockedEvents': getBookingLockedEvents,
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
    'addResource': addResource,
    'updateResource': updateResource,
    'removeResource': removeResource,
    'reorderResource': reorderResource,
    'getNumberOfEventsForResource': getNumberOfEventsForResource,
    // ** Group
    'addGroup': addGroup,
    'updateGroup': updateGroup,
    'removeGroup': removeGroup,
    'reorderGroups': reorderGroups,
    // ** Pin
    'changeUserPin': changeUserPin,
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
async function getBookingLockedEvents(args, kwargs, details) {
    try {
        return lockedEvent.getLockedEvents();
    } catch (error) {
        logger.error(`getBookingLockedEvents error: ${error}`);
        throw error;
    }
}
/*
async function getData(args, kwargs, details) {
    try {
        const start = Date.now();
        logger.debug(`Requested data. Caller: ${args.length > 0 ? `${args[0]}, ` : ''}${details.caller}`);

 */
        /*const [groups, resources, holidays, projects, events, jobs, users] = await Promise.all([
            db.getResourceGroups(),
            db.getResources(),
            db.getHolidays(),
            db.getProjects(),
            db.getEvents(),
            db.getJobs(),
            db.getUsers()
        ]);*/
/*        const groups = await db.getResourceGroups();
        const resources = await db.getResources();
        const holidays = await db.getHolidays();
        const projects = await db.getProjects();
        const events = await db.getEvents();
        const jobs = await db.getJobs();
        const users = await db.getUsers();
        logger.debug(`getData time: ${Date.now() - start}ms`);
        return {groups, resources, holidays, projects, events, jobs, users, lockedEvents: lockedEvent.getLockedEvents()}
    } catch (error) {
        logger.error(`getData error, user: "${args.length > 0 ? `${args[0]}, ` : 'Unknown'}" :: ${error}`);
        throw error;
    }
}*/
// *********************************************************************************************************************
// EVENTS
// *********************************************************************************************************************
async function updateEvent(args, kwargs, details) {
    try {
        logger.debug(`updateEvent ${kwargs.id}`);
        const oldEvent = await db.updateEvent(kwargs.id, kwargs.event);
        const result = {id: kwargs.id, event: kwargs.event, fromProject: kwargs.fromProject, oldEvent: oldEvent};
        wamp.publish('updateEvent', [], result, {exclude : [details.caller]});
        await db.logOp('updateEvent', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            event: {
                id: kwargs.id,
                previous: oldEvent,
                current:  kwargs.event
            }
        }, {exclude_me: false});
        if(oldEvent.isShooting || kwargs.event.isShooting) wamp.publish('pusherCheck', [false]);
        return result;
    } catch (error) {
        await db.logOp('updateEvent', args[0], kwargs, error);
        logger.error("Update Event Rejected: " + error);
        throw error;
    }
}

async function addEvent(args, kwargs, details) {
    try {
        logger.debug(`addEvent ${kwargs.id}`);
        await db.addEvent(kwargs.id, kwargs.event);
        const result = {id: kwargs.id, event: kwargs.event};
        wamp.publish('addEvent', [], result, {exclude : [details.caller]});
        await db.logOp('addEvent', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            event: {
                id: kwargs.id,
                previous: null,
                current:  kwargs.event
            }
        }, {exclude_me: false});
        if(kwargs.event.isShooting) wamp.publish('pusherCheck', [false]);
        return result;
    } catch (error) {
        await db.logOp('addEvent', args[0], kwargs, error);
        logger.error("Add Event Rejected: " + error);
        throw error;
    }
}

async function removeEvent(args, kwargs, details) {
    try {
        logger.debug(`removeEvent ${kwargs.id}`);
        await db.removeEvent(kwargs.id);
        const result = {id: kwargs.id, event: kwargs.event};
        wamp.publish('removeEvent', [], result, {exclude : [details.caller]});
        await db.logOp('removeEvent', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            event: {
                id: kwargs.id,
                previous: kwargs.event,
                current:  null
            }
        }, {exclude_me: false});
        if(kwargs.event.isShooting) wamp.publish('pusherCheck', [false]);
        return result;
    } catch (error) {
        await db.logOp('removeEvent', args[0], kwargs, error);
        logger.error("Remove Event Rejected: " + error);
        throw error;
    }
}

async function splitEvent(args, kwargs, details) {
    try {
        logger.debug(`splitEvent ${kwargs.id} (${kwargs.id2})`);
        await db.splitEvent(kwargs.id, kwargs.event, kwargs.id2, kwargs.event2);
        const result = {id: kwargs.id, event: kwargs.event, id2: kwargs.id2, event2: kwargs.event2};
        wamp.publish('splitEvent', [], result, {exclude : [details.caller]});
        await db.logOp('splitEvent', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            joinSplitEvent: {
                id: kwargs.id,
                id2: kwargs.id2,
                event: kwargs.event,
                event2: kwargs.event2
            }
        }, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('splitEvent', args[0], kwargs, error);
        logger.error("Split Event Rejected: " + error);
        throw error;
    }
}

async function joinEvents(args, kwargs, details) {
    try {
        logger.debug(`joinEvent ${kwargs.id} + ${kwargs.id2}`);
        await db.joinEvents(kwargs.id, kwargs.event, kwargs.id2);
        const result = {id: kwargs.id, event: kwargs.event, id2: kwargs.id2};
        wamp.publish('joinEvents', [], result, {exclude : [details.caller]});
        await db.logOp('joinEvent', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            joinSplitEvent: {
                id: kwargs.id,
                id2: kwargs.id2,
                event: kwargs.event
            }
        }, {exclude_me: false});
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
        logger.debug(`addProject ${kwargs.id} [${kwargs.project.label}]`);
        const project = await db.addProject(kwargs.id, kwargs.project);
        const result = {id: kwargs.id, project: project};
        wamp.publish('addProject', [], result, {exclude : [details.caller]});
        await db.logOp('addProject', args[0], kwargs, null);
        if(project.K2rid)  wamp.publish('K2Check', [result.id]);
        wamp.publish('updatePusherData', [], {
            project: {
                id: kwargs.id,
                previous: null,
                current: project
            }
        }, {exclude_me: false});
        wamp.publish('pusherCheck', [false]);
        wamp.publish('projectsBudgetChanged', [], {previous: null, current: {id: result.id, label: result.project.label, budget: result.project.budget ? result.project.budget.toString() : null}, op: 'project-add'}, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('addProject', args[0], kwargs, error);
        logger.error("Add Project Rejected: " + error);
        throw error;
    }
}

async function updateProject(args, kwargs, details) {
    try {
        logger.debug(`updateProject ${kwargs.id} [${kwargs.project.label}]`);
        const data = await db.updateProject(kwargs.id, kwargs.project);
        const result = {id: kwargs.id, project: data.newProject};
        wamp.publish('updateProject', [], result, {exclude : [details.caller]});
        await db.logOp('updateProject', args[0], kwargs, null);
        if(result.project.K2rid && (result.project.K2rid !== data.oldProject.K2rid || jobsChanged(result.project.jobs, data.oldProject.jobs)))  wamp.publish('K2Check', [result.id]);
        wamp.publish('updatePusherData', [], {
            project: {
                id: kwargs.id,
                previous: data.oldProject,
                current: data.newProject
            }
        }, {exclude_me: false});
        wamp.publish('pusherCheck', [false]);
        wamp.publish('projectsBudgetChanged', [], {previous: {id: kwargs.id, label: data.oldProject.label, budget: data.oldProject.budget ? data.oldProject.budget.toString() : null}, current: {id: kwargs.id, label: data.newProject.label, budget: data.newProject.budget ? data.newProject.budget.toString() : null}, op: 'project-update'}, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('updateProject', args[0], kwargs, error);
        logger.error("Update Project Rejected: " + error);
        throw error;
    }
}

async function removeProject(args, kwargs, details) {
    try {
        logger.debug(`removeProject ${kwargs.id}`);
        await db.removeProject(kwargs.id);
        const result = {id: kwargs.id, project: kwargs.project};
        wamp.publish('removeProject', [], result, {exclude : [details.caller]});
        await db.logOp('removeProject', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            project: {
                id: kwargs.id,
                previous: kwargs.project,
                current: null
            }
        }, {exclude_me: false});
        wamp.publish('pusherCheck', [false]);
        wamp.publish('projectsBudgetChanged', [], {previous: {id: result.id, label: result.project.label, budget: result.project.budget ? result.project.budget.toString() : null}, current: null, op: 'project-remove'}, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('removeProject', args[0], kwargs, error);
        logger.error("Remove Project Rejected: " + error);
        throw error;
    }
}

async function addProjectAndEvent(args, kwargs, details) {
    try {
        logger.debug(`addProjectAndEvent ${kwargs.idProject} [${kwargs.project.label}], event ${kwargs.idEvent}`);
        const project = await db.addProject(kwargs.idProject, kwargs.project);
        await db.addEvent(kwargs.idEvent, kwargs.event, true);
        const result = {idProject: kwargs.idProject, project: project, idEvent: kwargs.idEvent, event: kwargs.event};
        wamp.publish('addProjectAndEvent', [], result, {exclude : [details.caller]});
        await db.logOp('addProjectAndEvent', args[0], kwargs, null);
        if(project.K2rid) K2check(result.idProject, session);
        wamp.publish('updatePusherData', [], {
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
        }, {exclude_me: false});
        wamp.publish('pusherCheck', [false]);
        wamp.publish('projectsBudgetChanged', [], {previous: null, current: {id: result.idProject, label: result.project.label, budget: result.project.budget ? result.project.budget.toString() : null}, op: 'project-add'}, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('addProjectAndEvent', args[0], kwargs, error);
        logger.error("Add Project and Event Rejected: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// RESOURCES
// *********************************************************************************************************************
async function addResource(args, kwargs, details) {
    try {
        logger.debug(`addResource ${kwargs.id} [${kwargs.resource.label}]`);
        const data = await db.addResource(kwargs.id, kwargs.resource);
        const result = {groups: data[0], resources: data[1]};
        wamp.publish('updateData', [], result, {exclude : [details.caller]});
        await db.logOp('addResource', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            resource: {
                id: kwargs.id,
                previous: null,
                current: kwargs.resource
            }
        }, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('addResource', args[0], kwargs, error);
        logger.error("Add Resource Rejected: " + error);
        throw error;
    }
}

async function updateResource(args, kwargs, details) {
    try {
        logger.debug(`updateResource ${kwargs.id} [${kwargs.resource.label}]`);
        const data = await db.updateResource(kwargs.id, kwargs.resource);
        const result = data[0] ? {groups: data[0], resources: data[1]} : {resources: data[1]};
        wamp.publish('updateData', [], result, {exclude : [details.caller]});
        await db.logOp('updateResource', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            resource: {
                id: kwargs.id,
                previous: data[2],
                current: kwargs.resource
            }
        }, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('updateResource', args[0], kwargs, error);
        logger.error("Update Resource Rejected: " + error);
        throw error;
    }
}

async function removeResource(args, kwargs, details) {
    try {
        logger.debug(`removeResource ${kwargs.id}`);
        const data = await db.removeResource(kwargs.id);
        const result = {groups: data[0], resources: data[1]};
        wamp.publish('updateData', [], result, {exclude : [details.caller]});
        await db.logOp('removeResource', args[0], kwargs, null);
        wamp.publish('updatePusherData', [], {
            resource: {
                id: kwargs.id,
                previous: data[2],
                current: null
            }
        }, {exclude_me: false});
        return result;
    } catch (error) {
        await db.logOp('removeResource', args[0], kwargs, error);
        logger.error("Remove Resource Rejected: " + error);
        throw error;
    }
}

async function reorderResource(args, kwargs, details) {
    try {
        logger.debug('reorderResource');
        const data = await db.reorderResource(kwargs.id1, kwargs.members1, kwargs.id2, kwargs.members2, kwargs.id3);
        const result = Array.isArray(data) ? {groups: data[0], resources: data[1]} : {groups: data};
        wamp.publish('updateData', [], result, {exclude: [details.caller]});
        await db.logOp('reorderResources', args[0], kwargs, null);
        return result;
    } catch (error) {
        await db.logOp('reorderResources', args[0], kwargs, error);
        logger.error("Reorder Resources Rejected: " + error);
        throw error;
    }
}

async function getNumberOfEventsForResource(args, kwargs, details) {
    try {
        logger.debug('getNumberOfEventsForResource');
        return await db.getNumberOfEventsForResource(kwargs.id);
    } catch (error) {
        logger.error("getNumberOfEventsForResource Rejected: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// GROUPS
// *********************************************************************************************************************
async function addGroup(args, kwargs, details) {
    try {
        logger.debug(`addGroup ${kwargs.id} [${kwargs.group.label}]`);
        const groups = await db.addGroup(kwargs.id, kwargs.group);
        const result = {groups: groups};
        wamp.publish('updateData', [], result, {exclude : [details.caller]});
        await db.logOp('addGroup', args[0], kwargs, null);
        return result;
    } catch (error) {
        await db.logOp('addGroup', args[0], kwargs, error);
        logger.error("Add Group Rejected: " + error);
        throw error;
    }
}

async function updateGroup(args, kwargs, details) {
    try {
        logger.debug(`updateGroup ${kwargs.id} [${kwargs.group.label}]`);
        const groups = await db.updateGroup(kwargs.id, kwargs.group);
        const result = {groups: groups};
        wamp.publish('updateData', [], result, {exclude : [details.caller]});
        await db.logOp('updateGroup', args[0], kwargs, null);
        return result;
    } catch (error) {
        await db.logOp('updateGroup', args[0], kwargs, error);
        logger.error("Update Group Rejected: " + error);
        throw error;
    }
}

async function removeGroup(args, kwargs, details) {
    try {
        logger.debug(`removeGroup ${kwargs.id}`);
        const groups = await db.removeGroup(kwargs.id);
        const result = {groups: groups};
        wamp.publish('updateData', [], result, {exclude : [details.caller]});
        await db.logOp('removeGroup', args[0], kwargs, null);
        return result;
    } catch (error) {
        await db.logOp('removeGroup', args[0], kwargs, error);
        logger.error("Remove Group Rejected: " + error);
        throw error;
    }
}

async function reorderGroups(args, kwargs, details) {
    try {
        logger.debug('reorderGroups');
        const groups = await db.reorderGroups(kwargs.order);
        const result = {groups: groups};
        wamp.publish('updateData', [], result, {exclude: [details.caller]});
        await db.logOp('reorderGroups', args[0], kwargs, null);
        return result;
    } catch (error) {
        await db.logOp('reorderGroups', args[0], kwargs, error);
        logger.error("Reorder Groups Rejected: " + error);
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
        logger.debug(`getBudgetLabel ${kwargs.id}`);
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
        logger.debug(`getBudgetMinutes ${kwargs.id}`);
        return await db.getBudgetMinutes(kwargs.id);
    } catch (error) {
        logger.error("Get budget minutes error: " + error);
    }
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

// ---------------------------------------------------------------------------------------------------------------------
// + + +  H E L P E R S  + + +
// ---------------------------------------------------------------------------------------------------------------------
function jobsChanged(a, b) {
    if(a.length !== b.length) return true;
    a.sort(compare);
    b.sort(compare);
    for(let i = 0; i < a.length; i++ ) {
        if(a[i].job != b[i].job) return true;
    }
    return false;
}
// ---------------------------------------------------------------------------------------------------------------------
function compare(a,b) {
    if (a.job < b.job)
        return -1;
    else if (a.job > b.job)
        return 1;
    else
        return 0;
}
// ---------------------------------------------------------------------------------------------------------------------