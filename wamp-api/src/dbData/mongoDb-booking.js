'use strict';
const mongoose = require('mongoose');
const dataHelper = require('../../_common/lib/dataHelper');
const logger = require('../logger');
const crypto = require('crypto');

//Collections
const BookingGroup = require('../../_common/models/booking-group');
const BookingResource = require('../../_common/models/booking-resource');
const Holiday = require('../../_common/models/holiday');
const BookingProject = require('../../_common/models/booking-project');
const Project = require('../../_common/models/project');
const BookingEvent = require('../../_common/models/booking-event');
const BookingWorkType = require('../../_common/models/booking-work-type');
const User = require('../../_common/models/user');
//const BookingOplog = require('../../_common/models/booking-oplog');

const Budget = require('../../_common/models/budget');
const BudgetClient = require('../../_common/models/budget-client');
const projectToBooking = require('../../_common/lib/projectToBooking');
require('../../_common/models/budget-item');

exports = module.exports;
// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
//exports.logOp = async (type, user, data, err) => {
//    await BookingOplog.create({type: type, user: user, data: data, success: !err, reason: err});
//};

// *******************************************************************************************
// GET DATA
// *******************************************************************************************
exports.getResourceGroups = async () => {
    const groups = await BookingGroup.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(groups);
};

exports.getResources = async () => {
    const resources = await BookingResource.find({},{__v:false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(resources);
};

exports.getHolidays = async () => {
    const holidays = await Holiday.find().lean();
    return holidays.length > 0 ? holidays[0].days : holidays
};
/*
exports.getProjects = async () => { //TODO xBPx -  Projects??? not used now - rest-api
    const projects = await BookingProject.find({deleted: null, archived: false},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false }).lean();
    return dataHelper.getObjectOfNormalizedDocs(projects);
};

exports.getEvents = async () => {
    const projects = await BookingProject.find({deleted: null, archived: false}, {_id: true}).lean(); //TODO Projects??? not used now - rest-api
    const projectIds = projects.map(project => project._id);
    const events = await BookingEvent.find({project: {$in: projectIds}, archived: false},{__v: false, 'days.__v': false, 'days._id': false, archived: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(events);
};
*/
exports.getJobs = async () => {
    const jobs = await BookingWorkType.find({bookable: true},{__v: false, K2ids: false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(jobs);
};

exports.getUsers = async () => {
    const users = await User.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(users)
};

// *******************************************************************************************
// EVENTS
// *******************************************************************************************
exports.addEvent = async (id, event, user, noAddToProject) => { //TODO xBPx
    event._id = id;
    event._user = user;
    await BookingEvent.create(event);
    if(!noAddToProject) {
        await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}});
        await Project.findOneAndUpdate({_id: event.project}, {$push: {events: id}}); //first try to find in bookingProject then in Project
    }
};

exports.updateEvent = async (id, event, user) => { //TODO xBPx
    event._user = user;
    const oldEvent = await BookingEvent.findOneAndUpdate({_id: id}, {$set: event});
    if(oldEvent.project && oldEvent.project.toString() !== event.project) await Promise.all([
        BookingProject.findOneAndUpdate({_id: oldEvent.project}, {$pull: {events: id}}),
        BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}}),
        Project.findOneAndUpdate({_id: oldEvent.project}, {$pull: {events: id}}), //first try to find in bookingProject then in Project
        Project.findOneAndUpdate({_id: event.project}, {$push: {events: id}}) //first try to find in bookingProject then in Project
    ]);
    return dataHelper.normalizeDocument(oldEvent, true);
};

exports.removeEvent = async (id, user) => { //TODO xBPx
    const event = await BookingEvent.findOneAndDelete({_id: id}, {_user: user});
    await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: id}});
    await Project.findOneAndUpdate({_id: event.project}, {$pull: {events: id}}); //first try to find in bookingProject then in Project
};

exports.splitEvent = async (id, event, id2, event2, user) => { //TODO xBPx
    event2._id = id2;
    event2._user = user;
    event._user = user;
    await BookingEvent.create(event2);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id2}}); //add second part to the project
    await Project.findOneAndUpdate({_id: event.project}, {$push: {events: id2}}); //add second part to the project - first try to find in bookingProject then in Project
    await BookingEvent.findOneAndUpdate({_id: id}, {$set: event}); //update first part - changed length
};

