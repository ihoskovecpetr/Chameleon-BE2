'use strict';

const mongoose = require('mongoose');
const dataHelper = require('../../_common/lib/dataHelper');
const dateHelper = require('../../_common/lib/dateHelper');
const taskHelper = require('../../_common/lib/taskHelper');
const moment = require('moment');

//Collections
const BookingProject = require('../../_common/models/booking-project');
const Project = require('../../_common/models/project');
const BookingResource = require('../../_common/models/booking-resource');
const BookingWorkType = require('../../_common/models/booking-work-type');
const User = require('../../_common/models/user');
const BookingEvent = require('../../_common/models/booking-event');
//const BookingOplog = require('../../_common/models/booking-oplog');
const PusherWorklog = require('../../_common/models/pusher-worklog');
const PusherTask = require('../../_common/models/pusher-task');
const PusherMessage = require('../../_common/models/pusher-message');
const PusherWorkRequest = require('../../_common/models/pusher-work-request');
const BookingGroup = require('../../_common/models/booking-group');
const Holiday = require('../../_common/models/holiday');

const projectToBooking = require('../../_common/lib/projectToBooking');

//const logger = require('../logger');

exports = module.exports;

// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
//exports.logOp = async (type, user, data, err) => {
//    await BookingOplog.create({type: type, user: user, data: data, success: !err, reason: err});
//};

