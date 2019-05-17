'use strict';

const mongoose = require('mongoose');
const dataHelper = require('../lib/dataHelper');
const taskHelper = require('../lib/taskHelper');
const moment = require('moment');

//Collections
const BookingProject = require('../models/booking-project');
const BookingResource = require('../models/booking-resource');
const BookingWorkType = require('../models/booking-work-type');
const User = require('../models/user');
const BookingEvent = require('../models/booking-event');
const BookingOplog = require('../models/booking-oplog');
const PusherWorklog = require('../models/pusher-worklog');
const PusherTask = require('../models/pusher-task');
const PusherMessage = require('../models/pusher-message');
const PusherWorkRequest = require('../models/pusher-work-request');

//const logger = require('../logger');

exports = module.exports;

// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
exports.logOp = async (type, user, data, err) => {
    await BookingOplog.create({type: type, user: user, data: data, success: !err, reason: err});
};
//----------------------------------------------------------------------------------------------------------------------
// ===>  K2
//----------------------------------------------------------------------------------------------------------------------
// *********************************************************************************************************************
// Get K2 linked projects
// *********************************************************************************************************************
exports.getK2linkedProjects = async projectId => {
    const query = {deleted: null, $and: [{K2rid : {$ne: null}}, {K2rid: {$ne: '0'}}]};
    if(projectId) query._id = projectId;
    return await BookingProject.find(query, {__v:false, 'jobs.__v':false, 'jobs._id':false, 'timing.__v':false, 'timing._id':false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v':false, deleted:false }).lean();
};

// *********************************************************************************************************************
// Get Resource map
// *********************************************************************************************************************
exports.getResourcesMap = async () => {
    const resources = await BookingResource.find({type: 'OPERATOR', K2id: {$ne: null}}, 'K2id job').lean();
    const users = await User.find({}, 'resource').lean();
    return dataHelper.mapResources(resources, users);
};

// *********************************************************************************************************************
// Get WorkType map
// *********************************************************************************************************************
exports.getWorkTypeMap = async () => {
    const workTypes = await BookingWorkType.find({},{K2ids: true, bookable: true, multi: true}).lean();
    return dataHelper.mapJobs(workTypes);
};

// *********************************************************************************************************************
// Get Project Operators Efficiency
// *********************************************************************************************************************
exports.getProjectOperatorsEfficiency = async eventIds => {
    const events = await Promise.all(eventIds.map(eventId => BookingEvent.findOne({_id: eventId, operator: {$ne: null}}, {operator : true, efficiency: true, job: true, _id: false})));
    return dataHelper.mapEffeciency(events);
};

// *********************************************************************************************************************
// Update booking project
// *********************************************************************************************************************
exports.updateProject = async (id, project) => {
    await BookingProject.findOneAndUpdate({_id: id}, {$set: project});
};

// *********************************************************************************************************************
// Add or Update work log record in db
// *********************************************************************************************************************
exports.addOrUpdateWorklog = async worklog => {
    return await PusherWorklog.findOneAndUpdate({_id: worklog._id}, {$set: worklog}, {upsert: true, setDefaultsOnInsert: true});
};

//----------------------------------------------------------------------------------------------------------------------
// ===> PUSHER
//----------------------------------------------------------------------------------------------------------------------
// *********************************************************************************************************************
// Update Tasks ConditionsMet
// *********************************************************************************************************************
exports.updateTasksConditionsMet = async () => {
    const users = await  exports.getUsers();
    const allTasks = await PusherTask.find({},{dataOrigin: true, dataTarget: true, project: true, resolved: true, type: true, timestamp:true}).lean();
    const tasks = await PusherTask.find({resolved: null, "conditions.0" : { "$exists": true }},{__v: false, resolved: false, /*origin: false,*/ dataTarget: false}).populate('project').lean(); //all not resolved tasks with some conditions
    const changedTasks = tasks.filter(task => taskHelper.evaluateTaskConditions(task, task.project ? task.project._id : null, (task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir._id ? task.dataOrigin.onAir._id : null), allTasks) != task.conditionsMet); // tasks with conditionsMet has been changed
    const updatedTasks = await Promise.all(changedTasks.map(task => PusherTask.findOneAndUpdate({_id: task._id}, {$set: {conditionsMet: !task.conditionsMet}}, { new: true })));
    return await Promise.all(updatedTasks.map(task => taskHelper.normalizeTask(task, users)));
};
// *********************************************************************************************************************
// Get Users
// *********************************************************************************************************************
exports.getUsers = async () => {
    const users = await User.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(users)
};
// *********************************************************************************************************************
// Get Unanswered Messages
// *********************************************************************************************************************
const UNANSWERED_HOURS = 36; //24 + 12 afternoon after expiration
exports.getUnansweredMessages = async () => {
    const messages = await PusherMessage.find({confirm: true, confirmed: null, followed: null}).lean();
    const out = [];
    messages.forEach(message => {
        const delay = moment().diff(moment(message.deadline).startOf('day'),'hours');
        if(delay > UNANSWERED_HOURS) {
            const unanswered = message.target.filter((t,i) => message.confirmed[i] === null);
            if(unanswered.length > 0) {
                out.push({
                    origin: message.origin,
                    id: message._id,
                    unanswered: unanswered,
                    timestamp: message.timestamp,
                    message: message.message,
                    type: message.type
                });
            }
        }
    });
    return out;
};
// *********************************************************************************************************************
// Add Message
// *********************************************************************************************************************
exports.addMessage = async message => {
    if(!message || !message.target) return null;
    const users = await exports.getUsers();
    const targetByRole = message.target.role ? await exports.getUsersByRole(message.target.role) : null;
    let target = targetByRole ? targetByRole.map(target => target.id) :  Array.isArray(message.target) ? message.target : [message.target];
    if(message.origin) target = target.filter(t => t != message.origin);
    if(target.length === 0) return [];
    let newMessage = await PusherMessage.create({
        type: message.type,
        confirm: !!message.confirm,
        origin: message.origin ? message.origin : null,
        label: message.label,
        message: message.message,
        details: message.details ? message.details : '',
        target: target,
        deadline: message.deadline,
        postpone: target.map(t => 0),
        answer: target.map(t => null),
        confirmed: target.map(t => users[t] && users[t].access && users[t].access.indexOf('pusher:app') >= 0 ? null : moment()) //don't wait for answer from not pusher users (email only)
    });
    if(newMessage) newMessage = taskHelper.normalizeMessage(newMessage, users);
    return newMessage ? newMessage : [];
};
// *********************************************************************************************************************
// Update Message
// *********************************************************************************************************************
exports.updateMessage = async (id, data) => {
    const message = await PusherMessage.findOneAndUpdate({_id: id}, {$set: data}, {new: true});
    if(!message) throw new Error(`updateMessage: can't find message id: ${id}`);
    return message;
};
// *********************************************************************************************************************
// Get user by role
// *********************************************************************************************************************
exports.getUsersByRole = async role => {
    if(!role) throw new Error(`getUsersByRole: missing role`);
    const query = Array.isArray(role) ? {$or : role.map(r => {return {role: r}})} : {role: role};
    const users = await User.find(query).lean();
    return users.map(user => {return {id: user._id.toString(), label: user.name}}).sort((a,b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
};
// *********************************************************************************************************************
// Get tasks
// *********************************************************************************************************************
exports.getTasks = async project => {
    const tasks = await PusherTask.find(project ? {project: project} : {}, {target: true, project: true, dataTarget: true, dataOrigin: true, resolved: true, type: true, followed: true, timestamp: true}).lean();
    return tasks.map(task => ({
        id: task._id.toString(),
        type: task.type,
        target: task.target,
        project: task.project ? task.project.toString() : null,
        dataOrigin: task.dataOrigin,
        dataTarget: task.dataTarget,
        resolved: task.resolved,
        followed: task.followed,
        timestamp: task.timestamp,
    }));
};
// *********************************************************************************************************************
// Get Projects With Shoot Events
// *********************************************************************************************************************
exports.getProjectsWithShootEvent = async () => {
    const projects = await BookingProject.find({deleted: null, offtime: false, external: false, confirmed: true},{events: true, label: true, manager: true, supervisor: true}).populate('events').lean();
    const users = await exports.getUsers();
    const today = moment().startOf('day');
    return projects.reduce((out, project) => {
        let eventsWithShoot = project.events.filter(event => event.isShooting).map(event => {return {
            firstDate: moment(event.startDate).startOf('day'),
            lastDate: moment(event.startDate).startOf('day').add(event.days.length - 1,'days')
        }}).sort((a, b) => a.firstDate.isAfter(b.firstDate) ? 1 : b.firstDate.isAfter(a.firstDate) ? -1 : 0);
        eventsWithShoot = taskHelper.flattenIntervals(eventsWithShoot, today);
        if(eventsWithShoot.length > 0) {
            out.push({
                id: project._id,
                supervisor: project.supervisor && users[project.supervisor] ? {id: project.supervisor, ssoId: users[project.supervisor].ssoId} : null,
                manager: project.manager && users[project.manager] ? {id: project.manager, ssoId: users[project.manager].ssoId} : null,
                label: project.label,
                events: eventsWithShoot
            })
        }
        return out;
    },[]);
};
// *********************************************************************************************************************
// Get Projects and On-Air
// *********************************************************************************************************************
const CUT_OF_DAY = '2016-08-31'; //projects ended before cut_of_day are not returned
exports.getProjectAndOnAir = async projectId => {
    const query = {deleted: null, internal: false, offtime: false, confirmed: true};
    if(projectId) query._id = projectId;
    const jobs = await  BookingWorkType.find({},{type:true}).lean();
    const projects = await BookingProject.find(query, {events: true, label:true, manager: true, supervisor: true, lead2D: true, lead3D:true, leadMP: true, producer: true, onair: true, confirmed: true, invoice: true, budget: true}).populate('events manager supervisor lead2D lead3D leadMP producer').lean();
    const result = projects.map(project => {
        let lastDate = null;
        let lastDate2D = null;
        let lastDate3D = null;
        let totalDuration = 0;
        let totalDuration2D = 0;
        let totalDuration3D = 0;
        project.events.forEach(event => {
            const eventLastDate = moment(event.startDate).add(event.days.length - 1, 'days').startOf('day');
            const eventDuration = event.days.reduce((o, day) => o + day.duration, 0);
            if(!lastDate || eventLastDate.isAfter(lastDate)) lastDate = eventLastDate;
            totalDuration += eventDuration;
            if(jobs[event.job] === '3D') {
                totalDuration3D += eventDuration;
                if(!lastDate3D || eventLastDate.isAfter(lastDate3D)) lastDate3D = eventLastDate;
            }
            if(jobs[event.job] === '2D') {
                totalDuration2D += eventDuration;
                if(!lastDate2D || eventLastDate.isAfter(lastDate2D)) lastDate2D = eventLastDate;
            }
        });
        return {
            id: project._id.toString(),
            label: project.label,
            manager: project.manager ? {id: project.manager._id, ssoId: project.manager.ssoId} : null,
            supervisor: project.supervisor ? {id: project.supervisor._id, ssoId: project.supervisor.ssoId} : null,
            lead2D: project.lead2D ? {id: project.lead2D._id, ssoId: project.lead2D.ssoId} : null,
            lead3D: project.lead3D ? {id: project.lead3D._id, ssoId: project.lead3D.ssoId} : null,
            leadMP: project.leadMP ? {id: project.leadMP._id, ssoId: project.leadMP.ssoId} : null,
            producer: project.producer ? {id: project.producer._id, ssoId: project.producer.ssoId} : null,
            totalDuration: Math.round(totalDuration / 60),
            totalDuration2D: Math.round(totalDuration2D / 60),
            totalDuration3D: Math.round(totalDuration3D / 60),
            lastDate: lastDate ? lastDate.format() : null,
            lastDate2D: lastDate2D ? lastDate2D.format() : null,
            lastDate3D: lastDate3D ? lastDate3D.format() : null,
            onair: project.onair ? project.onair : [],
            invoice: project.invoice ? project.invoice : [],
            confirmed: project.confirmed,
            budget: project.budget
        };
    });
    const cutOfDay = moment(CUT_OF_DAY,'YYYY-MM-DD').startOf('day');
    return result.filter(project => cutOfDay.isBefore(moment(project.lastDate)));
};
// *********************************************************************************************************************
// Add Task
// *********************************************************************************************************************
exports.addTask = async task => {
    const allTasks = await PusherTask.find({},{dataOrigin: true, dataTarget: true, project: true, resolved: true, type: true, timestamp:true}).lean();
    task.conditionsMet = taskHelper.evaluateTaskConditions(task, task.project, (task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir._id ? task.dataOrigin.onAir._id : null), allTasks);
    if(task.type === 'PUBLISH_FACEBOOK' || task.type === 'PUBLISH_WEB') {
        const onairConfirmed = taskHelper.getOnairConfirmedStatus(task.project, task.dataOrigin.onAir._id, allTasks);
        if(onairConfirmed) task.dataOrigin.onAirConfirmed = onairConfirmed;
    }
    if (task && task.target && task.target.role) { // Target by role
        const targets = await exports.getUsersByRole(task.target.role);
        if(targets.length > 0) task.target = targets[0].id; // get first user by role if more of them
    }
    const newTask = await PusherTask.create(task);
    newTask.project = await BookingProject.findOne({_id: newTask.project});
    return await taskHelper.normalizeTask(newTask, await exports.getUsers());
};
// *********************************************************************************************************************
// Update Task
// *********************************************************************************************************************
exports.updateTask = async (id, data) => {
    const task = await PusherTask.findOneAndUpdate({_id: id}, {$set: data}, { new: true });
    if(!task) return new Error(`UpdateTask - Can't find task id: "${id}"`);
    task.project = await BookingProject.findOne({_id: task.project}).lean();
    const normalizedTask = await taskHelper.normalizeTask(task, await exports.getUsers());
    return {updatedTask: normalizedTask, followed: task.followed.filter(t => t.toString() != '000000000000000000000000' && t.toString() != '000000000000000000000001')};
};
// *********************************************************************************************************************
// Remove Task
// *********************************************************************************************************************
exports.removeTask = async id => {
    await PusherTask.findOneAndRemove({_id: id});
};
// *********************************************************************************************************************
// Update Project's On-Air state
// *********************************************************************************************************************
exports.updateProjectOnairState = async (projectId, onairId, state) => {
    const project = await BookingProject.findOne({_id: projectId});
    if(project) {
        const newOnair = [];
        project.onair.forEach(onair => {
            if(onair._id.toString() === onairId.toString() && onair.state !== 'deleted') onair.state = state;
            newOnair.push(onair);
        });
        project.onair = newOnair;
        const updatedProject = await project.save();
        return await dataHelper.normalizeDocument(updatedProject.toJSON());
    } else throw new Error(`updateProjectOnairState:can't find project '${projectId}'`);
};
// *********************************************************************************************************************
// Get Project Team from WorkLogs
// *********************************************************************************************************************
exports.getTeamFromWorkLog = async (projectId, job, me) => {
    me = me ? me.toString() : null;
    if(!Array.isArray(job)) job = [job];
    let jobs = await BookingWorkType.find({},{type:true});
    jobs = jobs.reduce((out, job) => {out[job._id] = job.type; return out}, {});
    const logs = await PusherWorklog.find({project: projectId},{job: true, operatorName: true, operatorSurname: true, operator: true}).lean();
    const teamOut = logs.reduce((team, log) => {
        const operator = log.operatorName + " " + log.operatorSurname;
        if ((log.operator ? log.operator.toString() : '') != me && job.indexOf(jobs[log.job]) >= 0 && team.indexOf(operator) < 0) team.push(operator);
        return team;
    }, []);
    return teamOut.sort();
};
//----------------------------------------------------------------------------------------------------------------------
// ===> WORK REQUEST
//----------------------------------------------------------------------------------------------------------------------
// *********************************************************************************************************************
// Get Open Work Requests
// *********************************************************************************************************************
exports.getOpenWorkRequests = async stageStepMin => { //requests which are ready for next stage
    const requests = await PusherWorkRequest.find({closed: null, stage: {$lt: 4}}).populate('messages user').lean();
    return requests.filter(request => {
        const someFindMe = request.messages.length > 0 ? request.messages.reduce((someFindMe, message) => someFindMe || message.answer.some(item => item === 'find-me'), false) : false;
        const allConfirmedNoStage3 = !someFindMe && request.stage === 3 && request.messages.reduce((allNo, message) => allNo && message.answer.every(item => item === 'no'), true);
        const lastStageAllConfirmedStageLess3 = request.stage <= 2 && (request.messages.length > 0 ? request.messages[request.messages.length - 1].confirmed.every(item => !!item) : true);
        const lastStageTimeoutStageLess3 = request.stage <= 2 && moment(request.stageTime).add(stageStepMin, 'minutes').isBefore(moment());
        return !someFindMe && (allConfirmedNoStage3 || lastStageAllConfirmedStageLess3 || lastStageTimeoutStageLess3);
    }).map(request => ({id: request._id, user: {id: request.user._id, name: request.user.name}, stage: request.stage}));
};
// *********************************************************************************************************************
// GET USER'S LEADS FOR TODAY
// *********************************************************************************************************************
exports.getTodayUserLeads = async userId => { //mongo db _id
    const result = {stage1: [], stage2: [], stage3: []};
    let user = await User.findOne({_id: userId}, {_id: true, resource: true, name: true}).populate({path: 'resource', populate: {path: 'job'}, select: 'job'}).lean();
    if(user && user.resource) {
        user = {id: user._id.toString(), resource: user.resource._id, job: user.resource.job ? user.resource.job.type : null};
        const todayStart = moment.utc().startOf('day').valueOf();
        const todayEnd = moment.utc().endOf('day').valueOf();
        const eventsQuery = {
            $where : `(this.startDate.getTime() <= ${todayEnd}) && ((this.startDate.getTime() + (this.days.length * 24 * 3600000)) > ${todayStart})`,
            external: {$ne: true},
            operator: user.resource,
            offtime: {$ne: true}
        };
        const eventProjectData = await BookingEvent.find(eventsQuery, {project: true}).populate({path: 'project', select: 'deleted lead2D lead3D leadMP supervisor manager producer', match: {deleted: null}}).lean();
        eventProjectData.filter(event => event.project !== null).forEach(event => {
            if((user.job === null || user.job === '2D') && event.project.lead2D && user.id !== event.project.lead2D.toString() && result.stage1.indexOf(event.project.lead2D.toString()) < 0) result.stage1.push(event.project.lead2D.toString());
            if((user.job === null || user.job === '3D') && event.project.lead3D && user.id !== event.project.lead3D.toString() && result.stage1.indexOf(event.project.lead3D.toString()) < 0) result.stage1.push(event.project.lead3D.toString());
            if((user.job === null || user.job === 'MP') && event.project.leadMP && user.id !== event.project.leadMP.toString() && result.stage1.indexOf(event.project.leadMP.toString()) < 0) result.stage1.push(event.project.leadMP.toString());
            if(event.project.manager && user.id !== event.project.manager.toString() && result.stage2.indexOf(event.project.manager.toString()) < 0 && result.stage1.indexOf(event.project.manager.toString()) < 0) result.stage2.push(event.project.manager.toString());
            if(event.project.supervisor && user.id !== event.project.supervisor.toString() && result.stage2.indexOf(event.project.supervisor.toString()) < 0 && result.stage1.indexOf(event.project.supervisor.toString()) < 0) result.stage2.push(event.project.supervisor.toString());
            //if(event.project.producer && user.id !== event.project.producer.toString() && result.stage2.indexOf(event.project.producer.toString()) < 0 && result.stage1.indexOf(event.project.producer.toString()) < 0) result.stage2.push(event.project.producer.toString());
        });
        const managers = await User.find({role: 'booking:manager'}, {_id: true}).lean();
        managers.forEach(manager => {
            if(user.id !== manager._id.toString() && result.stage1.indexOf(manager._id.toString()) < 0 && result.stage2.indexOf(manager._id.toString()) < 0) result.stage3.push(manager._id.toString());
        });
        return result;
    } else throw new Error(`getTodayUserLeads:: ${user ? `User: ${user.name} [${userId}] hasn't defined resource.` : `Can't find user: ${userId}.`}`);
};
// *********************************************************************************************************************
// UPDATE WORK REQUEST BY MESSAGE AND STAGE
// *********************************************************************************************************************
exports.addWorkRequestMessageAndStage = async (id, messageId, stage) => {
    const data = {};
    if(stage) {
        data.stage = stage;
        data.stageTime = Date.now();
    }
    if(messageId) data['$push'] = {messages: messageId};
    await PusherWorkRequest.update({_id: id}, data);
};
//----------------------------------------------------------------------------------------------------------------------
// ===> FREELANCER REMINDER
//----------------------------------------------------------------------------------------------------------------------
// *********************************************************************************************************************
// Get Managers with Freelancers
// *********************************************************************************************************************
exports.getManagersWithFreelancers = async () => {
    const today = moment().startOf('day');
    const events = await BookingEvent.find({offtime: false}, {startDate: true, days: true, project: true, operator: true}).populate({path: 'project', select: 'manager internal deleted'}).populate({path: 'operator', select: 'virtual freelancer confirmed'}).lean();
    const resources = await BookingResource.find({type: 'OPERATOR', $or: [{virtual: true}, {freelancer: true}], confirmed:{$exists: true, $ne: []}}, {confirmed: true}).lean();
    const activeEvents = events.filter(event => {
        if(event.project.internal || event.project.deleted) return false; // no internal or deleted projects
        if(!event.operator || (!event.operator.virtual && !event.operator.freelancer)) return false;// event operator is not freelancer or virtual
        const endDay = moment(event.startDate, 'YYYY-MM-DD').add((event.days.length - 1), 'days').startOf('day');
        if(endDay.diff(today, 'days') < 0) return false; //only event having any day equal today and late
        return true;
    });

    const freelancers = resources.map(resource => {
        return {
            id: resource._id.toString(),
            confirmed: resource.confirmed.map(confirmation => {
                return {
                    from: moment(confirmation.from).startOf('day'),
                    to: moment(confirmation.to).startOf('day')
                }
            })
        }
    });

    const confirmedFreelancers = {};
    const managersWithUnconfirmedFeelancers = [];

    for(const freelancer of freelancers) {
        for(const confirmation of freelancer.confirmed) {
            let from = confirmation.from;
            let to = confirmation.to;
            if(to.diff(today, 'days') >= 0) {
                if(today.diff(from, 'days') >= 0) from = today.clone();
                if(!confirmedFreelancers[freelancer.id]) confirmedFreelancers[freelancer.id] = [];
                const confirmationLength = to.diff(from, 'days') + 1;
                for(let i = 0; i < confirmationLength; i++) {
                    const dayString = from.clone().add(i, 'day').format('YYYY-MM-DD');
                    if(confirmedFreelancers[freelancer.id].indexOf(dayString) < 0) confirmedFreelancers[freelancer.id].push(dayString);
                }
            }
        }
    }

    for(const event of activeEvents) {
        const day = moment(event.startDate, 'YYYY-MM-DD').startOf('day');
        const operatorId = event.operator._id.toString();
        for(let i = 0; i < event.days.length; i++) {
            if(day.diff(today, 'days') >= 0 && event.days[i].duration > 0) { //event day from today and duration > 0
                if (isFreelancerConfirmed(event.operator.confirmed, day)) {
                    if(confirmedFreelancers[operatorId]) {
                        const di = confirmedFreelancers[operatorId].indexOf(day.format('YYYY-MM-DD'));
                        if(di >= 0) confirmedFreelancers[operatorId].splice(di, 1);
                    }
                } else if(event.project.manager) {
                    if(managersWithUnconfirmedFeelancers.indexOf(event.project.manager.toString()) < 0) managersWithUnconfirmedFeelancers.push(event.project.manager.toString());
                }
            }
            day.add(1, 'day');
        }
    }
    const isConfirmedFreelancerWithoutEvent = Object.keys(confirmedFreelancers).reduce((out, id) => out || confirmedFreelancers[id].length > 0, false);
    const hr = isConfirmedFreelancerWithoutEvent ? await getHrNotifyManagers(true) : [];
    return {managers: managersWithUnconfirmedFeelancers, hr: hr};
};

function isFreelancerConfirmed(confirmations, day) {
    if(!day || !confirmations) return false;
    for(const confirmation of confirmations) {
        if(day.diff(moment(confirmation.from).startOf('day'), 'days') >= 0 && moment(confirmation.to).startOf('day').diff(day, 'days') >= 0) {
            return true;
        }
    }
    return false;
}

async function getHrNotifyManagers(outputId) {
    const users = await User.find({role: {$in: ['booking:hr-manager', 'booking:main-manager']}}, {ssoId: true}).lean();
    if(users && users.length > 0) {
        return users.map(user => outputId ? user._id.toString() : user.ssoId);
    } else return [];
}
//----------------------------------------------------------------------------------------------------------------------
// ===> PROJECTS ARCHIVE
//----------------------------------------------------------------------------------------------------------------------
// *********************************************************************************************************************
// Get Process Tasks
// *********************************************************************************************************************
exports.getProcessTasks = async () => {
    return await PusherTask.find({type: 'ARCHIVE_PROCESS', resolved: null}, {project: true, dataOrigin: true, followed: true, origin: true}).populate([{path: 'project', select: 'projectId'}, {path: 'followed', select: 'dataTarget resolved'}]).lean();
};
// *********************************************************************************************************************
// Create Archive Review Task
// *********************************************************************************************************************
exports.createArchiveReviewTask = async (processTask, data) => {
    const newTask = await db.addTask({
        type: 'ARCHIVE_PROCESS_REVIEW',
        project: processTask.project._id,
        target: processTask.origin,
        deadline: moment().add(3, 'days').startOf('day'),
        dataOrigin: data
    });
    if(newTask && newTask.id) await PusherTask.findOneAndUpdate({_id: processTask._id}, {$push: {followed: newTask.id}});
    wamp.publish(newTask.target + '.task', [], newTask);
    return newTask;
};
// *********************************************************************************************************************
// Update Task by Id
// *********************************************************************************************************************
exports.updateArchiveTask = async (id, data) => {
    await PusherTask.finOneAndUpdate({_id: id}, {$set: data});
};
// *********************************************************************************************************************