exports.joinEvents = async (id, event, id2, user) => { //TODO xBPx
    event._user = user;
    await BookingEvent.findOneAndUpdate({_id: id}, {$set: event}); //update first part by joined data
    await BookingEvent.findOneAndDelete({_id: id2}, {_user: user}); //remove second part
    await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: id2}});
    await Project.findOneAndUpdate({_id: event.project}, {$pull: {events: id2}}); //first try to find in bookingProject then in Project
};

// *******************************************************************************************
// PROJECTS
// *******************************************************************************************
exports.addProject = async (id, project, user) => {
    project._id = id;
    project._user = user;
    const updatedProject = await updateBudgetMinutes(project);
    const createdProject = await BookingProject.create(updatedProject); //!!!!! Create from booking - so just r&d project TODO test if it is R&D
    return dataHelper.normalizeDocument(createdProject, true);
};

exports.updateProject = async (id, project, user) => { //TODO xBPx
    const newProject = await updateBudgetMinutes(project);
    //PROJECTS DATA - Update from Booking - project is ver2 - Projects data structure
    if(project.version === 2) {
        const oldProject = await Project.findOne({_id: id});
        const oldBookingProject = projectToBooking(oldProject);
        if(oldProject) {
            updateProjectByBooking(oldProject, project);
            oldProject._user = user;
            await oldProject.save();
            return {oldProject: dataHelper.normalizeDocument(oldBookingProject, true), newProject: newProject};
        }
    //BOOKING DATA - Update from Booking - project is Booking data structure
    } else {
        const oldProject = await BookingProject.findOneAndUpdate({_id: id}, {$set: newProject}, {_user: user});
        return {oldProject: dataHelper.normalizeDocument(oldProject, true), newProject: newProject};
    }
};

function updateProjectByBooking(project, booking) {
    // name <- label
    if(booking.label !== undefined) project.name = booking.label;
    // bookingNote -> bookingNotes
    if(booking.bookingNotes !== undefined) project.bookingNote = booking.bookingNotes;
    // team <- producer, manager, supervisor, lead2D, lead3D, leadMP
    let team = project.team.reduce((out, teamMember) => {
        teamMember.role.forEach(role => out[role] = teamMember.id);
        return out;
    }, {});
    if(booking.producer) team['PRODUCER'] = booking.producer; else delete team['PRODUCER'];
    if(booking.manager) team['MANAGER'] = booking.manager; else delete team['MANAGER'];
    if(booking.supervisor) team['SUPERVISOR'] = booking.supervisor; else delete team['SUPERVISOR'];
    if(booking.lead2D) team['LEAD_2D'] = booking.lead2D; else delete team['LEAD_2D'];
    if(booking.lead3D) team['LEAD_3D'] = booking.lead3D; else delete team['LEAD_3D'];
    if(booking.leadMP) team['LEAD_MP'] = booking.leadMP; else delete team['LEAD_MP'];
    //not implemented yet
    if(booking.manager2) team['MANAGER_2'] = booking.manager2; else delete team['MANAGER_2'];
    if(booking.supervisor2) team['SUPERVISOR_2'] = booking.supervisor2; else delete team['SUPERVISOR_2'];
    if(booking.colorist) team['COLORIST'] = booking.colorist; else delete team['COLORIST'];
    if(booking.director) team['DIRECTOR'] = booking.director; else delete team['DIRECTOR'];
    // ---------
    team = Object.keys(team).reduce((out, role) => {
        if(!out[team[role]]) out[team[role]] = [];
        out[team[role]].push(role);
        return out
    }, {});
    project.team = Object.keys(team).map(id => ({id: id, role: team[id]}));
    //logger.debug(JSON.stringify(project.team));
    // timingClient, timingUpp <- timingClient, timingUpp
    if(booking.timingClient !== undefined) project.timingClient = booking.timingClient;
    if(booking.timingUpp !== undefined) project.timingUpp = booking.timingUpp;
}

exports.removeProject = async (id, user) => {
    await BookingProject.findOneAndUpdate({_id: id}, {$set : {deleted: new Date(), _user: user}});//!!!!! Remove from booking - so just r&d project TODO test if it is R&D
};

