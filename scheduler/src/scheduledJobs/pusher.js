'use strict';

const logger = require('../logger');
const wamp = require('../wamp');
const moment = require('moment');
const db = require('../dbData/mongoDbData');

let lastChecked = null;

module.exports = async (conditionsOnly, regular) => {
    logger.debug(`Pusher Job Fired${conditionsOnly ? ', conditions only' : ''}${regular ? ', regular' : ''}.`);
    //if it is regular check and previous was less then 1 min, return
    if(regular && lastChecked && ((+new Date()) - lastChecked) < 60000) { //one minute
        logger.debug('Is regular and checked a moment ago, skipping.');
        return;
    }
    const today = moment().startOf('day');
    //check if conditionMet has been changed and update it and return changed
    // ----------------------------------------------
    // UPDATE CONDITIONS
    // ----------------------------------------------
    try {
        const tasks = await db.updateTasksConditionsMet();
        //if tasks -> task.valid => has changed from invalid to valid and vice versa => send task resp. remove task to target
        tasks.forEach(task => {
            if(task.valid) {
                delete task.valid;
                wamp.publish(task.target + '.task', [], task);
            } else {
                wamp.publish(task.target + '.task', [task.id]);
            }
        });
    } catch (e) {

    }
    if(conditionsOnly) return;
    lastChecked = +new Date();
    // ----------------------------------------------
    // GET ALL USERS
    // ----------------------------------------------
    let users;
    try {
        users = await db.getUsers();
    } catch (e) {
        logger.warn(`PusherCheck:getUsers Error: ${e}`);
    }
    // ----------------------------------------------
    // UNANSWERED MESSAGES
    // ----------------------------------------------
    try {
        const messages = await db.getUnansweredMessages();
        for(const message of messages) {
            const addedMessages = await db.addMessage({
                type: 'INFO',
                target: message.origin,
                deadline: moment().startOf('day'),
                label: `Message confirmation expired.`,
                message: `Your message: "${message.message}" sent: ${moment(message.timestamp).format('DD/MM HH:mm')} has not been confirmed yet by following users:`,
                details: message.unanswered.reduce((o,u,i) => {
                    if(i > 0) o += ', ';
                    o += users[u] ? users[u].name : 'Unknown User';
                    return o;
                },'')
            });
            if(addedMessages && addedMessages.length > 0) {
                try {
                    await db.updateMessage(message.id, {followed: addedMessages[0].id});
                    session.publish(addedMessages[0].target + '.message', [], addedMessages[0]);
                } catch (e) {
                    logger.warn(`PusherCheck:addFollowedMessage, message: ${message.id}. Error: ${e}`);
                }
            }
        }
    } catch (e) {
        logger.warn(`PusherCheck:unansweredMessages Error: ${e}`);
    }
    // ----------------------------------------------
    // GET ALL TASKS
    // ----------------------------------------------
    let allTasks;
    try {
        const tasksData = await db.getTasks();
        allTasks = tasksData.reduce((out, task) => {
            if(out[task.type]) out[task.type].push(task);
            else out[task.type] = [task];
            return out;
        }, {});
    } catch (e) {
        logger.warn(`PusherCheck:getAllTasks Error: ${e}`);
    }
    // -----------------------------------------------------------------------------------------------------------------
    // PROJECTS WITH FLATTEN SHOOT EVENTS
    // -----------------------------------------------------------------------------------------------------------------
    try {
        const shootProjects = await db.getProjectsWithShootEvent();
        // *************************************************************************************************************
        // VFX ARCHIVE
        // *************************************************************************************************************
        const vfxArchiveSupervisorTasks = allTasks['VFX_ARCHIVE_SUPERVISOR'] ? allTasks['VFX_ARCHIVE_SUPERVISOR'].map(task => {task.found = false; return task}) : [];
        shootProjects.forEach(project => {
            project.events.forEach(async event => {
                const found = findTaskForEvent(project, event, vfxArchiveSupervisorTasks);
                if(!found) { //ADD NEW TASK
                    try {
                        const newTask = await db.addTask({
                            type: 'VFX_ARCHIVE_SUPERVISOR',
                            project: project.id,
                            target: project.supervisor ? project.supervisor.id : project.manager.id,
                            deadline: moment().add(10, 'days').startOf('day'),
                            dataOrigin: event
                        });
                        if(newTask.valid) {
                            delete newTask.data;
                            delete newTask.valid;
                            session.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'VFX_ARCHIVE_SUPERVISOR' error: ${e}`);
                    }
                } else {
                    vfxArchiveSupervisorTasks[found.index].found = true; //POSSIBLY CHANGE THE TASK ??? target? dataOrigin?
                }
            });
        });
        vfxArchiveSupervisorTasks.forEach(async task => {
            if(!task.found && !task.resolved) { //REMOVE TASK
                try {
                    await db.removeTask(task.id);
                    if (users[task.target]) {
                        session.publish(users[task.target].ssoId + '.task', [task.id], null);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:removeTask 'VFX_ARCHIVE_SUPERVISOR' error: ${e}`);
                }
            }
        });
        // *************************************************************************************************************
        // FEEDBACK SHOOT SUPERVISOR
        // *************************************************************************************************************
        const feedbackShootSupervisorTasks = allTasks['FEEDBACK_SHOOT_SUPERVISOR'] ? allTasks['FEEDBACK_SHOOT_SUPERVISOR'].map(task => {task.found = false; return task}) : [];
        shootProjects.forEach(project => {
            project.events.forEach(async event => {
                const found = findTaskForEvent(project, event, feedbackShootSupervisorTasks);
                if(!found) { //ADD NEW TASK
                    try {
                        const newTask = await db.addTask({
                            type: 'FEEDBACK_SHOOT_SUPERVISOR',
                            project: project.id,
                            target: project.supervisor ? project.supervisor.id : project.manager.id,
                            deadline: moment().add(5, 'days').startOf('day'),
                            dataOrigin: event
                        });
                        if(newTask.valid) {
                            delete newTask.data;
                            delete newTask.valid;
                            session.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'FEEDBACK_SHOOT_SUPERVISOR' error: ${e}`);
                    }
                } else {
                    feedbackShootSupervisorTasks[found.index].found = true; //POSSIBLY CHANGE THE TASK ??? target? dataOrigin?
                }
            });
        });
        feedbackShootSupervisorTasks.forEach(async task => {
            if(!task.found && !task.resolved) { //REMOVE TASK
                try {
                    await db.removeTask(task.id);
                    if (users[task.target]) {
                        session.publish(users[task.target].ssoId + '.task', [task.id], null);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:removeTask 'FEEDBACK_SHOOT_SUPERVISOR' error: ${e}`);
                }
            }
        });
    } catch (e) {
        logger.warn(`PusherCheck:shootProjects Error: ${e}`);
    }
    // -----------------------------------------------------------------------------------------------------------------
    // PROJECTS WITH ON-AIR
    // -----------------------------------------------------------------------------------------------------------------
    const SMALL_PROJECT_HOURS = 30;
    const LARGE_PROJECT_HOURS = 100;
    try {
        const projects = await db.getProjectAndOnAir();
        //logger.debug(`Checking projects [#${projects.length}]:`);
        // *************************************************************************************************************
        // SET ON-AIR
        // *************************************************************************************************************
        const SET_ONAIR_BEFORE_END_OF_PROJECT_DAYS = 10;
        const onAirSetTasks = allTasks['ONAIR_SET'] ? allTasks['ONAIR_SET'].map(task => {task.found = false; return task}) : [];
        projects.forEach(project => {
            //const foundTask = findTaskForOnAirProject(project, onAirSetTasks);
            //logger.debug(project.label)
        });
    } catch (e) {
        logger.warn(`PusherCheck:projects Error: ${e}`);
    }
};
// =====================================================================================================================
// HELPERS
// =====================================================================================================================
function findTaskForEvent(project, event, tasks) {
    let result = null;
    tasks.forEach((task, index) => {
        if(!result && !task.found) {
            if (task.project.toString() == project.id.toString()) {
                const target = project.supervisor ? project.supervisor.id : project.manager ? project.manager.id : null;
                if (task.target.toString() == target.toString()) {
                    if(Math.abs(moment(task.dataOrigin.lastDate).diff(event.lastDate,'days')) <= 3) result = {index: index};
                }
            }
        }
    });
    return result;
}