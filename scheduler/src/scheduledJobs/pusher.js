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
                    wamp.publish(addedMessages[0].target + '.message', [], addedMessages[0]);
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
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'VFX_ARCHIVE_SUPERVISOR' error: ${e}`);
                    }
                } else {
                    vfxArchiveSupervisorTasks[found.index].found = true; //POSSIBLY CHANGE THE TASK ??? target? dataOrigin?
                }
            });
        });
        for (const task of vfxArchiveSupervisorTasks) {
            if(!task.found && !task.resolved) { //REMOVE TASK
                try {
                    await db.removeTask(task.id);
                    if (users[task.target]) {
                        wamp.publish(users[task.target].ssoId + '.task', [task.id], null);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:removeTask 'VFX_ARCHIVE_SUPERVISOR' error: ${e}`);
                }
            }
        }
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
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'FEEDBACK_SHOOT_SUPERVISOR' error: ${e}`);
                    }
                } else {
                    feedbackShootSupervisorTasks[found.index].found = true; //POSSIBLY CHANGE THE TASK ??? target? dataOrigin?
                }
            });
        });
        for (const task of feedbackShootSupervisorTasks) {
            if(!task.found && !task.resolved) { //REMOVE TASK
                try {
                    await db.removeTask(task.id);
                    if (users[task.target]) {
                        wamp.publish(users[task.target].ssoId + '.task', [task.id], null);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:removeTask 'FEEDBACK_SHOOT_SUPERVISOR' error: ${e}`);
                }
            }
        }
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
        logger.debug(`Checking projects [#${projects.length}]:`);
        // *************************************************************************************************************
        // SET ON-AIR
        // *************************************************************************************************************
        const SET_ONAIR_BEFORE_END_OF_PROJECT_DAYS = 10;
        const onAirSetTasks = allTasks['ONAIR_SET'] ? allTasks['ONAIR_SET'].map(task => {task.found = false; return task}) : [];
        for (const project of projects) {
            const foundTask = findTaskForOnAirProject(project, onAirSetTasks);
            if(foundTask) {
                foundTask.found = true;
                if(!onAirSet(project.onair)) {
                    // UPDATE TASK IF NEEDED
                    if(onAirDiff(project.onair, foundTask.dataOrigin.onAir)) {
                        try {
                            const updatedTask = await db.updateTask(foundTask.id, {'dataOrigin.onAir': project.onair});
                            if(updatedTask && updatedTask.valid) {
                                delete updatedTask.valid;
                                wamp.publish(updatedTask.target + '.task', [updatedTask.id], updatedTask);
                            }
                        } catch (e) {
                            logger.warn(`PusherCheck:updateTask 'ONAIR_SET' error: ${e}`);
                        }
                    }
                } else {
                    // REMOVE - IT WAS JUST SET
                    try {
                        await db.removeTask(foundTask.id);
                        if(users[foundTask.target]) {
                            wamp.publish(users[foundTask.target].ssoId + '.task', [foundTask.id], null); // args = id, kwargs = null => remove on client
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:removeTask 'ONAIR_SET' error: ${e}`);
                    }
                }
            } else if(project.totalDuration > SMALL_PROJECT_HOURS && moment(project.lastDate).diff(today,'days') < SET_ONAIR_BEFORE_END_OF_PROJECT_DAYS && !onAirSet(project.onair)) {
                try {
                    const newTask = await db.addTask({
                        type: 'ONAIR_SET',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment(project.lastDate).add(-5, 'days').startOf('day'),
                        dataOrigin: {onAir: project.onair}
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'ONAIR_SET' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // PUBLISH
        // *************************************************************************************************************
        const PUBLISH_BEFORE_ON_AIR_DAYS = 15;
        const PUBLISH_BEFORE_LAST_BOOKED_DAY = 7;
        const publishManagerShowTasks = allTasks['PUBLISH_MANAGER_SHOW'] ? allTasks['PUBLISH_MANAGER_SHOW'] : [];
        for (const project of projects) {
            const projectCloseToEnd = moment(project.lastDate).diff(today,'days') <= PUBLISH_BEFORE_LAST_BOOKED_DAY;
            const onAirFiltered = project.onair.filter(onair => onair.state != 'deleted' && onair.date && (projectCloseToEnd || moment(onair.date).diff(today,'days') <= PUBLISH_BEFORE_ON_AIR_DAYS) && (project.onair.length == 1 || onair.name));
            for (const onair of onAirFiltered) {
                // Does exists task for project and onair id?
                if(!publishManagerShowTasks.some(task =>  task.project === project.id && (typeof task.dataOrigin.onAir === 'string' || onair._id.toString() == task.dataOrigin.onAir._id.toString()))) {
                    //CREATE NEW TASK - PUBLISH_MANAGER
                    try {
                        const newTask = await db.addTask({
                            type: 'PUBLISH_MANAGER_SHOW',
                            project: project.id,
                            target: project.manager.id,
                            deadline: moment(onair.date).add(-10, 'days').startOf('day'),
                            dataOrigin: {onAir: {date: moment(onair.date).startOf('day').format(), name: onair.name, _id: onair._id, state: 'used'}}
                        });
                        if(newTask.valid) {
                            delete newTask.valid;
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'PUBLISH_MANAGER_SHOW' error: ${e}`);
                    }
                    try {
                        const updatedProject = await db.updateProjectOnairState(project.id, onair._id, 'used');
                        wamp.publish('updateProject', [], updatedProject);
                    } catch (e) {
                        logger.warn(`PusherCheck:updateProjectOnairState 'PUBLISH_MANAGER_SHOW' error: ${e}`);
                    }
                }
            }
            for (const task of publishManagerShowTasks) { //go through all publishManagerShowTasks and update dataOrigin.onAir if changed - do it for followed tasks as well
                const changedOnair = getChangedOnair(task, projects); // return new onair from project if changed from the task.dataOrigin.onAir
                if(changedOnair) {
                    try {
                        await updateFollowedTasks(task.id, {'dataOrigin.onAir': changedOnair});
                    } catch (e) {
                        logger.warn(`PusherCheck:updateFollowedTask 'PUBLISH_MANAGER_SHOW' error: ${e}`);
                    }
                }
            }
        }
        // *************************************************************************************************************
        // MAKING OF
        // *************************************************************************************************************
        const MAKING_OF_BEFORE_ON_AIR_DAYS = 20;
        const MAKING_OF_BEFORE_LAST_BOOKED_DAY = 7;
        const makingOfSupervisorTasks = allTasks['MAKING_OF_SUPERVISOR'] ? allTasks['MAKING_OF_SUPERVISOR'] : [];
        projects.filter(project => project.totalDuration > LARGE_PROJECT_HOURS).forEach(project => {
            const projectCloseToEnd = moment(project.lastDate).diff(today,'days') <= MAKING_OF_BEFORE_LAST_BOOKED_DAY;
            const onAirFiltered = project.onair.filter(onair => onair.state != 'deleted' && onair.date && (projectCloseToEnd || moment(onair.date).diff(today,'days') <= MAKING_OF_BEFORE_ON_AIR_DAYS) && (project.onair.length == 1 || onair.name));
            onAirFiltered.forEach(async onair => {
                // Does exists a task for the project and the onair id?
                if(!makingOfSupervisorTasks.some(task =>  task.project === project.id && (typeof task.dataOrigin.onAir === 'string' || onair._id.toString() == task.dataOrigin.onAir._id.toString()))) {
                    //CREATE NEW TASK - MAKING_OF_SUPERVISOR
                    try {
                        const newTask = await db.addTask({
                            type: 'MAKING_OF_SUPERVISOR',
                            project: project.id,
                            target: project.supervisor ? project.supervisor.id : project.manager.id,
                            deadline: moment(onair.date).add(-10, 'days').startOf('day'),
                            dataOrigin: {onAir: {date: moment(onair.date).startOf('day').format(), name: onair.name, _id: onair._id, state: 'used'}}
                        });
                        if(newTask.valid) {
                            delete newTask.valid;
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'MAKING_OF_SUPERVISOR' error: ${e}`);
                    }
                    try {
                        const updatedProject = await db.updateProjectOnairState(project.id, onair._id, 'used');
                        wamp.publish('updateProject', [], updatedProject);
                    } catch (e) {
                        logger.warn(`PusherCheck:updateProjectOnairState 'MAKING_OF_SUPERVISOR' error: ${e}`);
                    }
                }
            });
            makingOfSupervisorTasks.forEach(async task => { //go through all publishManagerShowTasks and update dataOrigin.onAir if changed - do it for followed tasks as well
                const changedOnair = getChangedOnair(task, projects); // return new onair from project if changed from the task.dataOrigin.onAir
                if(changedOnair) {
                    try {
                        await updateFollowedTasks(task.id, {'dataOrigin.onAir': changedOnair});
                    } catch (e) {
                        logger.warn(`PusherCheck:updateFollowedTask 'MAKING_OF_SUPERVISOR' error: ${e}`);
                    }
                }
            });
        });
        // *************************************************************************************************************
        // SHOWREEL SHOTS
        // *************************************************************************************************************
        const showreelShotsTasks = allTasks['SHOWREEL_SHOTS'] ? allTasks['SHOWREEL_SHOTS'] : [];
        for (const project of projects.filter(project => project.totalDuration > SMALL_PROJECT_HOURS && moment(project.lastDate).diff(today, 'days') < 0)) {
            if(!showreelShotsTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - SHOWREEL_SHOTS
                try {
                    const newTask = await db.addTask({
                        type: 'SHOWREEL_SHOTS',
                        project: project.id,
                        target: project.supervisor ? project.supervisor.id : project.manager.id,
                        deadline: moment().add(10, 'days').startOf('day'),
                        dataOrigin: null
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'SHOWREEL_SHOTS' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // FEEDBACK SUPERVISOR
        // *************************************************************************************************************
        const feedbackSupervisorTasks = allTasks['FEEDBACK_SUPERVISOR'] ? allTasks['FEEDBACK_SUPERVISOR'] : [];
        for (const project of projects.filter(project => project.totalDuration > SMALL_PROJECT_HOURS && moment(project.lastDate).diff(today, 'days') < 0)) {
            if(!feedbackSupervisorTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - FEEDBACK_SUPERVISOR
                try {
                    const newTask = await db.addTask({
                        type: 'FEEDBACK_SUPERVISOR',
                        project: project.id,
                        target: project.supervisor ? project.supervisor.id : project.manager.id,
                        deadline: moment().add(15, 'days').startOf('day'),
                        dataOrigin: null
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'FEEDBACK_SUPERVISOR' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // FEEDBACK MANAGER
        // *************************************************************************************************************
        const feedbackManagerTasks = allTasks['FEEDBACK_MANAGER'] ? allTasks['FEEDBACK_MANAGER'] : [];
        for (const project of projects.filter(project => project.totalDuration > SMALL_PROJECT_HOURS && moment(project.lastDate).diff(today, 'days') < 0)) {
            if(!feedbackManagerTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - FEEDBACK_MANAGER
                try {
                    const newTask = await db.addTask({
                        type: 'FEEDBACK_MANAGER',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment().add(15, 'days').startOf('day'),
                        dataOrigin: null
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'FEEDBACK_MANAGER' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // FEEDBACK PR MANAGER CONTACT
        // *************************************************************************************************************
        const FEEDBACK_PR_MANAGER_CONTACT_DAYS_AFTER_LAST_ONAIR = 60;
        const feedbackPrManagerContactTasks = allTasks['FEEDBACK_PR_MANAGER_CONTACT'] ? allTasks['FEEDBACK_PR_MANAGER_CONTACT'] : [];
        for (const project of projects.filter(project => {
            const lastOnair = project.onair.reduce((out, onair) => !out || moment(onair.date).isAfter(out) ? onair.date : out, null);
            return lastOnair && moment().startOf('day').diff(lastOnair, 'days') > FEEDBACK_PR_MANAGER_CONTACT_DAYS_AFTER_LAST_ONAIR;
        })) {
            if(!feedbackPrManagerContactTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - FEEDBACK_PR_MANAGER_CONTACT
                try {
                    const newTask = await db.addTask({
                        type: 'FEEDBACK_PR_MANAGER_CONTACT',
                        project: project.id,
                        target: {role: 'booking:pr-manager'},
                        deadline: moment().add(15, 'days').startOf('day'),
                        dataOrigin: null
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'FEEDBACK_PR_MANAGER_CONTACT' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // ARCHIVE
        // *************************************************************************************************************
        const ARCHIVE_DAYS_AFTER_LAST_BOOKED_DAY = 14; //30;
        const archiveManagerCleanVersionTasks = allTasks['ARCHIVE_MANAGER_CLEAN_VERSION'] ? allTasks['ARCHIVE_MANAGER_CLEAN_VERSION'] : [];
        const archiveManagerPrepareTasks = allTasks['ARCHIVE_MANAGER_PREPARE'] ? allTasks['ARCHIVE_MANAGER_PREPARE'] : [];
        const makingOfProducerTasks = allTasks['MAKING_OF_PRODUCER'] ? allTasks['MAKING_OF_PRODUCER'] : [];
        const makingOfOperatorTasks = allTasks['MAKING_OF_OPERATOR'] ? allTasks['MAKING_OF_OPERATOR'] : [];
        const makingOfOperator2DTasks = allTasks['MAKING_OF_OPERATOR_2D'] ? allTasks['MAKING_OF_OPERATOR_2D'] : [];
        const makingOfOperator3DTasks = allTasks['MAKING_OF_OPERATOR_3D'] ? allTasks['MAKING_OF_OPERATOR_3D'] : [];

        for (const project of projects.filter(project => {
            if (moment().startOf('day').diff(project.lastDate, 'days') < ARCHIVE_DAYS_AFTER_LAST_BOOKED_DAY) return false;
            if (project.onair && Array.isArray(project.onair) && project.onair.length > 0 && project.totalDuration > LARGE_PROJECT_HOURS && !makingOfSupervisorTasks.some(task => task.project === project.id)) return false; // MAKING_OF_SUPERVISOR should exist for large project and this time, probably just added, so skip for now
            if (makingOfSupervisorTasks.some(task => task.project === project.id && !task.resolved)) return false; // some MAKING_OF_SUPERVISOR has not decided
            if (makingOfProducerTasks.some(task => task.project === project.id && !task.resolved)) return false; // some MAKING_OF_PRODUCER has not decided
            const makingOfProducerTasksNum = makingOfProducerTasks.filter(task => task.project === project.id && task.resolved && task.dataTarget).length;
            if(makingOfProducerTasksNum > 0) {
                const makingOfOperatorTasksNum = makingOfOperatorTasks.filter(task => task.project === project.id && task.resolved).length;
                const makingOfOperator2DTasksNum = makingOfOperator2DTasks.filter(task => task.project === project.id && task.resolved).length;
                const makingOfOperator3DTasksNum = makingOfOperator3DTasks.filter(task => task.project === project.id && task.resolved).length;
                if(makingOfOperator2DTasksNum > 0 || makingOfOperator3DTasksNum > 0) {
                   if(makingOfOperator2DTasksNum !== makingOfOperator3DTasksNum) return false;
                   if(makingOfOperator2DTasksNum !== makingOfProducerTasksNum) return false;
                } else if(makingOfOperatorTasksNum !== makingOfProducerTasksNum) return false;
                //if (makingOfProducerTasks.filter(task => task.project === project.id && task.resolved && task.dataTarget).length !== makingOfOperatorTasks.filter(task => task.project === project.id && task.resolved).length) return false; // some making of are not finished yet or it has not been decided
            }
            return true;
        })) {
            if(!archiveManagerCleanVersionTasks.some(task => task.project === project.id)) {
                //CREATE NEW TASK - ARCHIVE_MANAGER_CLEAN_VERSION
                try {
                    const newTask = await db.addTask({
                        type: 'ARCHIVE_MANAGER_CLEAN_VERSION',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment().add(15, 'days').startOf('day'),
                        dataOrigin: null
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'ARCHIVE_MANAGER_CLEAN_VERSION' error: ${e}`);
                }
            }
            if(!archiveManagerPrepareTasks.some(task => task.project === project.id)) {
                //CREATE NEW TASK - ARCHIVE_MANAGER_PREPARE
                try {
                    const newTask = await db.addTask({
                        type: 'ARCHIVE_MANAGER_PREPARE',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment().add(15, 'days').startOf('day'),
                        dataOrigin: null
                    });
                    if(newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'ARCHIVE_MANAGER_PREPARE' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // TEAM FEEDBACK 3D
        // *************************************************************************************************************
        const TEAM_3D_BOOKED_SIZE = 100;
        const TEAM_3D_DAYS = 5;
        const teamFeedback3DTasks = allTasks['TEAM_FEEDBACK_3D'] ? allTasks['TEAM_FEEDBACK_3D'] : [];
        for (const project of projects.filter(project => project.totalDuration3D > TEAM_3D_BOOKED_SIZE && moment(project.lastDate3D).diff(today, 'days') < TEAM_3D_DAYS)) {
            if(project.lead3D && !teamFeedback3DTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - TEAM_FEEDBACK_3D
                let team;
                try {
                    team = await db.getTeamFromWorkLog(project.id, '3D', project.lead3D.id);
                } catch (e) {
                    logger.warn(`PusherCheck:getTeamFromWorkLog 'ARCHIVE_MANAGER_PREPARE' error: ${e}`);
                }
                if(team && team.length > 0) {
                    try {
                        const newTask = await db.addTask({
                            type: 'TEAM_FEEDBACK_3D',
                            project: project.id,
                            target: project.lead3D.id,
                            deadline: moment().add(15, 'days').startOf('day'),
                            dataOrigin: {team: team}
                        });
                        if (newTask.valid) {
                            delete newTask.valid;
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'TEAM_FEEDBACK_3D' error: ${e}`);
                    }
                }
            }
        }
        // *************************************************************************************************************
        // TEAM FEEDBACK 2D
        // *************************************************************************************************************
        const TEAM_2D_PROJECT_SIZE = 300;
        const TEAM_2D_DAYS = 5;
        const teamFeedback2DTasks = allTasks['TEAM_FEEDBACK_2D'] ? allTasks['TEAM_FEEDBACK_2D'] : [];
        for (const project of projects.filter(project => project.totalDuration2D > TEAM_2D_PROJECT_SIZE && moment(project.lastDate2D).diff(today, 'days') < TEAM_2D_DAYS)) {
            if(project.lead2D && !teamFeedback2DTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - TEAM_FEEDBACK_3D
                let team;
                try {
                    team = await db.getTeamFromWorkLog(project.id, '2D', project.lead2D.id);
                } catch (e) {
                    logger.warn(`PusherCheck:getTeamFromWorkLog 'TEAM_FEEDBACK_2D' error: ${e}`);
                }
                if(team && team.length > 0) {
                    try {
                        const newTask = await db.addTask({
                            type: 'TEAM_FEEDBACK_2D',
                            project: project.id,
                            target: project.lead2D.id,
                            deadline: moment().add(15, 'days').startOf('day'),
                            dataOrigin: {team: team}
                        });
                        if (newTask.valid) {
                            delete newTask.valid;
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'TEAM_FEEDBACK_2D' error: ${e}`);
                    }
                }
            }
        }
        // *************************************************************************************************************
        // TEAM FEEDBACK SUPERVISOR
        // *************************************************************************************************************
        const TEAM_SUPERVISOR_PROJECT_SIZE = 400;
        const TEAM_SUPERVISOR_DAYS = 5;
        const teamFeedbackSupervisorTasks = allTasks['TEAM_FEEDBACK_SUPERVISOR'] ? allTasks['TEAM_FEEDBACK_SUPERVISOR'] : [];
        for (const project of projects.filter(project => project.totalDuration > TEAM_SUPERVISOR_PROJECT_SIZE && moment(project.lastDate).diff(today, 'days') < TEAM_SUPERVISOR_DAYS)) {
            if(project.supervisor && !teamFeedbackSupervisorTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                //CREATE NEW TASK - TEAM_FEEDBACK_SUPERVISOR
                let team;
                try {
                    team = await db.getTeamFromWorkLog(project.id, ['2D','3D','MP'], project.supervisor.id);
                } catch (e) {
                    logger.warn(`PusherCheck:getTeamFromWorkLog 'TEAM_FEEDBACK_SUPERVISOR' error: ${e}`);
                }
                if(team && team.length > 0) {
                    try {
                        const newTask = await db.addTask({
                            type: 'TEAM_FEEDBACK_SUPERVISOR',
                            project: project.id,
                            target: project.supervisor.id,
                            deadline: moment().add(15, 'days').startOf('day'),
                            dataOrigin: {team: team}
                        });
                        if (newTask.valid) {
                            delete newTask.valid;
                            wamp.publish(newTask.target + '.task', [], newTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:addTask 'TEAM_FEEDBACK_SUPERVISOR' error: ${e}`);
                    }
                }
            }
        }
        // *************************************************************************************************************
        // INVOICE - SET
        // *************************************************************************************************************
        const INVOICE_SET_PROJECT_SIZE = 0;
        const INVOICE_SET_CUT_OFF_DATE = "2017-01-01";
        const invoiceSetTasks = allTasks['INVOICE_SET'] ? allTasks['INVOICE_SET'].map(task => {task.found = false; return task}) : [];
        for (const project of projects.filter(project => project.confirmed && (!project.invoice || project.invoice.length === 0) && project.totalDuration > INVOICE_SET_PROJECT_SIZE && moment(project.lastDate).diff(moment(INVOICE_SET_CUT_OFF_DATE, 'YYYY-MM-DD'), 'days') >= 0)) {
            const index = invoiceSetTasks.reduce((out, task, i) => task.project === project.id ? i : out, -1);
            if(index < 0) {
                try {
                    const newTask = await db.addTask({
                        type: 'INVOICE_SET',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment().startOf('day')
                    });
                    if (newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'INVOICE_SET' error: ${e}`);
                }
            }
        }
        // *************************************************************************************************************
        // INVOICE - SEND + CHECK
        // *************************************************************************************************************
        const INVOICE_SEND_ADVANCE_DAYS = 14;
        const INVOICE_CHECK_AFTER_DAYS = 4;
        const invoiceSendTasks = allTasks['INVOICE_SEND'] ? allTasks['INVOICE_SEND'] : [];
        const invoiceCheckTasks = allTasks['INVOICE_CHECK'] ? allTasks['INVOICE_CHECK'] : [];
        projects.filter(project => project.invoice && project.invoice.length > 0).forEach(project => {
            const invoiceObject = project.invoice.reduce((out, invoice) => {
                const dateString = moment(invoice.date).format('YYYY-MM-DD');
                if(out[dateString]) out[dateString].push(invoice.name);
                else out[dateString] = [invoice.name];
                return out;
            }, {});
            Object.keys(invoiceObject).forEach(async invoiceDueTo => {
                //check for possible name/number for the day has changed....
                const sendTask = invoiceSendTasks.filter(task => !task.resolved && task.project === project.id && task.dataOrigin && task.dataOrigin.invoiceDueTo && task.dataOrigin.invoiceDueTo == invoiceDueTo);
                if(sendTask.length > 0 && areInvoicesDifferent(sendTask[0].dataOrigin.invoiceName, invoiceObject[invoiceDueTo])) {
                    try {
                        const data = await db.updateTask(sendTask[0].id, {'dataOrigin.invoiceName': invoiceObject[invoiceDueTo]});
                        const updatedTask = data.updatedTask;
                        if(updatedTask && updatedTask.valid) {
                            delete updatedTask.valid;
                            wamp.publish(updatedTask.target + '.task', [updatedTask.id], updatedTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:updateTask 'INVOICE_SEND' error: ${e}`);
                    }
                }
                const checkTask = invoiceCheckTasks.filter(task => !task.resolved && task.project === project.id && task.dataOrigin && task.dataOrigin.invoiceDueTo && task.dataOrigin.invoiceDueTo == invoiceDueTo);
                if(checkTask.length > 0 && areInvoicesDifferent(checkTask[0].dataOrigin.invoiceName, invoiceObject[invoiceDueTo])) {
                    try {
                        const data = await db.updateTask(checkTask[0].id, {'dataOrigin.invoiceName': invoiceObject[invoiceDueTo]});
                        const updatedTask = data.updatedTask;
                        if(updatedTask && updatedTask.valid) {
                            delete updatedTask.valid;
                            wamp.publish(updatedTask.target + '.task', [updatedTask.id], updatedTask);
                        }
                    } catch (e) {
                        logger.warn(`PusherCheck:updateTask 'INVOICE_CHECK' error: ${e}`);
                    }
                }
                const invoiceDueToDate = moment(invoiceDueTo,'YYYY-MM-DD');
                if(invoiceDueToDate.diff(today,'days') <= INVOICE_SEND_ADVANCE_DAYS) {
                    //send INVOICE_SEND if was not done before for specific invoiceDueTo
                    if(!invoiceSendTasks.some(task => task.project === project.id && (!task.dataOrigin || !task.dataOrigin.invoiceDueTo || task.dataOrigin.invoiceDueTo == invoiceDueTo))) {
                        try {
                            const newTask = await db.addTask({
                                type: 'INVOICE_SEND',
                                project: project.id,
                                target: project.manager.id,
                                deadline: moment().startOf('day'),
                                dataOrigin: {invoiceDueTo: invoiceDueTo, invoiceName: invoiceObject[invoiceDueTo]}
                            });
                            if (newTask.valid) {
                                delete newTask.valid;
                                wamp.publish(newTask.target + '.task', [], newTask);
                            }
                        } catch (e) {
                            logger.warn(`PusherCheck:addTask 'INVOICE_SEND' error: ${e}`);
                        }
                    }
                    if(today.diff(invoiceDueToDate,'days') >= INVOICE_CHECK_AFTER_DAYS) {
                        //send INVOICE_CHECK if was not done before for specific invoiceDueTo
                        if(!invoiceCheckTasks.some(task => task.project === project.id && (!task.dataOrigin || !task.dataOrigin.invoiceDueTo || task.dataOrigin.invoiceDueTo == invoiceDueTo))) {
                            try {
                                const newTask = await db.addTask({
                                    type: 'INVOICE_CHECK',
                                    project: project.id,
                                    target: project.manager.id,
                                    deadline: moment().startOf('day'),
                                    dataOrigin: {invoiceDueTo: invoiceDueTo, invoiceName: invoiceObject[invoiceDueTo]}
                                });
                                if (newTask.valid) {
                                    delete newTask.valid;
                                    wamp.publish(newTask.target + '.task', [], newTask);
                                }
                            } catch (e) {
                                logger.warn(`PusherCheck:addTask 'INVOICE_CHECK' error: ${e}`);
                            }
                        }
                    }
                }
            });
        });
        // *************************************************************************************************************
        // CLOSE TO FINAL
        // *************************************************************************************************************
        const CLOSE_TO_FINAL_DAYS = 7;
        const CLOSE_TO_FINAL_CUT_OFF_DATE = '2017-01-25';
        const closeToFinalTasks = allTasks['CLOSE_TO_FINAL'] ? allTasks['CLOSE_TO_FINAL'] : [];
        for (const project of projects.filter(project => moment(project.lastDate).diff(today, 'days') <= CLOSE_TO_FINAL_DAYS && moment(project.lastDate).diff(moment(CLOSE_TO_FINAL_CUT_OFF_DATE, 'YYYY-MM-DD'), 'days') >= 0)) {
            if(!closeToFinalTasks.some(task => task.project === project.id)) { // Does exists a task for the project?
                try {
                    const newTask = await db.addTask({
                        type: 'CLOSE_TO_FINAL',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment(project.lastDate).add(-5, 'days').startOf('day'),
                        dataOrigin: {noOnAir: project.onair.filter(onair => onair.state !== 'deleted' && onair.date && (project.onair.length === 1 || onair.name)).length === 0}
                    });
                    if (newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'CLOSE_TO_FINAL' error: ${e}`);
                }
            }
            for (const task of closeToFinalTasks.filter(task => task.resolved === null)) { //go through all unresolved closeToFinalTasks and update dataOrigin.onAir if changed - do it for followed tasks as well
                const project = projects.find(project => project.id === task.project);
                if(project) {
                    const noOnAir = project.onair.filter(onair => onair.state !== 'deleted' && onair.date && (project.onair.length === 1 || onair.name)).length === 0;
                    if(noOnAir !== task.dataOrigin.noOnAir) {
                        try {
                            await updateFollowedTasks(task.id, {'dataOrigin.noOnAir': noOnAir});
                        } catch (e) {
                            logger.warn(`PusherCheck:updateFollowedTask 'CLOSE_TO_FINAL' error: ${e}`);
                        }
                    }
                }
            }
        }
        // *************************************************************************************************************
        // K2 PROJECT
        // *************************************************************************************************************
        const K2projectTasks = allTasks['K2_PROJECT'] ? allTasks['K2_PROJECT'].map(task => {task.found = false; return task}) : [];
        for (const project of projects.filter(project => project.confirmed)) {
            const index = K2projectTasks.reduce((out, task, i) => task.project === project.id ? i : out, -1);
            if(index < 0) {
                //CREATE NEW TASK - K2_PROJECT
                try {
                    const newTask = await db.addTask({
                        type: 'K2_PROJECT',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment().startOf('day'),
                        dataOrigin: null
                    });
                    if (newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'K2_PROJECT' error: ${e}`);
                }
            } else {
                K2projectTasks[index].found = true;
            }
        }
        // REMOVE ALL NOT FOUND - PROBABLY SET BACK TO NOT CONFIRMED
        await Promise.all(K2projectTasks.filter(task => !task.found).map(async task => {
            try {
                await db.removeTask(task.id);
                if (users[task.target]) {
                    wamp.publish(users[task.target].ssoId + '.task', [task.id], null);
                }
            } catch (e) {
                logger.warn(`PusherCheck:removeTask 'K2_PROJECT' error: ${e}`);
            }
        }));
        // *************************************************************************************************************
        // BUDGET LINK
        // *************************************************************************************************************
        const BUDGET_LINK_PROJECT_SIZE = 0;
        const BUDGET_LINK_CUT_OFF_DATE = "2017-08-01";
        const budgetLinkTasks = allTasks['BUDGET_LINK'] ? allTasks['BUDGET_LINK'] : [];
        for (const project of projects.filter(project => project.confirmed && !project.budget && project.totalDuration > BUDGET_LINK_PROJECT_SIZE && moment(project.lastDate).diff(moment(BUDGET_LINK_CUT_OFF_DATE, 'YYYY-MM-DD'), 'days') >= 0)) {
            const index = budgetLinkTasks.reduce((out,task, i) => task.project === project.id ? i : out, -1);
            if(index < 0) {
                //CREATE NEW TASK - BUDGET_LINK
                try {
                    const newTask = await db.addTask({
                        type: 'BUDGET_LINK',
                        project: project.id,
                        target: project.manager.id,
                        deadline: moment().startOf('day')
                    });
                    if (newTask.valid) {
                        delete newTask.valid;
                        wamp.publish(newTask.target + '.task', [], newTask);
                    }
                } catch (e) {
                    logger.warn(`PusherCheck:addTask 'BUDGET_LINK' error: ${e}`);
                }
            }
        }
    } catch (e) {
        logger.warn(`PusherCheck:projects Error: ${e}`);
    }
};

// =====================================================================================================================
// HELPERS
// =====================================================================================================================
async function updateFollowedTasks(taskIds, update) {
    if(!taskIds || !update) return;
    if(!Array.isArray(taskIds)) taskIds = [taskIds];
    for (const taskId of taskIds) {
        const updatedData = await db.updateTask(taskId, update);
        const updatedTask = updatedData.updatedTask;
        if(updatedTask && updatedTask.valid) {
            delete updatedTask.valid;
            wamp.publish(updatedTask.target + '.task', [updatedTask.id], updatedTask);
        }
        await updateFollowedTasks(updatedData.followed.filter(t => ['000000000000000000000000', '000000000000000000000001'].indexOf(t.toString()) < 0), update);
    }
}
// ---------------------------------------------------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------------------------------------------------
function findTaskForOnAirProject(project, tasks) {
    let result = null;
    tasks.forEach((task) => {
        if(!result && !task.found) {
            if (task.project.toString() == project.id.toString()) {
                result = task;
            }
        }
    });
    return result;
}
// ---------------------------------------------------------------------------------------------------------------------
function onAirSet(onairs) {
    let result = true;
    const activeOnair = onairs.filter(onair => onair.state !== 'deleted');
    activeOnair.forEach(onair => {
        if(result && (!onair.date || (!onair.name && activeOnair.length > 1))) result = false;
    });
    return result;
}
// ---------------------------------------------------------------------------------------------------------------------
function onAirDiff(a, b) {
    let result = false;
    if(typeof a === 'string' || typeof b === 'string') return true;
    if(a.length !== b.length) return true;
    a.forEach((oa, i) => {
        const aDate = a[i].date ? a[i].date.getTime() : '';
        const bDate = b[i].date ? b[i].date.getTime() : '';
        if(!result && (aDate !== bDate || a[i].name !== b[i].name || a[i]._id.toString() !== b[i]._id.toString() || a[i].state !== b[i].state)) result = true;
    });
    return result;
}
// ---------------------------------------------------------------------------------------------------------------------
function getChangedOnair(task, projects) {
    let result = null;
    const projectId = task.project ? task.project.toString() : null;
    const onAirId = task.dataOrigin && task.dataOrigin.onAir ? task.dataOrigin.onAir._id.toString() : null;

    if(projectId) {
        const project = projects.find(project => project.id.toString() === projectId);
        if(project) {
            if(onAirId) {
                const onAir = project.onair.find(onair => onair._id.toString() === onAirId);
                if(onAir) {
                    const taskDate = task.dataOrigin.onAir.date ? typeof task.dataOrigin.onAir.date === 'string' ? +new Date(task.dataOrigin.onAir.date) : task.dataOrigin.onAir.date.getTime() : '';
                    const projectDate = onAir.date ? onAir.date.getTime() : '';
                    if(taskDate !== projectDate || task.dataOrigin.onAir.name !== onAir.name || task.dataOrigin.onAir.state !== onAir.state) {
                        result = onAir;
                    }
                }
            } else if(project.onair.length > 0) {
                result = project.onair[0];
            }
        }
    }
    return result;
}
// ---------------------------------------------------------------------------------------------------------------------
function areInvoicesDifferent(a, b) {
    if(a.length != b.length) return true;
    for(let i=0; i< a.length; i++) {
        if(a[i] != b[i]) return true;
    }
    return false;
}
// ---------------------------------------------------------------------------------------------------------------------