// *******************************************************************************************
// RESOURCES
// *******************************************************************************************
exports.addResource = async (id, resource, user) => {
    resource._id = id;
    resource._user = user;
    await BookingResource.create(resource);
    await BookingGroup.findOneAndUpdate({_id: resource.group}, {$push : {members: id}});
    if(resource.pair) await BookingResource.findOneAndUpdate({_id: resource.pair},{$set: {pair: id}});
    return [await exports.getResourceGroups(), await exports.getResources()];
};

exports.updateResource = async (id, resource, user) => {
    resource._user = user;
    let oldResource = await BookingResource.findOneAndUpdate({_id: id}, {$set: resource});
    oldResource = dataHelper.normalizeDocument(oldResource);
    const groupsChanged = resource.group != oldResource.group;
    if(groupsChanged) {
        await BookingGroup.findOneAndUpdate({_id: oldResource.group}, {$pull: {members: id}});
        await BookingGroup.findOneAndUpdate({_id: resource.group}, {$push: {members: id}});
    }
    if(resource.pair != oldResource.pair) {
        if(oldResource.pair !== null) await BookingResource.findOneAndUpdate({_id: oldResource.pair}, {$set: {pair: null}});
        if(resource.pair !== null) await BookingResource.findOneAndUpdate({_id: resource.pair}, {$set: {pair: id}});
    }
    if(groupsChanged) return [await exports.getResourceGroups(), await exports.getResources(), oldResource];
    else return [null, await exports.getResources(), oldResource];
};

exports.removeResource = async (id, user) => {
    const numberOfEvents = await exports.getNumberOfEventsForResource(id);
    const resource = await BookingResource.findOne({_id: id});
    resource._user = user;
    if(numberOfEvents > 0) {
        resource.deleted = true;
        resource.disabled = true;
        const resourcePair = resource.pair;
        resource.pair = null;
        await resource.save();
        if(resourcePair) await BookingResource.findOneAndUpdate({_id: resourcePair}, {$set: {pair: null}});
    } else {
        await resource.remove({_user: user});
        await BookingGroup.findOneAndUpdate({_id: resource.group}, {$pull: {members: resource._id}});
        if(resource.pair) await BookingResource.findOneAndUpdate({_id: resource.pair}, {$set: {pair: null}});
    }
    return [await exports.getResourceGroups(), await exports.getResources()];
};

exports.reorderResource = async (id1, members1, id2, members2, id3, user) => { //from group + members, to group + members, id of moved resource if between groups
    await BookingGroup.findOneAndUpdate({_id: id1}, {$set:{members: members1, _user: user}});
    if(id2) {
        await BookingGroup.findOneAndUpdate({_id: id2}, {$set:{members: members2}});
        await BookingResource.findOneAndUpdate({_id: id3}, {$set:{group: id2}});
        return [await exports.getResourceGroups(), await exports.getResources()];
    } else return await exports.getResourceGroups();
};

exports.getNumberOfEventsForResource = async id => {
    return await BookingEvent.find({$or : [{operator : id}, {facility: id}]}).countDocuments();
};

// *******************************************************************************************
// GROUPS
// *******************************************************************************************
exports.addGroup = async (id, group, user) => {
    group._id = id;
    group._user = user;
    await BookingGroup.create(group);
    return await exports.getResourceGroups();
};

exports.updateGroup = async (id, group, user) => {
    group._user = user;
    await BookingGroup.findOneAndUpdate({_id: id}, {$set: group});
    return await exports.getResourceGroups();
};

exports.removeGroup = async (id, user) => {
    await BookingGroup.findOneAndDelete({_id: id}, {_user: user});
    return await exports.getResourceGroups();
};

exports.reorderGroups = async (order, user) => {
    await Promise.all(order.map((id, i) => BookingGroup.findOneAndUpdate({_id: id}, {$set:{order: i, _user: user}})));
    return await exports.getResourceGroups();
};

// *******************************************************************************************
// K2
// *******************************************************************************************
exports.getK2linkedProjects = async () => { //TODO xBPx
    const bookingProjects = await BookingProject.find({deleted: null, mergedToProject: null, K2rid: { $ne: null}}, {K2rid: true, _id: false}).lean();
    const projects = await Project.find({deleted: null, booking: true, 'K2.rid': {$ne: null}}, {K2: true, _id: false}).lean();
    return bookingProjects.map(project => project.K2rid).concat(projects.map(project => project.K2.rid));
};

