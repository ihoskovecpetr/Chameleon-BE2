'use strict';

const mongoose = require('mongoose');
const moment = require('moment');
//const logger = require('../logger');
const dataHelper = require('../lib/dataHelper');
const dateHelper = require('../lib/dateHelper');
const taskHelper = require('../lib/taskHelper');
const followTask = require('../lib/followTask');

//Collections
const PusherWorklog = require('../models/pusher-worklog');
const User = require('../models/user');
const BookingResource = require('../models/booking-resource');
const PusherWorkclock = require('../models/pusher-workclock');
const PusherWorkclockNotify = require('../models/pusher-workclock-notify');
const PusherWorkRequest = require('../models/pusher-work-request');
const PusherTask = require('../models/pusher-task');
const PusherMessage = require('../models/pusher-message');
const BookingProject = require('../models/booking-project');
const BookingEvent = require('../models/booking-event');
const PusherGroup = require('../models/pusher-group');
const Budget = require('../models/budget');
require('../models/booking-project');
require('../models/booking-work-type');
require('../models/budget-item');

const logger = require('../logger');

const PUSHER_BOOKING_TIME_SPAN = 7; //number of days, where the pusher is looking for next day items to show real next active day, otherwise shows tomorrow (empty)
exports.getPusherBookingTimeSpan = () => PUSHER_BOOKING_TIME_SPAN;
// ---------------------------------------------------------------------------------------------------------------------
//    T A S K S
// ---------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// GET TASK BY ID
// *********************************************************************************************************************
exports.getTaskById = async id => {
    const task = await PusherTask.findOne({_id: id}).populate('project').lean();
    return taskHelper.normalizeTask(task, await getUsers());
};
// *********************************************************************************************************************
// GET TASKS FOR USER
// *********************************************************************************************************************
exports.getTasksForUser = async user => {
    const userData = await User.findOne({ssoId: user}, {_id: true}).lean();
    if(userData) {
        const users = await getUsers(); //for normalization
        const allTasks = await PusherTask.find({},{dataOrigin: true, dataTarget: true, project: true, resolved: true, type: true, timestamp:true}).lean(); //for conditions
        const userTasks = await PusherTask.find({target: userData._id, resolved: null},{__v: false, resolved: false, dataTarget: false}).populate('project');
        for(const task of userTasks) { //update conditionsMet
            const currentConditionsMet = taskHelper.evaluateTaskConditions(task, task.project ? task.project._id : null, (task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir._id ? task.dataOrigin.onAir._id : null), allTasks);
            if(task.conditionsMet !== currentConditionsMet) {
                task.conditionsMet = currentConditionsMet;
                await task.save();
            }
        }
        const activeTasks =  userTasks.filter(task => task.conditionsMet);
        return await Promise.all(activeTasks.map(task => taskHelper.normalizeTask(task, users)));
    } else throw new Error(`Can't find user ${user}`);
};
// *********************************************************************************************************************
// GET TASKS FOR THE PROJECT OR ALL
// *********************************************************************************************************************
exports.getTasks = async project => {
        const tasks = await PusherTask.find(project ? {project: project} : {}, {target: true, project: true, dataTarget: true, dataOrigin: true, resolved: true, type: true, followed: true, timestamp: true}).lean();
        return tasks.map(task => {
            return {
                id: task._id.toString(),
                type: task.type,
                target: task.target,
                project: task.project ? task.project.toString() : null,
                dataOrigin: task.dataOrigin,
                dataTarget: task.dataTarget,
                resolved: task.resolved,
                followed: task.followed,
                timestamp: task.timestamp,
            }
        })
};
// *********************************************************************************************************************
// GET EVENTS FOR PROJECTS
// *********************************************************************************************************************
exports.getEventsForProject = async id => {
    return await BookingEvent.find({project: id}, {startDate: true, days: true, operator: true, virtualOperator: true}).lean();
};
// *********************************************************************************************************************
// GET USERS BY ROLE
// *********************************************************************************************************************
exports.getUsersByRole = async role => {
    if(!role) throw new Error('GetUsersByRole - No role is specified!');
    const query = Array.isArray(role) ? {$or : role.map(r => {return {role: r}})} : {role: role};
    const users = await User.find(query).lean();
    return users.map(user => {return {id: user._id.toString(), label: user.name}}).sort((a,b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
};
// *********************************************************************************************************************
// POSTPONE TASK
// *********************************************************************************************************************
exports.postponeTask = async (id, days) => {
    return await PusherTask.findOneAndUpdate({_id: id}, {$inc: {postpone: days}}, {new : true});
};
// *********************************************************************************************************************
// COMPLETE TASK
// *********************************************************************************************************************
exports.completeTask = async (id, data) => {
    const task = await PusherTask.findOne({_id: id});
    if(data) task.dataTarget = data;
    task.resolved = Date.now();
    let tasks = [task];
    await task.save();
    if(task.type === 'ONAIR_CONFIRM' && data && data.confirmed) {
        const publishTasks = await PusherTask.find({project: task.project, resolved: null, type: {$in: ['PUBLISH_FACEBOOK', 'PUBLISH_WEB']}, "dataOrigin.onAir._id": mongoose.Types.ObjectId(task.dataOrigin.onAir._id)}).populate('project');
        tasks = publishTasks.map(task => {task.dataOrigin.onAirConfirmed = true; return task});
        for(const t of tasks) {
            t.markModified('dataOrigin.onAirConfirmed');
            await t.save();
        }
    }
    if(task.type === 'ARCHIVE_2D_BIG' || task.type === 'ARCHIVE_3D_BIG' || task.type === 'ARCHIVE_MP_BIG') {
        const work = task.type.substr(8, 2);
        const archive1Tasks = await  PusherTask.find({project: task.project, resolved: null, type: {$in: [`ARCHIVE_${work}_OPERATOR`, `ARCHIVE_${work}_LEAD`]}, target: task.origin}).populate('project').lean();
        tasks = tasks.concat(archive1Tasks);
    }
    if(task.type === 'ARCHIVE_2D_OPERATOR' || task.type === 'ARCHIVE_MP_OPERATOR') {
        const work = task.type.substr(8, 2);
        const archive2Tasks = await PusherTask.find({project: task.project, resolved: null, type: `ARCHIVE_${work}_LEAD`, target: task.origin}).populate('project').lean();
        tasks = tasks.concat(archive2Tasks);
    }
    const users = await getUsers();
    return await Promise.all(tasks.map(task => taskHelper.normalizeTask(task, users)));
};
// *********************************************************************************************************************
// FOLLOW TASK COMPLETED
// *********************************************************************************************************************
exports.followTaskCompleted = async id => {
    const result = {tasks: [], messages: [], updateProjects: []};
    const task = await PusherTask.findOne({_id: id}).populate('project target');
    task.followed = [];
    const followers = followTask(task);
    if(followers.tasks) {
        for(const followedTask of followers.tasks) {
            const newTask = await exports.addTask(followedTask);
            task.followed.push(newTask.id);
            result.tasks.push(newTask);
        }
    }
    if(followers.messages) {
        for(const [i, followedMessage] of followers.messages.entries()) {
            const newMessage = await exports.addMessage(followedMessage);
            if(i === 0) task.followed.push('000000000000000000000001');
            result.messages = result.messages.concat(newMessage);
        }
    }
    if(followers.commands) {
        for(const followedCommand of followers.commands) {
            if(followedCommand.command === 'updateOnairState') {
                const project = await updateProjectOnairState(followedCommand.project, followedCommand.onair, followedCommand.state);
                if(project) result.updateProjects.push(project);
            } else if(followedCommand.command === 'deleteOnair') {
                const project = await deleteOnair(followedCommand.project, followedCommand.onair);
                if(project) result.updateProjects.push(project);
            }
        }
    }
    if(task.followed.length === 0) task.followed = ['000000000000000000000000'];
    await task.save();
    return result;
};
// *********************************************************************************************************************
// ADD TASK
// *********************************************************************************************************************
exports.addTask = async task => {
    const allTasks = await PusherTask.find({},{dataOrigin: true, dataTarget: true, project: true, resolved: true, type: true, timestamp:true}).lean(); //for conditions and onair status
    task.conditionsMet = taskHelper.evaluateTaskConditions(task, task.project, (task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir._id ? task.dataOrigin.onAir._id : null), allTasks);
    if(task.type === 'PUBLISH_FACEBOOK' || task.type === 'PUBLISH_WEB') {
        const onairConfirmed = task.getOnairConfirmedStatus(task.project, task.dataOrigin.onAir._id, allTasks);
        if(onairConfirmed !== null) task.dataOrigin.onAirConfirmed = onairConfirmed;
    }
    if(task && task.target && task.target.role) { // Target by role
        const users = await exports.getUsersByRole(task.target.role);
        if(users.length > 0) {
            task.target = users[0].id; // get first user by role if more of them
        } else throw new Error("Add task. Can\'t find any user for the role: " + task.target.role)
    }
    task = await PusherTask.create(task);
    task.project = await BookingProject.findOne({_id: task.project});
    return taskHelper.normalizeTask(task, await getUsers());
};
// *********************************************************************************************************************
// UPDATE TASK
// *********************************************************************************************************************
exports.updateTask = async (id, data) => {
    const task = await PusherTask.findOneAndUpdate({_id: id}, {$set: data}, {new: true});
    if(task) {
        task.project = await BookingProject.findOne({_id: task.project});
        return {updatedTask: taskHelper.normalizeTask(task, await getUsers()), followed: task.followed.filter(t => t.toString() != '000000000000000000000000' && t.toString() != '000000000000000000000001')};
    } else throw new Error(`UpdateTask - Can't find task id: "${id}"`);
};
// *********************************************************************************************************************
// FORWARD TASK
// *********************************************************************************************************************
exports.forwardTask = async (id, targetId) => {
    const task = await PusherTask.findOneAndUpdate({_id: id}, {target: targetId}, { new: true });
    if(task) {
        task.project = await BookingProject.findOne({_id: task.project});
        return await taskHelper.normalizeTask(task, await getUsers());
    } else throw new Error(`ForwardTask - Can't find task id: ${id}`);
};
// *********************************************************************************************************************
// CREATE OR MODIFY SUB-TASK
// *********************************************************************************************************************
exports.createOrModifySubTask = async data => { //data.status - create new - true, kind - required action
    const masterTask = await PusherTask.findOne({_id: data.task}).lean();
    if(masterTask) {
        const type = masterTask.type === 'ARCHIVE_2D_LEAD' ? 'ARCHIVE_2D_OPERATOR' : 'ARCHIVE_MP_OPERATOR';
        if (data.status) { //Create new task resolved or not depends on data.kind
            return await exports.addTask({
                project: masterTask.project,
                type: type,
                origin: masterTask.target,
                target: data.target,
                deadline: moment().add(3, 'days').startOf('day'),

                resolved: data.kind === 'done' ? moment() : null,
                followed: data.kind === 'done' ? ['000000000000000000000000'] : undefined,
                dataTarget: data.kind === 'done' ? {bigArchive: false, resolvedByLead: true} : null
            });
        } else { //update/resolve existing task
            const originalTask = await PusherTask.findOne({type: type, project: masterTask.project, target: data.target, resolved: null}).lean();
            if (originalTask) {
                const task = await exports.updateTask(originalTask._id, {
                    resolved: moment(),
                    followed: ['000000000000000000000000'],
                    dataTarget: {bigArchive: false, resolvedByLead: true}
                });
                return task.updatedTask;
            }
            else return null;
        }
    } else throw new Error(`Can't find master task id: ${data.task}`);
};
// *********************************************************************************************************************
// CREATE BIG ARCHIVE TASK
// *********************************************************************************************************************
exports.createBigArchiveTask = async (taskId, work) => {
    const task = await PusherTask.findOne({_id: taskId});
    if(task) {
        const bigTask = await exports.addTask({
            project: task.project,
            type: `ARCHIVE_${work}_BIG`,
            origin: task.target,
            target: {role: `booking:tech-lead${work}`},
            deadline: moment().startOf('day')
        });
        let parentTask = null;
        if(task.origin) {
            const parent = await PusherTask.findOne({type: `ARCHIVE_${work}_LEAD`, project: task.project, target: task.origin, resolved: null}).populate('project').lean();
            if(parent) parentTask = await taskHelper.normalizeTask(parent, await getUsers());
        }
        return {bigTask: bigTask, parentTask: parentTask}
    } else {
        throw new Error(`Can't find task id: ${taskId}`);
    }
};
// *********************************************************************************************************************
// CREATE FREELANCER TASK
// *********************************************************************************************************************
exports.createFreelancerTask = async data => {
    if(data) {
        const project = await BookingProject.findOne({_id: data.project}, {label: true, manager: true}).populate({path: 'manager', select: 'name'}).lean();
        if(!project) throw new Error(`No project '${data.project}' found.`);
        const freelancer = await BookingResource.findOne({_id: data.freelancer}, {label: true, virtual: true, freelancer: true, confirmed: true}).lean();
        if(!freelancer) throw new Error(`No freelancer '${data.freelancer}' found.`);
        if(!freelancer.virtual && !freelancer.freelancer) throw new Error(`Resource '${freelancer.label}' is not set as freelancer.`);
        const from = Array.isArray(data.date) ? data.date[0] : data.date;
        const to = Array.isArray(data.date) ? data.date[1] : data.date;
        const taskKey = `${data.project}:${data.freelancer}:${from}:${to}:${data.type === 'ask' ? 0 : 1}`;
        const tasks = await PusherTask.find({type: data.type === 'ask' ? 'FREELANCER_REQUEST' : 'FREELANCER_CONFIRM', 'dataOrigin.key': taskKey, resolved: null}, {_id: true}).lean();
        if(tasks.length === 0) {
            const task = await exports.addTask({
                project: data.project,
                type: data.type === 'ask' ? 'FREELANCER_REQUEST' : 'FREELANCER_CONFIRM',
                origin: project.manager._id,
                target: {role: 'booking:hr-manager'},
                deadline: moment().startOf('day'),
                dataOrigin: {key: taskKey, manager: project.manager.name, freelancer: {label: freelancer.label, remote: freelancer.virtual, dates: {from: from, to: to}}}
            });
            delete task.valid;
            return task;
        }
    }
};
// *********************************************************************************************************************
// SET ARCHIVE CHECK-STATUS
// *********************************************************************************************************************
exports.setArchiveCheckItemStatus = async data => {
    const task = await PusherTask.findOne({_id: data.task});
    if(task) {
        if(data.status > 0 || (task.dataOrigin && task.dataOrigin.checkList && task.dataOrigin.checkList[data.name])) {
            if (!task.dataOrigin) task.dataOrigin = {};
            if (!task.dataOrigin.checkList) task.dataOrigin.checkList = {};
            if (data.status > 0) task.dataOrigin.checkList[data.name] = data.status;
            else delete task.dataOrigin.checkList[data.name];
            task.markModified('dataOrigin');
            await task.save();
            return await exports.getTaskById(data.task);
        }
    } else throw new Error(`Can't find task id: ${data.task}`);
};
// ---------------------------------------------------------------------------------------------------------------------
//    M E S S A G E S  +  C R E A T E
// ---------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// GET MESSAGES FOR USER
// *********************************************************************************************************************
exports.getMessagesForUser = async user => {
    const userData = await User.findOne({ssoId: user}, {_id: true}).lean();
    if(userData) {
        const users = await getUsers(); //for normalization
        const userMessages = await PusherMessage.find({target: userData._id}, {__v: false}).lean();
        const activeMessages = userMessages.filter(message => {
            const targetIndex = message.target.reduce((targetIndex, target, index) => target.toString() == userData._id.toString() ? index : targetIndex, -1);
            return targetIndex >= 0 && message.confirmed[targetIndex] === null;
        });
        return await Promise.all(activeMessages.map(message => taskHelper.normalizeMessage(message, users, userData._id)));
    } else throw new Error(`Can't find user ${user}`);
};
// *********************************************************************************************************************
// POSTPONE MESSAGE
// *********************************************************************************************************************
exports.postponeMessage = async (id, days, user) => {
    const userIds = await exports.getUserBySsoId(user);
    const message = await PusherMessage.findOne({_id: id});
    if(message) {
        const targetIndex = message.target.reduce((targetIndex, target, index) => target.toString() === userIds.id.toString() ? index : targetIndex, -1);
        if(targetIndex >= 0) {
            message.postpone.set(targetIndex,  message.postpone[targetIndex] + days);
            await message.save();
            return message;
        } else throw new Error(`Can't find user-target: ${user} in message id: ${message._id}.`);
    } else throw new Error(`Can't find message id: ${id}.`);
};
// *********************************************************************************************************************
// CONFIRM MESSAGE
// *********************************************************************************************************************
exports.confirmMessage = async (id, answer, userIds) => {
    const message = await PusherMessage.findOne({_id: id});
    if(message) {
        const targetIndex = message.target.reduce((targetIndex, target, index) => target.toString() === userIds.id.toString() ? index : targetIndex, -1);
        if(targetIndex >= 0) {
            if(answer) message.answer.set(targetIndex, answer);
            message.confirmed.set(targetIndex, Date.now());
            await message.save();
            if(message.followed) { // notification about expired confirmation has been already sent => update status
                const unanswered = message.target.filter((t, i) => message.confirmed[i] === null);
                let update;
                const users = await getUsers();
                if(unanswered.length > 0) {
                    const details = unanswered.reduce((o, id, i) => { o += i > 0 ? `, ${users[id] ? users[id].name : 'Unknown User'}` : `${users[id] ? users[id].name : 'Unknown User'}`; return o}, '');
                    update = {details: details};
                } else {
                    update = {details: '', confirmed: [Date.now()]};
                }
                const normalized = await taskHelper.normalizeMessage(await updateMessage(message.followed, update), users);
                return {message: message, update: normalized[0]};
            } else {
                return {message: message};
            }
        } else throw new Error(`Can't find user-target: ${userIds.ssoId} in message id: ${message._id}.`);
    } else throw new Error(`Can't find message id: ${id}.`)
};
// *********************************************************************************************************************
// GET GROUPS AND USERS FOR CREATE MESSAGE
// *********************************************************************************************************************
exports.getUsersAndGroupsForCreate = async user => {
    const allUsers = await User.find({$or: [{access: 'pusher:app'},{access: 'pusher:email'}]}).lean();
    const owner = allUsers.find(u => u.ssoId === user);
    const query = owner ? {$or: [{owner: null}, {owner: owner}]} : {owner: null};
    const sets = await PusherGroup.find(query).lean();
    const users = allUsers.map(user => {return {id: user._id.toString(), label: user.name, hasPusher: user.access.indexOf('pusher:app') >= 0}}).sort(sortByLabel);
    const usersMap = users.reduce((map, user) => {
        map[user.id] = user.label;
        return map;
    }, {});
    const globalGroups =   sets.filter(set => set.owner === null).map(set => {return {label: set.label, id: set._id, members: set.members.map(member => member.toString()).filter(member => !!usersMap[member]).sort((a, b) => sortMembersByLabel(a, b, usersMap))}}).sort(sortByLabel);
    const personalGroups = sets.filter(set => set.owner !== null).map(set => {return {label: set.label, id: set._id, members: set.members.map(member => member.toString()).filter(member => !!usersMap[member]).sort((a, b) => sortMembersByLabel(a, b, usersMap))}}).sort(sortByLabel);
    globalGroups.unshift({
        label: 'All users',
        id: null,
        members: users.map(u => u.id)
    });
    return {
        users: users,
        globalGroups: globalGroups.filter(group => group.members.length > 0),
        personalGroups: personalGroups.filter(group => group.members.length > 0)
    }
};
// *********************************************************************************************************************
// CREATE GROUPS AND USERS FOR CREATE MESSAGE
// *********************************************************************************************************************
exports.createUserGroupForCreate = async (id, label, members, owner) => {
    const user = await User.findOne({ssoId: owner}, {_id: true}).lean();
    await PusherGroup.create({_id: id, owner: user._id, label: label, members: members});
};
// *********************************************************************************************************************
// UPDATE GROUPS AND USERS FOR CREATE MESSAGE
// *********************************************************************************************************************
exports.updateUserGroupForCreate = async (id, members) => {
    await PusherGroup.findOneAndUpdate({_id: id}, {$set: {members: members}});
};
// *********************************************************************************************************************
// REMOVE GROUPS AND USERS FOR CREATE MESSAGE
// *********************************************************************************************************************
exports.removeUserGroupForCreate = async id => {
    await PusherGroup.findOneAndRemove({_id: id});
};
// *********************************************************************************************************************
// ADD MESSAGE
// *********************************************************************************************************************
exports.addMessage = async message => {
    if(!message) return [];
    const users = await getUsers();
    const targetByRole = message && message.target && message.target.role ? await exports.getUsersByRole(message.target.role) : null;
    let target = targetByRole ? targetByRole.map(target => target.id) : Array.isArray(message.target) ? message.target : [message.target];
    if(message.origin) target = target.filter(t => t != message.origin);
    if(target.length === 0) return [];
    const newMessage = await PusherMessage.create({
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
    const normalizedMessages = await taskHelper.normalizeMessage(newMessage, users);
    if(normalizedMessages) return normalizedMessages;
    else return [];
};

// ---------------------------------------------------------------------------------------------------------------------
//    W O R K  -  C L O C K
// ---------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// GET WORK-CLOCK FOR USER
// *********************************************************************************************************************
exports.getWorkClock = async (userId, isSsoId) => {
    if(isSsoId) {
        const user = await User.findOne({ssoId: userId}, {_id: true}).lean();
        userId = user ? user._id.toString() : null;
    }
    const workClock = await PusherWorkclock.findOne({user: userId}).sort({timestamp: -1}).lean();
    return workClock ? workClock.state : 'OUT';
};

// *********************************************************************************************************************
// SET WORK-CLOCK FOR USER
// *********************************************************************************************************************
exports.setWorkClock = async (ssoId, state) => {
    const user = await User.findOne({ssoId: ssoId}, {_id: true, name: true, ssoId: true}).lean();
    if(user) {
        await PusherWorkclock.create({user: user._id, state: state});
        const requests = await PusherWorkclockNotify.find({subject: user._id, notified: null, canceled: null}).populate('user');
        const toNotify = {};
        for(const request of requests) {
            request.notified = Date.now();
            if(!toNotify[request.user.ssoId]) toNotify[request.user.ssoId] = request.user;
            await request.save();
        }
        return {user: {_id: user._id, ssoId: user.ssoId, name: user.name}, toNotify: Object.keys(toNotify).map(u => toNotify[u])};
    } else {
        throw new Error(`Can't find user ${ssoId}`);
    }
};
// *********************************************************************************************************************
// SET WORK-CLOCK REQUEST
// *********************************************************************************************************************
exports.setWorkClockRequest = async (userSsoId, subjectSsoId) => {
    const user = await User.findOne({ssoId: userSsoId}, {_id: true}).lean();
    if(!user) throw new Error(`Can't find user ${userSsoId}`);
    const subject = await User.findOne({ssoId: subjectSsoId}, {_id: true}).lean();
    if(!subject) throw new Error(`Can't find subject ${subjectSsoId}`);
    const requested = await PusherWorkclockNotify.findOne({user: user._id, subject: subject._id, notified: null, canceled: null}).lean();
    if(requested) return false;
    else {
        await PusherWorkclockNotify.create({user: user._id, subject: subject._id});
        return true;
    }
};
// *********************************************************************************************************************
// CANCEL WORK-CLOCK REQUEST
// *********************************************************************************************************************
exports.cancelWorkClockRequest = async (userSsoId, subjectSsoId) => {
    const user = await User.findOne({ssoId: userSsoId}, {_id: true}).lean();
    if(!user) throw new Error(`Can't find user ${userSsoId}`);
    const subject = await User.findOne({ssoId: subjectSsoId}, {_id: true}).lean();
    if(!subject) throw new Error(`Can't find subject ${subjectSsoId}`);
    const result = await PusherWorkclockNotify.update({user: user._id, subject: subject._id, notified: null, canceled: null}, {$set: {canceled : Date.now()}}, {multi: true});
    return !!result && result.nModified > 0;
};
// *********************************************************************************************************************
// GET USER'S LEADS FOR TODAY
// *********************************************************************************************************************
exports.getTodayUserLeads = async userId => {
    const result = {stage1: [], stage2: [], stage3: []};
    let user = await User.findOne({ssoId: userId}, {_id: true, resource: true, name: true}).populate({path: 'resource', populate: {path: 'job'}, select: 'job'}).lean();
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
// CREATE WORK REQUEST
// *********************************************************************************************************************
exports.createWorkRequest = async (userId, leads) => {
    let stage = 3;
    let stageLeads = leads.stage3;
    if(leads.stage1.length > 0) {
        stage = 1;
        stageLeads = leads.stage1;
    } else if(leads.stage2.length > 0) {
        stage = 2;
        stageLeads = leads.stage2;
    }
    const user = await User.findOne({ssoId: userId}).lean();
    if(user) {
        await PusherWorkRequest.update({user: user._id, closed: null}, {closed: Date.now()}, {multi: true}); //close all open requests for the user - should never happen but....
        const request = await PusherWorkRequest.create({user: user._id, stage: stage});
        return {requestId: request._id, stageLeads : stageLeads, user: {id: user._id, ssoId: user.ssoId, name: user.name}};
    } else throw new Error(`createWorkRequest:: Can't find user: ${userId}`);
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
// *********************************************************************************************************************
// CLOSE WORK REQUEST
// *********************************************************************************************************************
exports.closeWorkRequest = async userId => {
    const user = await User.findOne({ssoId: userId}).lean();
    if(user) {
        const requests = await PusherWorkRequest.find({user: user._id, closed: null});
        return await Promise.all(requests.map(request => {
            request.closed = Date.now();
            return request.save();
        }))
    } else throw new Error(`closeWorkRequest:: Can't find user: ${userId}`);
};
// *********************************************************************************************************************
// UPDATE MESSAGE DETAIL
// *********************************************************************************************************************
exports.updateMessageDetails = async (messageIds, details) => {
    const users = await getUsers();
    let messages = await PusherMessage.find({_id: {$in: messageIds}});
    const messagesToUpdate = [];
    for(const message of messages) {
        message.details = details;
        const updatedMessage = await message.save();
        updatedMessage.target.forEach((user, index) => {
            if(updatedMessage.confirmed[index] === null) messagesToUpdate.push({message: updatedMessage, user: user});
        });
    }
    return await Promise.all(messagesToUpdate.map(msgData => taskHelper.normalizeMessage(msgData.message, users, msgData.user)));
};
// ---------------------------------------------------------------------------------------------------------------------
//    W O R K  -  L O G
// ---------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// GET WORK-LOGS FOR USER
// *********************************************************************************************************************
exports.getWorklogsForUser = async (user, full) => {
    const userIds = await exports.getUserBySsoId(user);
    const logs = await PusherWorklog.find({approved: false}).populate('project job operatorJob').lean();
    const projectsWithLogs = logs.reduce((output, log) => {
        const logK2id = log.operatorName.toLowerCase() + '.' + log.operatorSurname.toLowerCase();

        const logApproval = getLogStatus(log); //current status of log approval
        let logUserRole = getLogRole(log, userIds); //user's role(s) for the project which log belongs to

        // if user has any role for this log and it is not log about own work (excluded manager but it should never happen)
        let sendToThisUser =  !log.resolve && logUserRole.length > 0 && (logK2id != userIds.K2id || log.project.manager == userIds.id);

        // exclude if approval is already done by this user (role)
        if(sendToThisUser) {
            sendToThisUser = logUserRole.reduce((out, role) => {
                if (logApproval[role] === 0) return true;
                else return out;
            }, false);
        }
        // if user is manager of the project and it is not send by previous conditions
        // all approval are done but obviously still not approved - it means need final decision from manager
        // ANY WEIRED approval
        let managersDecision = false;
        if(full || (!log.resolve && !sendToThisUser && logUserRole.indexOf('manager') >= 0)) { //} log.project.manager == userIds.id)) {
            const complete = logApproval.manager !== 0 && logApproval.supervisor !== 0 && logApproval.lead2D !== 0 && logApproval.lead3D !== 0 && logApproval.producer !== 0 && logApproval.leadMP !== 0;
            const someWeired = logApproval.manager === 3 || logApproval.supervisor === 3 || logApproval.lead2D === 3 || logApproval.lead3D === 3 || logApproval.producer === 3 || logApproval.leadMP === 3;
            const someOk = logApproval.manager === 1 || logApproval.supervisor === 1 || logApproval.lead2D === 1 || logApproval.lead3D === 1 || logApproval.producer === 1 || logApproval.leadMP === 1;

            managersDecision = complete && (someWeired || !someOk);

            sendToThisUser = managersDecision;
        }
        if(full) {
            sendToThisUser = true;
            logUserRole = ['manager','supervisor','lead2D','lead3D', 'leadMP', 'producer'];
        }
        // if user is producer and log needs to be resolved
        if(!sendToThisUser && log.resolve && userIds.role.indexOf('booking:worklog-resolver') >= 0) {// PRODUCERS.indexOf(user) >= 0 ) {
            sendToThisUser = true;
        }
        if(sendToThisUser) {
            const _log = {
                id: log._id,
                operator: log.operatorName.toUpperCase() + ' ' + log.operatorSurname.toUpperCase(),
                date: moment(log.date).add(12, 'hours').startOf('day').format(),
                work: log.job.shortLabel,
                hours: log.hours,
                description: log.description,
                roles: logUserRole,
                approval: logApproval,
                finalApprove: managersDecision,
                resolve: log.resolve
            };
            if(output[log.project._id]) {
                output[log.project._id].logs.push(_log);
            } else {
                output[log.project._id] = {
                    id: log.project._id,
                    label: log.project.label,
                    logs: [_log]
                }
            }
            return output;
        } else return output;

    }, {});

    // convert object to array and sort  logs by date
    const result = Object.keys(projectsWithLogs).map(projectId => {
        const project = projectsWithLogs[projectId];
        project.logs = project.logs.sort((a,b) => {
            const aa = a.resolve ? 2 : a.finalApprove ? 1 : 0;
            const bb = b.resolve ? 2 : b.finalApprove ? 1 : 0;
            const importanceCompare = aa - bb;
            if(importanceCompare !== 0) return importanceCompare;
            const dateCompare = new Date(a.date) - new Date(b.date);
            if(dateCompare !== 0) return dateCompare;
            const operatorCompare =  (a.operator < b.operator) ? -1 : (a.operator > b.operator) ? 1 : 0;
            if(operatorCompare !== 0) return operatorCompare;
            const hoursCompare = b.hours - a.hours;
            if(hoursCompare !== 0) return hoursCompare;
            return (a.description < b.description) ? -1 : (a.description > b.description) ? 1 : 0;
        });
        return project;
    });

    return result.sort((a, b) => {return (a.label < b.label) ? -1 : (a.label > b.label) ? 1 : 0});
};
// *********************************************************************************************************************
// CONFIRM WORK-LOG
// *********************************************************************************************************************
exports.confirmWorkLog = async (id, kind, value) => {
    const log = await PusherWorklog.findOne({_id: id}).populate('project job operatorJob');
    if(log) {
        if(!Array.isArray(kind)) kind = [kind];
        let updateResolver = false;
        let updateManager = false;
        kind.forEach(type => {
            switch (type) {
                case 'final':
                    if (value === true) log.approved = true;
                    else {
                        log.approved = false;
                        log.resolve = true;
                        // SEND TO worklog-resolver's
                        updateResolver = true;
                    }
                    break;
                case 'approved':
                    log.approved = true;
                    // SEND TO worklog-resolvers (THE OTHERS (all)) in this case, value = ssoId of user who approved (role: = booking:worklog-resolver)
                    updateResolver = true;
                    break;
                case 'manager':
                    log.confirmManager = value; // 1,2,3 as ok, maybe, weired
                    break;
                case 'supervisor':
                    log.confirmSupervisor = value; // 1,2,3 as ok, maybe, weired
                    break;
                case 'lead2D':
                    log.confirm2D = value; // 1,2,3 as ok, maybe, weired
                    break;
                case 'lead3D':
                    log.confirm3D = value; // 1,2,3 as ok, maybe, weired
                    break;
                case 'leadMP':
                    log.confirmMP = value; // 1,2,3 as ok, maybe, weired
                    break;
                case 'producer':
                    log.confirmProducer = value; // 1,2,3 as ok, maybe, weired
            }
        });
        if(!log.approved && !log.resolve) {
            const logApproval = getLogStatus(log);

            const complete = logApproval.manager !== 0 && logApproval.supervisor !== 0 && logApproval.lead2D !== 0 && logApproval.lead3D !== 0 && logApproval.producer !== 0 && logApproval.leadMP !== 0;
            const someWeired = logApproval.manager === 3 || logApproval.supervisor === 3 || logApproval.lead2D === 3 || logApproval.lead3D === 3 || logApproval.producer === 3 || logApproval.leadMP === 3;
            const someOk = logApproval.manager === 1 || logApproval.supervisor === 1 || logApproval.lead2D === 1 || logApproval.lead3D === 1 || logApproval.producer === 1 || logApproval.leadMP === 1;

            log.approved =  complete && !someWeired && someOk;

            if(complete && !log.approved) {
                // IF COMPLETED AND NOT log.approved => NEED MANAGER DECISION -> SEND TO MANAGER
                updateManager = true;
            }
        }
        await log.save();
        const update = [];
        if(updateResolver) {
            const users = await User.find({role: 'booking:worklog-resolver'}, {ssoId: true, _id: false}).lean();
            users.forEach(u => {
                if(update.indexOf(u.ssoId) < 0 && u.ssoId !== value) update.push(u.ssoId)
            });
        }
        if(updateManager) {
            const users = await User.find({_id: log.project.manager}, {ssoId: true, _id: false}).lean();
            users.forEach(u => {
                if(update.indexOf(u.ssoId) < 0 && u.ssoId !== value) update.push(u.ssoId)
            });
        }
        return update;
    } else throw new Error(`Can't find worklog ${id}`);
};
// ---------------------------------------------------------------------------------------------------------------------
//    G E T  O T H E R  D A T A
// ---------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// GET ALL USERS (with workclock and requests by user)
// *********************************************************************************************************************
exports.getAllUsers = async forUser => {
    const forUserId = await User.findOne({ssoId: forUser}, {_id: true}).lean();
    const _users = await User.find({},{name: true, ssoId: true, role: true, access: true, tlf: true, email: true, resource: true}).lean();
    const users = _users.filter(user => user.access.indexOf('pusher:app') >= 0).map(user => ({
        id: user._id.toString(),
        ssoId: user.ssoId,
        name: user.name,
        role: user.role.filter(role => role.indexOf('booking:') === 0),
        email: user.email,
        tlf: user.tlf,
        resource: user.resource
    }));
    for(const user of users) {
        user.clock = await exports.getWorkClock(user.id);
        user.requested = await getWorkClockRequestedByUser(user.id, forUserId ? forUserId._id.toString() : null);
    }
    return users.reduce((out, user) => {
        out[user.id] = user;
        return out;
    }, {});
};

async function getWorkClockRequestedByUser(subject, user) { //get requests for subject by user
    if(!user || !subject) return false;
    const requests = await PusherWorkclockNotify.find({user: user, subject: subject, notified: null, canceled: null}, {_id: true}).lean();
    return requests.length > 0;
}
// *********************************************************************************************************************
// GET PROJECT TEAM FOR USER
// *********************************************************************************************************************
exports.getProjectTeamForUser = async user => {
    const today = moment().startOf('day');
    const days = []; //array for every day in time span of {date, timings [], projects []}
    for(let i = 0; i < PUSHER_BOOKING_TIME_SPAN; i++) days.push({date: today.clone().add(i, 'days'), timings: [], projects: []});
    const userIds = await exports.getUserBySsoId(user);
    const projects = await BookingProject.find({timing: {$gt: []}, $or: [{manager: userIds.id}, {supervisor: userIds.id}, {lead2D: userIds.id}, {lead3D: userIds.id}, {leadMP: userIds.id}], deleted: null, offtime: {$ne: true}, internal: {$ne: true}, confirmed: true}, {label:true, timing:true, lead2D: true, lead3D: true, leadMP: true, manager: true, supervisor: true, producer: true}).lean();
    projects.forEach(project => {
        const isManagerOrSupervisor = (project.manager && project.manager.toString() === userIds.id) || (project.supervisor && project.supervisor.toString() === userIds.id);
        project.timing.forEach(timing => {
            if(isManagerOrSupervisor || timing.type === 'UPP') {
                const timingDate = moment(timing.date).startOf('day');
                const dayIndex = timingDate.diff(today, 'days');
                if(dayIndex >= 0 && days.length > dayIndex) {
                    days[dayIndex].timings.push({type: timing.type, category: timing.category, text: timing.text, project: project.label});
                    if(dayIndex > 0 ) days.length = dayIndex + 1; //shorten time span to latest date + today
                }
            }
        })
    });
    // get all events in time span from today where not offtime and operator is defined
    const regionStart = moment.utc().startOf('day').valueOf(); //startDate on event is without TZ !!!!
    const regionEnd = moment.utc().endOf('day').add(days.length - 1, 'day').valueOf(); //end of day of  last region day - included
    const eventStart = 'this.startDate.getTime()';
    const eventEnd = '(this.startDate.getTime() + (this.days.length * 24 * 3600000))';

    const query = {$where : `(${eventStart} <= ${regionEnd}) && (${eventEnd} > ${regionStart})`, operator: {$ne: null}, offtime: {$ne: true}};
    const events = await BookingEvent.find(query, {__v: false, efficiency: false, notes: false, offtime: false, label: false})
        .populate('operator facility job')
        .populate({path: 'project', populate: {path: 'manager supervisor lead2D lead3D leadMP producer', select: 'name'}, select: 'label manager supervisor lead2D lead3D leadMP producer deleted internal confirmed'})
        .lean();

    const activeProjects = events.filter(event => !event.project.deleted && !event.project.internal &&!event.project.rnd).reduce((projects, event) => {
        const projectId = event.project._id.toString();
        const isEventOperator = userIds.resource && event.operator ? event.operator._id.toString() === userIds.resource : false;
        if(!projects[projectId]) {
            const role = {
                manager: event.project.manager ? event.project.manager._id.toString() === userIds.id : false,
                supervisor: event.project.supervisor ? event.project.supervisor._id.toString() === userIds.id : false,
                lead2D: event.project.lead2D ? event.project.lead2D._id.toString() === userIds.id : false,// && event.job && ['2D', 'MP'].indexOf(event.job.type) >= 0 : false, //lead - team only if job is...
                lead3D: event.project.lead3D ? event.project.lead3D._id.toString() === userIds.id : false, //&& event.job && ['3D', 'MP'].indexOf(event.job.type) >= 0 : false,
                leadMP: event.project.leadMP ? event.project.leadMP._id.toString() === userIds.id : false, //&& event.job && event.job.type === 'MP' : false
                producer: event.project.producer ? event.project.producer._id.toString() === userIds.id : false
            };
            projects[projectId] = {
                role: (role.supervisor || role.manager || role.leadMP || role.lead3D || role.lead2D /*|| role.producer*/) ? role : null,
                label: event.project.label,
                manager: event.project.manager ? {id: event.project.manager._id.toString(), label: event.project.manager.name} : null,
                supervisor: event.project.supervisor ? {id: event.project.supervisor._id.toString(), label: event.project.supervisor.name} : null,
                lead2D: event.project.lead2D ? {id: event.project.lead2D._id.toString(), label: event.project.lead2D.name} : null,
                lead3D: event.project.lead3D ? {id: event.project.lead3D._id.toString(), label: event.project.lead3D.name} : null,
                leadMP: event.project.leadMP ? {id: event.project.leadMP._id.toString(), label: event.project.leadMP.name} : null,
                producer: event.project.producer ? {id: event.project.producer._id.toString(), label: event.project.producer.name} : null,
                id: projectId,
                events: []
            }
        }
        const startDateIndex = today.diff(moment(event.startDate, 'YYYY-MM-DD').startOf('day'), 'days');
        const eventDays = [];
        for(let i = 0; i < days.length; i++) {
            if(startDateIndex + i >= 0 && startDateIndex + i < event.days.length && event.days[startDateIndex + i].duration > 0) {
                eventDays.push({
                    float: event.days[startDateIndex + i].float,
                    start: event.days[startDateIndex + i].start,
                    duration: event.days[startDateIndex + i].duration,
                    isEventOperator: isEventOperator
                })
            } else eventDays.push(null)
        }
        if(eventDays.some(day => !!day)) {
            projects[projectId].events.push({
                isEventOperator: isEventOperator,
                operator: event.operator ? event.operator.virtual && event.virtualOperator ? `~${event.virtualOperator}` : `${event.operator.virtual ? '~' : ''}${event.operator.label}` : '',
                operatorId: event.operator ? event.operator._id : null,
                days: eventDays,
                facility: event.facility ? event.facility.label : null,
                facilityTlf: event.facility && event.facility.tlf ? event.facility.tlf : null,
                isShooting: event.isShooting,
                confirmed: event.confirmedAsProject ? event.project.confirmed : event.confirmed
            });
        }
        return projects;
    }, {});
    for(let i = 0; i< days.length; i++) {
        for (let projectId in activeProjects) {
            if (activeProjects.hasOwnProperty(projectId)) {
                const events = activeProjects[projectId].events.filter(event => event.days[i] !== null);
                const operatorRole = events.some(event => event.isEventOperator);
                if (operatorRole || (activeProjects[projectId].role && events.length > 0)) {
                    days[i].projects.push({
                        id: activeProjects[projectId].id,
                        label: activeProjects[projectId].label,
                        role: activeProjects[projectId].role,
                        manager: activeProjects[projectId].manager,
                        supervisor: activeProjects[projectId].supervisor,
                        lead2D: activeProjects[projectId].lead2D,
                        lead3D: activeProjects[projectId].lead3D,
                        leadMP: activeProjects[projectId].leadMP,
                        producer: activeProjects[projectId].producer,
                        events: events.map(event => {
                            return {
                                isEventOperator: event.isEventOperator,
                                operator: event.operator,
                                operatorId: event.operatorId,
                                facility: event.facility,
                                facilityTlf: event.facilityTlf,
                                isShooting: event.isShooting,
                                confirmed: event.confirmed,
                                time: {
                                    float: event.days[i].float,
                                    start: event.days[i].start,
                                    duration: event.days[i].duration
                                }
                            }

                        })
                    });
                    if (i > 0) days.length = i + 1; //shorten time span to latest date + today
                }
            }
        }
    }
    delete days[0].date;
    const myDay = days[0].timings.length > 0 || days[0].projects.length > 0 ? days[0] : null;
    const nextDay = days.length > 1 && (days[days.length - 1].timings.length > 0 || days[days.length - 1].projects.length > 0) ? days[days.length - 1] : null;

    if(myDay && myDay.timings && myDay.timings.length > 0) myDay.timings = dataHelper.timingReduce(myDay.timings);
    if(nextDay && nextDay.timings && nextDay.timings.length > 0) nextDay.timings = dataHelper.timingReduce(nextDay.timings);
    if(nextDay) nextDay.date = nextDay.date.format('YYYY-MM-DD');
    return {myDay, nextDay};
};
// *********************************************************************************************************************
// GET FREELANCERS
// *********************************************************************************************************************
exports.getFreelancers = async userSsoId => {
    const user = userSsoId ? await User.findOne({ssoId: userSsoId}, {_id: true, role: true}).lean() : null;
    const isHR = user && (user.role.indexOf('booking:hr-manager') >= 0 || user.role.indexOf('booking:main-manager') >= 0);
    const userId = user ? user._id.toString() : null;

    const events = await BookingEvent.find({offtime: false}, {startDate: true, days: true, project: true, operator: true}).populate({path: 'project', select: 'label manager internal deleted'}).populate({path: 'operator', select: 'virtual freelancer confirmed label'}).lean();


    const resources = isHR ? await BookingResource.find({type: 'OPERATOR', $or: [{virtual: true}, {freelancer: true}], confirmed:{$exists: true, $ne: []}}, {virtual: true, freelancer: true, label: true, confirmed: true}).lean() : [];
    const freelancers = resources.map(resource => {
        return {
            id: resource._id.toString(),
            virtual: resource.virtual,
            freelancer: resource.freelancer,
            label: resource.label,
            confirmed: resource.confirmed.map(confirmation => {
                return {
                    from: moment(confirmation.from).startOf('day'),
                    to: moment(confirmation.to).startOf('day')
                }
            })
        }
    });

    const unconfirmedFreelancers = {};
    const confirmedFreelancers = {};

    const today = moment().startOf('day');

    for(const freelancer of freelancers) {
        for(const confirmation of freelancer.confirmed) {
            let from = confirmation.from;
            let to = confirmation.to;
            if(to.diff(today, 'days') >= 0) {
                if(today.diff(from, 'days') >= 0) from = today.clone();
                if(!confirmedFreelancers[freelancer.id]) confirmedFreelancers[freelancer.id] = {
                    freelancer: {
                        id: freelancer.id,
                        label: freelancer.label,
                        remote: freelancer.virtual
                    },
                    dates: []
                };
                const confirmationLength = to.diff(from, 'days') + 1;
                for(let i = 0; i < confirmationLength; i++) {
                    const dayString = from.clone().add(i, 'day').format('YYYY-MM-DD');
                    if(confirmedFreelancers[freelancer.id].dates.indexOf(dayString) < 0) confirmedFreelancers[freelancer.id].dates.push(dayString);
                }
            }
        }
    }

    const activeEvents = events.filter(event => {
        if(event.project.internal || event.project.rnd || event.project.deleted) return false; // no internal, r&d or deleted projects
        if(userId && !isHR && (!event.project.manager || event.project.manager.toString() !== userId)) return false; //only if user is manager or HR
        if(!event.operator || (!event.operator.virtual && !event.operator.freelancer)) return false;// event operator is not freelancer or virtual
        const endDay = moment(event.startDate, 'YYYY-MM-DD').add((event.days.length - 1), 'days').startOf('day');
        if(endDay.diff(moment().startOf('day'), 'days') < 0) return false; //only event having any day equal today and late
        return true;
    });

    for(const event of activeEvents) {
        const day = moment(event.startDate, 'YYYY-MM-DD').startOf('day');
        const projectId = event.project._id.toString();
        const operatorId = event.operator._id.toString();
        const isManager = event.project.manager && event.project.manager.toString() === userId;
        for(let i = 0; i < event.days.length; i++) {
            if(day.diff(today, 'days') >= 0 /*&& event.days[i].duration > 0*/) { //event day from today and duration > 0
                if (isFreelancerConfirmed(event.operator.confirmed, day)) {
                    if(confirmedFreelancers[operatorId]) {
                        const di = confirmedFreelancers[operatorId].dates.indexOf(day.format('YYYY-MM-DD'));
                        if(di >= 0) confirmedFreelancers[operatorId].dates.splice(di, 1);
                    }
                } else if(isManager) {
                    if(!unconfirmedFreelancers[`${projectId}-${operatorId}`]) unconfirmedFreelancers[`${projectId}-${operatorId}`]= {
                        project: {
                            id: projectId,
                            label: event.project.label,
                        },
                        freelancer: {
                            id: operatorId,
                            label: event.operator.label,
                            remote: event.operator.virtual
                        },
                        dates: []
                    };
                    unconfirmedFreelancers[`${projectId}-${operatorId}`].dates.push(day.format('YYYY-MM-DD'));
                }
            }
            day.add(1, 'day');
        }
    }

    return {
        confirmed: isHR ? Object.keys(confirmedFreelancers).map(key => {
            return {
                freelancer: confirmedFreelancers[key].freelancer,
                dates: compactDates(confirmedFreelancers[key].dates.filter(dateHelper.isWorkingDay))
            }
        }).filter(obj => obj.dates.length > 0) : [],
        unconfirmed: Object.keys(unconfirmedFreelancers).map(key => {
            return {
                freelancer: unconfirmedFreelancers[key].freelancer,
                project: unconfirmedFreelancers[key].project,
                dates: compactDates(unconfirmedFreelancers[key].dates)
            }
        }).filter(obj => obj.dates.length > 0)
    };
};
// *********************************************************************************************************************
// GET MANAGER'S SSO-ID FOR RESOURCE-IDs OF NOT INTERNAL PROJECTS
// *********************************************************************************************************************
exports.getManagerSsoIdForResourceOfNotInternalProjects = async (resourceId, cutDay) => {
    const events = await BookingEvent.find({operator: resourceId, offtime: false}, {project: true, startDate: true, days: true}).populate({path: 'project', select: 'manager deleted', populate: {path: 'manager', select: 'ssoId'}}).lean();
    return events.filter(event => !event.project.deleted && !event.project.internal && !event.project.rnd && (!cutDay || moment(event.startDate, 'YYYY-MM-DD').startOf('day').add(event.days.length - 1, 'day').diff(cutDay, 'days') >= 0)).reduce((managers, event) => {
        if(managers.indexOf(event.project.manager.ssoId) < 0) managers.push(event.project.manager.ssoId);
        return managers;
    }, []);
};
// *********************************************************************************************************************
// GET MANAGER'S SSO-ID FOR PROJECT-IDs OF NOT INTERNAL PROJECTS
// *********************************************************************************************************************
exports.getManagerSsoIdOfNotInternalProjects = async projectIds => {
    if(!Array.isArray(projectIds)) projectIds = [projectIds];
    const projects = await BookingProject.find({_id: {$in: projectIds}}).populate('manager').lean();
    return projects.filter(project => !project.deleted && !project.internal && project.manager).map(project => project.manager.ssoId);
};
// *********************************************************************************************************************
// GET HR-NOTIFY MANAGERS
// *********************************************************************************************************************
exports.getHrNotifyManagers = async outputId => {
    const users = await User.find({role: {$in: ['booking:hr-manager', 'booking:main-manager']}}, {ssoId: true}).lean();
    if(users && users.length > 0) {
        return users.map(user => outputId ? user._id.toString() : user.ssoId);
    } else return [];
};
// *********************************************************************************************************************
// GET USERS FOR PROJECT-ID
// *********************************************************************************************************************
exports.getUsersForProjectId = async ids => {
    if(!ids || !Array.isArray(ids)) return [];
    const projects = await Promise.all(ids.map(id => BookingProject.findOne({_id: id}, {manager: true, supervisor: true, lead2D: true, lead3D: true, leadMP: true, producer: true}).lean()));
    const userIds = projects.reduce((out, project) => {
        if(project.manager && out.indexOf(project.manager.toString()) < 0) out.push(project.manager.toString());
        if(project.supervisor && out.indexOf(project.supervisor.toString()) < 0) out.push(project.supervisor.toString());
        if(project.lead2D && out.indexOf(project.lead2D.toString()) < 0) out.push(project.lead2D.toString());
        if(project.lead3D && out.indexOf(project.lead3D.toString()) < 0) out.push(project.lead3D.toString());
        if(project.leadMP && out.indexOf(project.leadMP.toString()) < 0) out.push(project.leadMP.toString());
        if(project.producer && out.indexOf(project.producer.toString()) < 0) out.push(project.producer.toString());
        return out;
    }, []);
    const users = await Promise.all(userIds.map(user => User.findOne({_id: user}, {ssoId: true}).lean()));
    return users.map(u => u.ssoId);
};
// *********************************************************************************************************************
// GET SSO-IDs FOR RESOURCE-IDs
// *********************************************************************************************************************
exports.getSsoIdForResourceId = async ids => {
    if(!ids || !Array.isArray(ids)) return [];
    const users = await User.find({resource: {$in: ids}}, {ssoId: true}).lean();
    return users.map(u => u.ssoId);
};
// *********************************************************************************************************************
// GET USER BY SSO-ID
// *********************************************************************************************************************
exports.getUserBySsoId = async (ssoId, nullIfNotFound) => {
    const user = await User.findOne({ssoId: ssoId}).lean();
    if(!user) {
        if(nullIfNotFound) return null;
        else throw new Error(`No user for ssoId: ${ssoId}`);
    }
    const resource = await BookingResource.findOne({_id: user.resource}, {K2id: true}).lean();
    return {id: user._id.toString(), resource: resource ? resource._id.toString() : null, K2id: resource ? resource.K2id : null, name: user.name, email: user.email ? user.email : null, role: user.role, access: user.access};
};
// *********************************************************************************************************************
// GET SSO-ID(s) for UID(s)
// *********************************************************************************************************************
exports.getSsoIdsForUsers = async uid => {
    if(!uid) return null;
    if(Array.isArray(uid)) {
        const users = await Promise.all(uid.map(id => User.findOne({_id: id}, {ssoId: true}).lean()));
        return users.map(u => u && u.ssoId ? u.ssoId : null);
    } else {
        const user =  await User.findOne({_id: uid}, {ssoId: true}).lean();
        return user && user.ssoId ? user.ssoId : null;
    }
};
// *********************************************************************************************************************
// IS ANY OPERATOR FREELANCER
// *********************************************************************************************************************
exports.isAnyOperatorFreelancer = async ids => {
    if(!Array.isArray(ids)) ids = [ids];
    const operators = await BookingResource.find({_id: {$in: ids}}, {virtual: true, freelancer: true}).lean();
    return operators.some(operator => operator.virtual || operator.freelancer);
};
// *********************************************************************************************************************
// HAS PROJECT BOOKED FREELANCER
// *********************************************************************************************************************
exports.hasProjectBookedFreelancer = async (id, cutDay) => {
    const project = await BookingProject.findOne({_id: id}, {events: true}).populate({path: 'events', select: {_id: true, operator: true, startDate: true, days: true}, populate: {path: 'operator', select: {virtual: true, freelancer: true}}}).lean();
    if(project) {
        const events = project.events.filter(event => event.operator !== null && (event.operator.virtual || event.operator.freelancer) && (!cutDay || moment(event.startDate, 'YYYY-MM-DD').add(event.days.length - 1, 'days').diff(cutDay, 'days') >= 0));
        return events.length > 0;
    } else return false;
}
// *********************************************************************************************************************
// GET BUDGET PRICE
// *********************************************************************************************************************
exports.getBudgetPrice = async id => {
    if(!id) return null;
    const budget = await Budget.findOne({_id: id}).populate('parts').lean();
    if(!budget) {
        logger.warn(`getBudgetPrice: can't find budget id: ${id}`);
        return null;
    }
    const parts =  budget.parts.map(part => {
        return {
            offer: part.offer,
            price: part.items.reduce((price, item) => price + ((item.numberOfUnits ? item.numberOfUnits : 0) * (item.price ? item.price : 0)), 0),
            currency: budget.currency,
            active: part.active
        }
    }).filter(item => item.active);
    const hasOffer = parts.some(part => part.offer);
    const result = parts.reduce((total, item) => {
        total.offer = hasOffer ? item.offer ? total.offer + item.offer : total.offer + item.price : null;
        total.price += item.price;
        total.currency = item.currency;
        return total;
    }, {offer: 0, price: 0, currency: '', percent: null});
    result.percent = result.price > 0 && result.offer ? Math.round(1000 * (result.price - result.offer) / result.price) / 10 : 0;
    if(result.offer === 0) result.offer = null;
    return result;
};
// *********************************************************************************************************************
// UPDATE PROJECT'S ONAIR STATE
// *********************************************************************************************************************
async function updateProjectOnairState(projectId, onairId, state) {
    const project = await BookingProject.findOne({_id: projectId});
    if(project) {
        const newOnair = [];
        project.onair.forEach(onair => {
            if(onair._id.toString() === onairId.toString() && onair.state !== 'deleted') onair.state = state;
            newOnair.push(onair);
        });
        project.onair = newOnair;
        await project.save();
        return dataHelper.normalizeDocument(project);
    } else {
        throw new Error('updateProjectOnairState - can\'t find project ID: ' + projectId);
    }
}
// *********************************************************************************************************************
// DELETE ONAIR
// *********************************************************************************************************************
async function deleteOnair(projectId, onairId) {
    const project = await BookingProject.findOne({_id: projectId});
    if(project) {
        project.onair = project.onair.filter(onair => onair._id.toString() != onairId.toString() || onair.state != 'deleted');
        await project.save();
        return dataHelper.normalizeDocument(project);
    } else {
        throw new Error('deleteOnair: - can\'t find project ID: ' + projectId);
    }
}
// ---------------------------------------------------------------------------------------------------------------------
//    H E L P E R S
// ---------------------------------------------------------------------------------------------------------------------

// *********************************************************************************************************************
// current status of log for all relevant approvers 0 = not approved, 1,2,3 = approved ok, maybe, wired, 4 = own log, 5 = approve is not required
function getLogStatus(log) {
    const logOperator = log.operator ? log.operator.toString() : null; //user ID
    // if project role exists => set log status otherwise 5
    const logStatus = {
        manager: log.project.manager ? log.confirmManager : 5,
        supervisor: log.project.supervisor ? log.confirmSupervisor : 5,
        lead2D: log.project.lead2D ? log.confirm2D : 5,
        lead3D: log.project.lead3D ? log.confirm3D : 5,
        leadMP: log.project.leadMP ? log.confirmMP : 5
    };
    // if it is own log - set 4
    if(log.project.manager  && log.project.manager == logOperator) logStatus.manager = 4;
    if(log.project.supervisor  && log.project.supervisor == logOperator) logStatus.supervisor = 4;
    if(log.project.lead2D  && log.project.lead2D == logOperator) logStatus.lead2D = 4;
    if(log.project.lead3D  && log.project.lead3D == logOperator) logStatus.lead3D = 4;
    if(log.project.leadMP  && log.project.leadMP == logOperator) logStatus.leadMP = 4;
    // set 5 if log.job.type is not required to be approved by the role
    switch(log.job.type) {
        case 'GR': // grading only manager
            logStatus.supervisor = 5;
            logStatus.lead2D = 5;
            logStatus.lead3D = 5;
            logStatus.leadMP = 5;
            break;
        case '2D': // 2D - manager, supervisor, lead2D
            logStatus.lead3D = 5;
            logStatus.leadMP = 5;
            break;
        case '3D': // 3D - manager, supervisor, lead3D
            logStatus.lead2D = 5;
            logStatus.leadMP = 5;
            break;
        case 'MP': // MP - all
            break;
        case 'SV': // SV - manager and supervisor
            logStatus.lead2D = 5;
            logStatus.lead3D = 5;
            logStatus.leadMP = 5;
            break;
        case 'OV':
        case 'TW': // OV and TW - if there is operator job -> lead2d = GR and 2D, lead3D = 3D, leadMP = MP
            if(log.operatorJob) {
                if(log.operatorJob.type !== '2D' && log.operatorJob.type !== 'GR') logStatus.lead2D = 5;
                if(log.operatorJob.type !== '3D') logStatus.lead3D = 5;
                if(log.operatorJob.type !== 'MP') logStatus.leadMP = 5;
            }
            break;
        case 'PG':
            logStatus.leadMP = 5;
            break;
        //TODO solve DEV and SUP mapped to 2D, 3D, leads....
    }
    // producer approve log of supervisor of the project
    logStatus.producer = log.project.supervisor && log.project.supervisor == logOperator ? log.confirmProducer : 5;
    return logStatus;
}
// *********************************************************************************************************************
// user role for log
function getLogRole(log, userIds) {
    const logOperator = log.operator ? log.operator.toString() : null; //user ID
    const logUserRole = [];
    //TODO solve DEV and SUP mapped to 2D, 3D, leads....
    if(log.project.manager == userIds.id    &&    ['2D','3D','MP','GR','OV','TW','SV','PG'].indexOf(log.job.type) >= 0) logUserRole.push('manager');
    if(log.project.supervisor == userIds.id &&    ['2D','3D','MP',     'OV','TW','SV','PG'].indexOf(log.job.type) >= 0) logUserRole.push('supervisor');
    if(log.project.lead2D == userIds.id     &&   (['2D','MP','PG'].indexOf(log.job.type) >= 0 || ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && (log.operatorJob.type === '2D' || log.operatorJob.type === 'GR')))) logUserRole.push('lead2D');
    if(log.project.lead3D == userIds.id     &&   (['3D','MP','PG'].indexOf(log.job.type) >= 0 || ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type === '3D'))) logUserRole.push('lead3D');
    if(log.project.leadMP == userIds.id     &&   (['MP'].indexOf(log.job.type) >= 0      || ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type === 'MP'))) logUserRole.push('leadMP');
    if(logOperator != userIds.id && userIds.role.indexOf('booking:main-producer') >= 0 && log.project.supervisor && log.project.supervisor == logOperator) logUserRole.push('producer');
    return logUserRole;
}
// *********************************************************************************************************************
async function getUsers() {
    const users = await User.find({}, {__v: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(users);
}
// *********************************************************************************************************************
async function updateMessage(id, data) {
    const message = await PusherMessage.findOneAndUpdate({_id: id}, {$set: data}, {new: true});
    if(message) return message;
    else throw new Error(`UpdateMessage - Can't find message: ${id}`);
}
// *********************************************************************************************************************
function isFreelancerConfirmed(confirmations, day) {
    if(!day || !confirmations) return false;
    for(const confirmation of confirmations) {
        if(day.diff(moment(confirmation.from).startOf('day'), 'days') >= 0 && moment(confirmation.to).startOf('day').diff(day, 'days') >= 0) {
            return true;
        }
    }
    return false;
}
// *********************************************************************************************************************
function compactDates(dateArray) {
    const dates = [];
    let from = null;
    let to = null;
    dateArray.sort();
    for(const date of dateArray) {
        if(!from) {
            from = date;
            to = date;
        } else {
            if(moment(date, 'YYYY-MM-DD').diff(moment(to, 'YYYY-MM-DD'), 'days') === 1) {
                to = date;
            } else {
                if(from === to) dates.push(from);
                else dates.push([from, to]);
                from = date;
                to = date;
            }
        }
    }
    if(from !== null) {
        if (from === to) dates.push(from);
        else dates.push([from, to]);
    }
    return dates;
}

// *********************************************************************************************************************
function sortByLabel(a, b) {
    return a.label.localeCompare(b.label);
}
// *********************************************************************************************************************
function sortMembersByLabel(a, b, usersMap) {
    const aa = usersMap[a];
    const bb = usersMap[b];
    if(aa && bb) {
        return aa.localeCompare(bb);
    } else return 0;
}
// *********************************************************************************************************************