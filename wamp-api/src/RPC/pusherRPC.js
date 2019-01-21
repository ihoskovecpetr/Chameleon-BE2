'use strict';
const pusherClient = require('../lib/pusherClient');
const db = require('../dbData/mongoDb-pusher');
const wamp = require('../wamp');
const logger = require('../logger');

module.exports = {
    // - - - tasks - - -
    'getTasksForUser': getTasksForUser,
    'getUsersByRole': getUsersByRole,
    'postponeTask': postponeTask,
    'completeTask': completeTask,
    'forwardTask': forwardTask,
    'createSubTask': createSubTask,
    'createBigArchiveTask': createBigArchiveTask,
    'createFreelancerTask': createFreelancerTask,
    'setArchiveCheckItemStatus': setArchiveCheckItemStatus,

    // - - - messages + create - - -
    'getMessagesForUser': getMessagesForUser,
    'sendMessage': sendMessage,
    'postponeMessage': postponeMessage,
    'confirmMessage': confirmMessage,
    'getUsersAndGroupsForCreate': getUsersAndGroupsForCreate,
    'createUserGroupForCreate': createUserGroupForCreate,
    'updateUserGroupForCreate': updateUserGroupForCreate,
    'removeUserGroupForCreate': removeUserGroupForCreate,

    // - - - work - clock - - -
    'getWorkClock': getWorkClock,
    'setWorkClock': setWorkClock,
    'setWorkClockRequest': setWorkClockRequest,
    'cancelWorkClockRequest': cancelWorkClockRequest,

    // - - - work - log - - -
    'getWorklogsForUser': getWorklogsForUser,
    'confirmWorkLog': confirmWorkLog,

    // - - - get other data - - -
    'getProjectTeamForUser': getProjectTeamForUser,
    'getFreelancers': getFreelancers,
    'getAllPusherUsers': getAllPusherUsers,

    // - - - debug - - -
    'getPusherClients': getPusherClients
};
// ---------------------------------------------------------------------------------------------------------------------
//    T A S K S
// ---------------------------------------------------------------------------------------------------------------------
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
// Get users by role
// *********************************************************************************************************************
async function getUsersByRole(args, kwargs) {
    try {
        logger.debug('getUsersByRole');
        if(kwargs.role && kwargs.role.indexOf('booking:') !== 0) kwargs.role = 'booking:' + kwargs.role;
        return await db.getUsersByRole(kwargs.role);
    } catch(error) {
        logger.warn("getUsersByRole error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// Postpone task
// *********************************************************************************************************************
async function postponeTask(args, kwargs, details) {
    try {
        logger.debug('postponeTask ' + kwargs.id);
        const task = await db.postponeTask(kwargs.id, kwargs.days);
        const ssoId = await db.getSsoIdsForUsers(task.target);
        if(ssoId && pusherClient.numOfClientsForUser(ssoId) > 1) wamp.publish(`${ssoId}.task`, [kwargs.id], {
            dueTo: moment(task.deadline).add(task.postpone,'days').startOf('day').format('YYYY-MM-DD')
        }, {exclude : [details.caller]});
    } catch(error) {
        logger.warn("postponeTask error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Complete task
// *********************************************************************************************************************
async function completeTask(args, kwargs) {
    try {
        logger.debug('completeTask ' + kwargs.user);
    } catch(error) {
        logger.warn("completeTask error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Forward task
// *********************************************************************************************************************
async function forwardTask(args, kwargs) {
    try {
        logger.debug('forwardTask ' + kwargs.user);
    } catch(error) {
        logger.warn("forwardTask error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Create sub-task
// *********************************************************************************************************************
async function createSubTask(args, kwargs) {
    try {
        logger.debug('createSubTask ' + kwargs.user);
    } catch(error) {
        logger.warn("createSubTask error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Create big archive task
// *********************************************************************************************************************
async function createBigArchiveTask(args, kwargs) {
    try {
        logger.debug('createBigArchiveTask ' + kwargs.user);
    } catch(error) {
        logger.warn("createBigArchiveTask error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Create freelancer task
// *********************************************************************************************************************
async function createFreelancerTask(args, kwargs) {
    try {
        logger.debug('createFreelancerTask ' + kwargs.user);
    } catch(error) {
        logger.warn("createFreelancerTask error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Set archive check list item status
// *********************************************************************************************************************
async function setArchiveCheckItemStatus(args, kwargs) {
    try {
        logger.debug('setArchiveCheckItemStatus ' + kwargs.user);
    } catch(error) {
        logger.warn("setArchiveCheckItemStatus error: " + error);
        throw error;
    }
}
// ---------------------------------------------------------------------------------------------------------------------
//    M E S S A G E S  +  C R E A T E
// ---------------------------------------------------------------------------------------------------------------------
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
// TODO Send Message
// *********************************************************************************************************************
async function sendMessage(args, kwargs) {
    try {
        logger.debug('sendMessage ' + kwargs.user);
    } catch(error) {
        logger.warn("sendMessage error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Postpone Message
// *********************************************************************************************************************
async function postponeMessage(args, kwargs) {
    try {
        logger.debug('postponeMessage ' + kwargs.user);
    } catch(error) {
        logger.warn("postponeMessage error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Confirm Message
// *********************************************************************************************************************
async function confirmMessage(args, kwargs) {
    try {
        logger.debug('confirmMessage ' + kwargs.user);
    } catch(error) {
        logger.warn("confirmMessage error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// Get Users And Groups For Create
// *********************************************************************************************************************
async function getUsersAndGroupsForCreate(args, kwargs) {
    try {
        logger.debug('getUsersAndGroupsForCreate ' + kwargs.user);
        return await db.getUsersAndGroupsForCreate(kwargs.user);
    } catch(error) {
        logger.warn("getUsersAndGroupsForCreate error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// Create User Group For Create
// *********************************************************************************************************************
async function createUserGroupForCreate(args, kwargs) {
    try {
        logger.debug('createUserGroupForCreate ' + kwargs.user);
        await db.createUserGroupForCreate(kwargs.id, kwargs.label, kwargs.members, kwargs.owner);
    } catch(error) {
        logger.warn("createUserGroupForCreate error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// Update User Group For Create
// *********************************************************************************************************************
async function updateUserGroupForCreate(args, kwargs) {
    try {
        logger.debug('updateUserGroupForCreate ' + kwargs.user);
        await db.updateUserGroupForCreate(kwargs.id, kwargs.members);
    } catch(error) {
        logger.warn("updateUserGroupForCreate error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// Remove User Group For Create
// *********************************************************************************************************************
async function removeUserGroupForCreate(args, kwargs) {
    try {
        logger.debug('removeUserGroupForCreate ' + kwargs.user);
        await db.removeUserGroupForCreate(kwargs.id);
    } catch(error) {
        logger.warn("removeUserGroupForCreate error: " + error);
        throw error;
    }
}
// ---------------------------------------------------------------------------------------------------------------------
//    W O R K  -  C L O C K
// ---------------------------------------------------------------------------------------------------------------------
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
// TODO Set Work Clock request
// *********************************************************************************************************************
async function setWorkClockRequest(args, kwargs) {
    try {
        logger.debug('setWorkClockRequest ' + kwargs.user);
    } catch(error) {
        logger.warn("setWorkClockRequest error: " + error);
        throw error;
    }
}
// *********************************************************************************************************************
// TODO Cancel Work Clock request
// *********************************************************************************************************************
async function cancelWorkClockRequest(args, kwargs) {
    try {
        logger.debug('cancelWorkClockRequest ' + kwargs.user);
    } catch(error) {
        logger.warn("cancelWorkClockRequest error: " + error);
        throw error;
    }
}
// ---------------------------------------------------------------------------------------------------------------------
//    W O R K  -  L O G
// ---------------------------------------------------------------------------------------------------------------------
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
// TODO Confirm Work Log
// *********************************************************************************************************************
async function confirmWorkLog(args, kwargs) {
    try {
        logger.debug('confirmWorkLog ' + kwargs.user);
    } catch(error) {
        logger.warn("confirmWorkLog error: " + error);
        throw error;
    }
}
// ---------------------------------------------------------------------------------------------------------------------
//    G E T  O T H E R  D A T A
// ---------------------------------------------------------------------------------------------------------------------
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
// *********************************************************************************************************************
// Get freelancers for user
// *********************************************************************************************************************
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
// ---------------------------------------------------------------------------------------------------------------------
//    D E B U G
// ---------------------------------------------------------------------------------------------------------------------
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