//----------------------------------------------------------------------------------------------------------------------
// ===>  K2
//----------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// Get K2 linked projects //TODO xBPx
// *********************************************************************************************************************
exports.getK2linkedProjects = async projectId => {
    let query = {deleted: null, mergedToProject: null, $and: [{K2rid : {$ne: null}}, {K2rid: {$ne: '0'}}]};
    if(projectId) query._id = projectId;
    const bookingProjects =  await BookingProject.find(query, {__v:false, 'jobs.__v':false, 'jobs._id':false, 'timing.__v':false, 'timing._id':false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v':false, deleted:false }).lean();
    if(projectId && bookingProjects.length > 0) {
        return bookingProjects;
    } else {
        query = {deleted: null, booking: true, K2: {$ne: null}, $and: [{'K2.rid': {$ne: null}}, {'K2.rid': {$ne: '0'}}]};
        if(projectId) query._id = projectId;
        const projects = await Project.find(query, {_id: true, name: true, team: true, budget: true, K2: true, onair: true, invoice: true, timing: true, bookingType: true, events: true, work: true, bookingNote: true, kickBack: true, created: true}).lean();
        return bookingProjects.concat(projects.map(projectToBooking));
    }
};

// *********************************************************************************************************************
// Get Resource map
// *********************************************************************************************************************
exports.getResourcesMap = async () => {
    //const resources = await BookingResource.find({type: 'OPERATOR', K2id: {$ne: null}}, 'K2id job').lean();
    //const resources = await BookingResource.find({type: 'OPERATOR', K2id: {$ne: null}, deleted: false, disabled: false}, 'K2id job').lean();
    const resources  = await BookingResource.find({type: 'OPERATOR', $and : [{K2id: {$ne: null}}, {K2id: {$ne: '.'}}], deleted: false}).lean();
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
// Update booking project //TODO xBPx
// *********************************************************************************************************************
exports.updateProject = async (id, project) => {
    if(project.version && project.version === 2) {
        const projectData = await Project.findOne({_id: id});
        if(projectData) {
            if(project.label !== undefined) projectData.name = project.label;
            if(project.jobs !== undefined) projectData.work = project.jobs.map(job => ({type: job.job, plannedDuration: job.plannedDuration, doneDuration: job.doneDuration}));
            if(project.timing !== undefined) projectData.timing = project.timing.map(t => ({type: t.type, text: t.label, date: t.date, dateTo: t.dateTo, category: t.category}));
            if(project.onair !== undefined) projectData.onair = project.onair;
            if(project.invoice !== undefined) projectData.invoice = project.invoice;
            if(project.bookingNotes !== undefined) projectData.bookingNote = project.bookingNotes;
            await projectData.save();
        }
    } else {
        await BookingProject.findOneAndUpdate({_id: id}, {$set: project});
    }
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
// Update Tasks ConditionsMet //TODO xBPx
// *********************************************************************************************************************
exports.updateTasksConditionsMet = async () => {
    const users = await  exports.getUsers();
    const allTasks = await PusherTask.find({},{dataOrigin: true, dataTarget: true, project: true, resolved: true, type: true, timestamp:true}).lean();
    const tasks = await PusherTask.find({resolved: null, "conditions.0" : { "$exists": true }},{__v: false, resolved: false, dataTarget: false}).lean(); //all not resolved tasks with some conditions
    //populate project not necessary
    const changedTasks = tasks.filter(task => task.project == "5d80aca08c8eace2d7866785")//tasks.filter(task => taskHelper.evaluateTaskConditions(task, task.project ? task.project : null, (task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir._id ? task.dataOrigin.onAir._id : null), allTasks) !== task.conditionsMet); // tasks with conditionsMet has been changed
    const updatedTasks = await Promise.all(changedTasks.map(task => PusherTask.findOneAndUpdate({_id: task._id}, {$set: {conditionsMet: !task.conditionsMet}}, { new: true })));
    return await Promise.all(updatedTasks.map(task => taskHelper.normalizeTask(task, users))); //task should have populated project ????????
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
// Get Projects With Shoot Events //TODO xBPx
// *********************************************************************************************************************
exports.getProjectsWithShootEvent = async () => {
    const bookingProjects = await BookingProject.find({deleted: null, mergedToProject: null, offtime: false, external: false, confirmed: true},{events: true, label: true, manager: true, supervisor: true}).lean().populate('events');
    const projects = await Project.find({deleted: null, booking: true, bookingType: 'CONFIRMED'}, {events: true, name: true, team: true}).lean().populate('events');
    const users = await exports.getUsers();
    const today = moment().startOf('day');
    return bookingProjects.concat(projects.map(projectToBooking)).reduce((out, project) => {
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
// Get Projects and On-Air //TODO xBPx
// *********************************************************************************************************************
const CUT_OF_DAY = '2016-08-31'; //projects ended before cut_of_day are not returned
exports.getProjectAndOnAir = async projectId => {
    let query = {deleted: null, mergedToProject: null, internal: false, offtime: false, confirmed: true};
    if(projectId) query._id = projectId;
    const bookingProjects = await BookingProject.find(query, {events: true, label:true, manager: true, supervisor: true, lead2D: true, lead3D:true, leadMP: true, producer: true, onair: true, confirmed: true, invoice: true, budget: true}).lean().populate('events');
    query = {deleted: null, booking: true, bookingType: 'CONFIRMED'};
    if(projectId) query._id = projectId;
    const projects = await Project.find(query, {events: true, name: true, team: true, onair: true, bookingType: true, invoice: true, budget: true}, {}).lean().populate('events');
    const users = await exports.getUsers();
    const jobs = await  BookingWorkType.find({},{type:true}).lean();
    const result = bookingProjects.concat(projects.map(projectToBooking)).map(project => {
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

            manager: project.manager && users[project.manager] ? {id: project.manager, ssoId: users[project.manager].ssoId} : null,
            supervisor: project.supervisor && users[project.supervisor] ? {id: project.supervisor, ssoId: users[project.supervisor].ssoId} : null,
            lead2D: project.lead2D && users[project.lead2D] ? {id: project.lead2D, ssoId: users[project.lead2D].ssoId} : null,
            lead3D: project.lead3D && users[project.lead3D] ? {id: project.lead3D, ssoId: users[project.lead3D].ssoId} : null,
            leadMP: project.leadMP && users[project.leadMP] ? {id: project.leadMP, ssoId: users[project.leadMP].ssoId} : null,
            producer: project.producer && users[project.producer] ? {id: project.producer, ssoId: users[project.producer].ssoId} : null,

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
// Add Task //TODO xBPx
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
    //if not found in booking-projects, so try to find it in projects
    //newTask.project = await BookingProject.findOne({_id: newTask.project}).lean() || projectToBooking(await Project.findOne({_id: newTask.project}).lean());
    return await taskHelper.normalizeTask(newTask, await exports.getUsers());
};
// *********************************************************************************************************************
// Update Task //TODO xBPx
// *********************************************************************************************************************
exports.updateTask = async (id, data) => {
    const task = await PusherTask.findOneAndUpdate({_id: id}, {$set: data}, { new: true });
    if(!task) return new Error(`UpdateTask - Can't find task id: "${id}"`);
    //if not found in booking-projects, so try to find it in projects
    //task.project = await BookingProject.findOne({_id: task.project}).lean() || projectToBooking(await Project.findOne({_id: task.project}).lean());
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
// Update Project's On-Air state //TODO xBPx
// *********************************************************************************************************************
exports.updateProjectOnairState = async (projectId, onairId, state) => {
    const project = await BookingProject.findOne({_id: projectId}) || await Project.findOne({_id: projectId});
    if(project) {
        const newOnair = [];
        project.onair.forEach(onair => {
            if(onair._id.toString() === onairId.toString() && onair.state !== 'deleted') onair.state = state;
            newOnair.push(onair);
        });
        project.onair = newOnair;
        const updatedProject = await project.save();
        // if project is doc of project instead of booking-project
        return await dataHelper.normalizeDocument(project.projectId === undefined ? updatedProject : projectToBooking(updatedProject));
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
    const requests = await PusherWorkRequest.find({closed: null, stage: {$lt: 4}}).lean().populate('messages user');
    return requests.filter(request => {
        const someFindMe = request.messages.length > 0 ? request.messages.reduce((someFindMe, message) => someFindMe || message.answer.some(item => item === 'find-me'), false) : false;
        const allConfirmedNoStage3 = !someFindMe && request.stage === 3 && request.messages.reduce((allNo, message) => allNo && message.answer.every(item => item === 'no'), true);
        const lastStageAllConfirmedStageLess3 = request.stage <= 2 && (request.messages.length > 0 ? request.messages[request.messages.length - 1].confirmed.every(item => !!item) : true);
        const lastStageTimeoutStageLess3 = request.stage <= 2 && moment(request.stageTime).add(stageStepMin, 'minutes').isBefore(moment());
        return !someFindMe && (allConfirmedNoStage3 || lastStageAllConfirmedStageLess3 || lastStageTimeoutStageLess3);
    }).map(request => ({id: request._id, user: {id: request.user._id, name: request.user.name}, stage: request.stage}));
};
// *********************************************************************************************************************
// GET USER'S LEADS FOR TODAY //TODO xBPx
// *********************************************************************************************************************
exports.getTodayUserLeads = async userId => { //mongo db _id
    const result = {stage1: [], stage2: [], stage3: []};
    let user = await User.findOne({_id: userId}, {_id: true, resource: true, name: true}).lean().populate({path: 'resource', populate: {path: 'job'}, select: 'job'});
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
        const eventProjectData = await BookingEvent.find(eventsQuery, {project: true}).lean();

        const projectIds = eventProjectData.map(event => event.project);
        const projects1 = await BookingProject.find({_id: {$in: projectIds}, deleted: null, mergedToProject: null}, 'manager producer supervisor lead2D lead3D leadMP').lean();
        const projects2 = (await Project.find({_id: {$in: projectIds}, deleted: null, booking: true}, 'team').lean()).map(project => projectToBooking(project, true));
        const projectsMap = projects1.concat(projects2).reduce((map, project) => {map[project._id.toString()] = project; return map}, {});
        eventProjectData.filter(event => projectsMap[event.project] !== undefined).forEach(event => {
            if((user.job === null || user.job === '2D') && projectsMap[event.project].lead2D && user.id !== projectsMap[event.project].lead2D.toString() && result.stage1.indexOf(projectsMap[event.project].lead2D.toString()) < 0) result.stage1.push(projectsMap[event.project].lead2D.toString());
            if((user.job === null || user.job === '3D') && projectsMap[event.project].lead3D && user.id !== projectsMap[event.project].lead3D.toString() && result.stage1.indexOf(projectsMap[event.project].lead3D.toString()) < 0) result.stage1.push(projectsMap[event.project].lead3D.toString());
            if((user.job === null || user.job === 'MP') && projectsMap[event.project].leadMP && user.id !== projectsMap[event.project].leadMP.toString() && result.stage1.indexOf(projectsMap[event.project].leadMP.toString()) < 0) result.stage1.push(projectsMap[event.project].leadMP.toString());
            if(projectsMap[event.project].manager && user.id !== projectsMap[event.project].manager.toString() && result.stage2.indexOf(projectsMap[event.project].manager.toString()) < 0 && result.stage1.indexOf(projectsMap[event.project].manager.toString()) < 0) result.stage2.push(projectsMap[event.project].manager.toString());
            if(projectsMap[event.project].supervisor && user.id !== projectsMap[event.project].supervisor.toString() && result.stage2.indexOf(projectsMap[event.project].supervisor.toString()) < 0 && result.stage1.indexOf(projectsMap[event.project].supervisor.toString()) < 0) result.stage2.push(projectsMap[event.project].supervisor.toString());
            //if(projectsMap[event.project].producer && user.id !== projectsMap[event.project].producer.toString() && result.stage2.indexOf(projectsMap[event.project].producer.toString()) < 0 && result.stage1.indexOf(projectsMap[event.project].producer.toString()) < 0) result.stage2.push(projectsMap[event.project].producer.toString());
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
// Get Managers with Freelancers //TODO xBPx
// *********************************************************************************************************************
exports.getManagersWithFreelancers = async () => {
    const today = moment().startOf('day');
    const events = await BookingEvent.find({offtime: false}, {startDate: true, days: true, project: true, operator: true}).lean().populate({path: 'operator', select: 'virtual freelancer confirmed'});

    const projectIds = events.map(event => event.project);
    const projects1 = await BookingProject.find({_id: {$in: projectIds}, deleted: null, mergedToProject: null}, 'manager internal rnd').lean();
    const projects2 = (await Project.find({_id: {$in: projectIds}, deleted: null, booking: true}, 'team bookingType').lean()).map(project => projectToBooking(project, true));
    const projectsMap = projects1.concat(projects2).reduce((map, project) => {map[project._id.toString()] = project; return map}, {});

    const resources = await BookingResource.find({type: 'OPERATOR', $or: [{virtual: true}, {freelancer: true}], confirmed:{$exists: true, $ne: []}}, {confirmed: true}).lean();
    const activeEvents = events.filter(event => {
        if(!projectsMap[event.project] || projectsMap[event.project].internal || projectsMap[event.project].rnd || projectsMap[event.project].deleted) return false; // no internal, r&d or deleted projects
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
    const managersWithUnconfirmedFreelancers = [];

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
                    if(dateHelper.isWorkingDay(dayString) && confirmedFreelancers[freelancer.id].indexOf(dayString) < 0) confirmedFreelancers[freelancer.id].push(dayString);
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
                } else if(projectsMap[event.project] && projectsMap[event.project].manager) {
                    if(managersWithUnconfirmedFreelancers.indexOf(projectsMap[event.project].manager.toString()) < 0) managersWithUnconfirmedFreelancers.push(projectsMap[event.project].manager.toString());
                }
            }
            day.add(1, 'day');
        }
    }
    const isConfirmedFreelancerWithoutEvent = Object.keys(confirmedFreelancers).reduce((out, id) => out || confirmedFreelancers[id].length > 0, false);
    const hr = isConfirmedFreelancerWithoutEvent ? await getHrNotifyManagers(true) : [];
    return {managers: managersWithUnconfirmedFreelancers, hr: hr};
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
// Get Process Tasks //TODO xBPx
// *********************************************************************************************************************
exports.getProcessTasks = async () => {
    const tasks =  await PusherTask.find({type: 'ARCHIVE_PROCESS', resolved: null}, {project: true, dataOrigin: true, followed: true, origin: true}).lean().populate({path: 'followed', select: 'dataTarget resolved'});
    const projectIds = tasks.map(event => event.project);
    const projects1 = await BookingProject.find({_id: {$in: projectIds}, deleted: null, mergedToProject: null}, 'K2projectId').lean();
    const projects2 = (await Project.find({_id: {$in: projectIds}, deleted: null, booking: true}, 'K2').lean()).map(project => projectToBooking(project, true));
    const projectsMap = projects1.concat(projects2).reduce((map, project) => {map[project._id.toString()] = project; return map}, {});
    for(const task of tasks) if(task.project && projectsMap[task.project] && projectsMap[task.project].K2projectId) task.project = {_id: task.project, K2projectId: projectsMap[task.project].K2projectId};
    console.log(tasks)
    return tasks;
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

//----------------------------------------------------------------------------------------------------------------------
// ===> MAINTENANCE
//----------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// Set Archive Flag (Project/events) //TODO xBPx
// *********************************************************************************************************************
exports.setArchiveFlag = async age => {
    const result = {project: 0, event: 0};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestDayToArchive = new Date(today.getTime() - (age * 24 * 60 * 60 * 1000));
    const bookingProjects = await BookingProject.find({archived: false, mergedToProject: null, deleted: null}).lean();
    const projects = await Project.find({deleted: null, booking: true, archived: false}).lean();
    for(const project of bookingProjects.concat(projects.map(projectToBooking))) {
        const projectEvents = await BookingEvent.find({project: project._id, archived: false}, {_id: true, startDate: true, days: true}).lean();
        let latestProjectDay = 0;
        for(const event of projectEvents) {
            const eventStartDate = new Date(event.startDate);
            const eventLastDay = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate() + (event.days && event.days.length > 0 ? event.days.length - 1 : 0), 0, 0, 0, 0);
            if (eventLastDay - latestProjectDay > 0) latestProjectDay = eventLastDay;
            if (project.offtime && latestDayToArchive - eventLastDay > 0) {
                await BookingEvent.updateOne({_id: event._id}, {$set: {archived: true}});
                result.event += 1;
            }
        }
        if(!project.offtime && latestDayToArchive - latestProjectDay > 0 && latestProjectDay > 0) {
            if(project.version && project.version === 2) await Project.updateOne({_id: project._id}, {$set: {archived: true}});
            else await BookingProject.updateOne({_id: project._id}, {$set: {archived: true}});
            result.project += 1;
        }
    }
    return result;
};

//----------------------------------------------------------------------------------------------------------------------
// ===> BACKUP
//----------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// Get ResourceGroups
// *********************************************************************************************************************
exports.getResourceGroups = async () => {
    const groups = await BookingGroup.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(groups);
};

// *********************************************************************************************************************
// Get Resources
// *********************************************************************************************************************
exports.getResources = async () => {
    const resources = await BookingResource.find({},{__v:false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(resources);
};

// *********************************************************************************************************************
// Get Holidays
// *********************************************************************************************************************
exports.getHolidays = async () => {
    const holidays = await Holiday.find().lean();
    return holidays.length > 0 ? holidays[0].days : holidays
};

// *********************************************************************************************************************
// Get Projects //TODO xBPx
// *********************************************************************************************************************
exports.getProjects = async () => {
    //const projects = await BookingProject.find({deleted: null, archived: false},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false }).lean();
    //return dataHelper.getObjectOfNormalizedDocs(projects);
    const bookingProjects = await BookingProject.find({deleted: null, archived: false, mergedToProject: null},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false, checked: false, mergedToProject: false }).lean();
    const projects = await Project.find({deleted: null, archived: null, booking: true}, {_id: true, name: true, team: true, budget: true, K2: true, onair: true, invoice: true, timing: true, bookingType: true, events: true, work: true, bookingNote: true, kickBack: true, created: true}).lean();
    return dataHelper.getObjectOfNormalizedDocs(bookingProjects.concat(projects.map(projectToBooking)));
};

// *********************************************************************************************************************
// Get Events //TODO xBPx
// *********************************************************************************************************************
exports.getEvents = async () => {
    //const projects = await BookingProject.find({deleted: null, archived: false}, {_id: true}).lean();
    //const projectIds = projects.map(project => project._id);
    //const events = await BookingEvent.find({project: {$in: projectIds}, archived: false},{__v: false, 'days.__v': false, 'days._id': false, archived: false}).lean();
    //return dataHelper.getObjectOfNormalizedDocs(events);

    const bookingProjects = await BookingProject.find({deleted: null, archived: false, mergedToProject: null}, {_id: true}).lean();
    const bookingProjectIds = bookingProjects.map(bookingProject => bookingProject._id);

    const projects = await Project.find({deleted: null, archived: null, booking: true}, {_id: true, bookingId: true}).lean();
    const projectsIds = projects.map(project => project._id);

    const events = await BookingEvent.find({project: {$in: bookingProjectIds.concat(projectsIds)}, archived: false},{__v: false, 'days.__v': false, 'days._id': false, archived: false}).lean();
    return  dataHelper.getObjectOfNormalizedDocs(events);
};

// *********************************************************************************************************************
// Get Jobs
// *********************************************************************************************************************
exports.getJobs = async () => {
    const jobs = await BookingWorkType.find({bookable: true},{__v: false, K2ids: false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(jobs);
};
// *********************************************************************************************************************