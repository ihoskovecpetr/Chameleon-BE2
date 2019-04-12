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
        const targets = exports.getUsersByRole(task.target.role);
        if(targets.length > 0) task.target = targets[0].id; // get first user by role if more of them
    }
    const newTask = await PusherTask.create(task);
    newTask.project = await BookingProject.findOne({_id: newTask.project});
    const users = await exports.getUsers();
    return taskHelper.normalizeTask(newTask, users);
};
// *********************************************************************************************************************
// Remove Task
// *********************************************************************************************************************
exports.removeTask = async id => {
    await PusherTask.findByIdAndRemove(id);
};