// *******************************************************************************************
// BUDGETS
// *******************************************************************************************
async function updateBudgetMinutes(project) {
    if(project && project.budget && project.budget.toString() !== '000000000000000000000000') { //budget will never be linked 00000...
        const budgetMinutes = await exports.getBudgetMinutes(project.budget);
        project.jobs.forEach(job => {
            if (budgetMinutes.jobs[job.job]) {
                job.plannedDuration = budgetMinutes.jobs[job.job];
                budgetMinutes.jobs[job.job] = -1;
            }
        });
        Object.keys(budgetMinutes.jobs).forEach(jobId => {
            if (budgetMinutes.jobs[jobId] >= 0) project.jobs.push({
                job: jobId,
                plannedDuration: budgetMinutes.jobs[jobId],
                doneDuration: 0
            })
        });
        project.jobs = project.jobs.filter(job => job.doneDuration > 0 || job.plannedDuration > 0);
        project.kickBack = budgetMinutes.kickBack;
    }
    return project;
}

exports.getBudgetMinutes = async budgetId => {
    let result = {kickBack: false, jobs: {}};
    const budget = await Budget.findOne({_id: budgetId}, {parts: true, client: true}).populate('parts').lean();
    if(budget) {
        budget.parts.filter(part => part.active).forEach(part => {
            part.items.forEach(item => {
                if(!item.isGroup && item.job && item.numberOfUnits > 0 && item.unitDuration > 0) {
                    if (!result.jobs[item.job]) result.jobs[item.job] = 0;
                    let minutes = item.numberOfUnits * item.unitDuration;
                    if(item.generalPrice && item.generalPrice > 0 && item.generalPrice > item.price) {
                        minutes = Math.round(minutes * (item.price / item.generalPrice));
                        result.kickBack = true;
                    }
                    result.jobs[item.job] += minutes;
                }
            })
        });
        if(budget.client && mongoose.Types.ObjectId.isValid(budget.client)) {
            const kickBack = await BudgetClient.findOne({_id: budget.client}, {kickBack: true}).lean();
            if(kickBack) {
                result.kickBack = result.kickBack || !!kickBack.kickBack;
                if (kickBack.kickBack) {
                    Object.keys(result.jobs).forEach(jobKey => {
                        result.jobs[jobKey] = Math.round(result.jobs[jobKey] * (1 - kickBack.kickBack));
                    })
                }
            }
        }
    }
    return result;
};

exports.getBudgetLabel = async budgetId => {
    const budget = await Budget.findOne({_id: budgetId}, {label: true, version: true}).lean();
    if(budget) {
        return `${budget.label}${budget.version ? ` - ${budget.version}` : ''}`
    } else return '';
};

exports.getAvailableBudgets = async projectId => { //TODO xBPx
    const bookingProjects = await BookingProject.find({budget: {$ne: null}, deleted: null, mergedToProject: null}, {budget: true}).lean();
    const projects1 = await Project.find({booking: true, bookingBudget: {$ne: null}, deleted: null}, {bookingBudget: true}).lean();
    const projects2 = await Project.find({booking: true, clientBudget: {$ne: null}, deleted: null}, {clientBudget: true}).lean();
    const linkedBudgets = bookingProjects.filter(project => project._id !== projectId).map(project => project.budget).concat(projects1.filter(project => project._id !== projectId).map(project => project.bookingBudget)).concat(projects2.filter(project => project._id !== projectId).map(project => project.clientBudget));
    const budgets = await Budget.find({deleted: null, _id: {$nin: linkedBudgets}}, {label: true, version: true}).lean();
    return budgets.map(budget => ({id: budget._id, label: `${budget.label}${budget.version ? ` - ${budget.version}` : ''}`})).sort(dataHelper.sortByLabel)
};

// *********************************************************************************************************************
// PRODUCTION LOGIN PIN
// *********************************************************************************************************************
exports.changeUserPin = async (id, group, pin, user) => {
    const users = await User.find().lean();
    const isFree = users.reduce((isFree, user) => {
        if(!user.isGroup && user.pinGroupId == group) {
            const hash = crypto.createHash('md5').update(user._id + pin).digest("hex");
            if(hash == user.pinHash) return false;
            else return isFree;
        } else return isFree;
    }, true);
    if(isFree) {
        const hash = crypto.createHash('md5').update(id + pin).digest("hex");
        await  User.findOneAndUpdate({_id: id}, {$set: {pinHash: hash, _user: user}});
        return await exports.getUsers();
    } else throw new Error('Can\'t use this pin');
};




