'use strict';
const pusherClient = require('../lib/pusherClient');
const db = require('../dbData/mongoDb-pusher');
const wamp = require('../wamp');
const logger = require('../logger');

module.exports = {
    //init main data
    'getWorklogsForUser': getWorklogsForUser,
    'getTasksForUser': getTasksForUser,
    'getMessagesForUser': getMessagesForUser,
    'getProjectTeamForUser': getProjectTeamForUser,
    'getFreelancers': getFreelancers,
    'getWorkClock': getWorkClock,
    'getAllPusherUsers': getAllPusherUsers,
    //
    'setWorkClock': setWorkClock,
    //debug
    'getPusherClients': getPusherClients
};

// *********************************************************************************************************************
// Get pusher clients (for debug)
// *********************************************************************************************************************
function getPusherClients() {
    try {
        return pusherClient.getClients()
    } catch(error) {
        logger.warn("getPusherClients error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Get all pusher users (list, contacts, workclock, requests by user)
// *********************************************************************************************************************
async function getAllPusherUsers(args, kwargs) {
    try {
        logger.debug('getAllPusherUsers for user ' + kwargs.user);
        const users = await db.getAllUsers(kwargs.user);
        return {users: users};
    } catch(error) {
        logger.warn("getAllPusherUsers error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Get work clock for ssoId user
// *********************************************************************************************************************
async function getWorkClock(args, kwargs) {
    try {
        logger.debug('getWorkClock for user: ' + kwargs.user);
        const clock = await db.getWorkClock(kwargs.user, true);
        return {workClock: clock};
    } catch(error) {
        logger.warn("getWorkClock error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Set work clock for ssoId user
// *********************************************************************************************************************
async function setWorkClock(args, kwargs, details) {
    try {
        logger.debug('setWorkClock for user: ' + kwargs.user + ' - ' + kwargs.state);
        const data = await db.setWorkClock(kwargs.user, kwargs.state);
        //inform other clients (update all users list)
        wamp.publish('all.workclock', [], {userId: data.user._id, user: data.user.ssoId, state: kwargs.state}, {exclude : [details.caller]});
        //if somebody requested to be notified - do it
        for(const user of data.toNotify) wamp.publish(user.ssoId + '.workclockrequest', [], {subject: data.user.ssoId, requested: false}, {exclude : [details.caller]});
        if(data.toNotify.length > 0) {
            let stateString = '';
            switch (kwargs.state) {
                case 'OUT':
                    stateString = 'Out of office';
                    break;
                case 'BUSY':
                    stateString = 'Working';
                    break;
                case 'READY':
                    stateString = 'Await work';
                    break;
                case 'PAUSE':
                    stateString = 'Work break';
                    break;
                case 'PAUSE_READY':
                    stateString = 'Await work - break';
                    break;
                default: stateString = 'Unknown'
            }
            const message = {
                type: 'NOW',
                label: 'Work-Clock status changed',
                message: `${data.user.name} has changed his/her work-clock status.`,
                target: data.toNotify.map(u => u._id.toString()),
                deadline: moment(),
                details: `Current status: ${stateString}`
            };
            const newMessages = await db.addMessage(message);
            newMessages.forEach(message => {
                if(message.target) wamp.publish(message.target + '.message', [], message);
            });
        }
        // if work requested (raised hand)
        if(kwargs.ready === true) { // if state is ready or leave ready - notify manager, supervisor,...

        } else if(kwargs.ready === false) { //close request - set request closed, set details of message(s) to current status and update pusher if some active (not confirmed/answered yet)

        }
    } catch(error) {
        logger.warn("setWorkClock error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Get worklogs for user
// *********************************************************************************************************************
async function getWorklogsForUser(args, kwargs) {
    try {
        logger.debug('getWorklogsForUser ' + kwargs.user + ' ' + kwargs.full);
        const worklogs = await db.getWorklogsForUser(kwargs.user, kwargs.full);
        return {projects: worklogs};
    } catch(error) {
        logger.warn("getWorklogsForUser error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Get tasks for user
// *********************************************************************************************************************
async function getTasksForUser(args, kwargs) {
    try {
        logger.debug('getTasksForUser ' + kwargs.user);
        const tasks = await db.getTasksForUser(kwargs.user);
        return {tasks: tasks};
    } catch(error) {
        logger.warn("getTasksForUser error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Get messages for user
// *********************************************************************************************************************
async function getMessagesForUser(args, kwargs) {
    try {
        logger.debug('getMessagesForUser ' + kwargs.user);
        const messages = await db.getMessagesForUser(kwargs.user);
        return {messages: messages};
    } catch(error) {
        logger.warn("getMessagesForUser error: " + error);
        throw error;
    }
}

// *********************************************************************************************************************
// Get projects team for user
// *********************************************************************************************************************
async function getProjectTeamForUser(args, kwargs) {
    try {
        logger.debug('getProjectTeamForUser ' + kwargs.user);
        const booking = await db.getProjectTeamForUser(kwargs.user);
        return {booking: booking};
    } catch(error) {
        logger.warn("getProjectTeamForUser error: " + error);
        throw error;
    }
}

async function getFreelancers(args, kwargs) {
    try {
        logger.debug('getFreelancers ' + kwargs.user);
        const freelancers = await db.getFreelancers(kwargs.user);
        return {freelancers: freelancers};
    } catch(error) {
        logger.warn("getFreelancers error: " + error);
        throw error;
    }
}