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
    // ----------------------------------------------
    // AFTER SHOOT
    // ----------------------------------------------
    try {
        const shootProjects = await db.getProjectsWithShootEvent();
        const vfxArchiveSupervisorTasks = allTasks['VFX_ARCHIVE_SUPERVISOR'] ? allTasks['VFX_ARCHIVE_SUPERVISOR'].map(task => {task.found = false; return task}) : [];
        shootProjects.forEach(project => {

        });
    } catch (e) {
        logger.warn(`PusherCheck:afterShoot Error: ${e}`);
    }
};