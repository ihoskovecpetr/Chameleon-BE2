'use strict';
const mongoose = require('mongoose');
const dataHelper = require('../lib/dataHelper');
//const logger = require('../logger');
const crypto = require('crypto');

//Collections
const BookingGroup = require('../models/booking-group');
const BookingResource = require('../models/booking-resource');
const Holiday = require('../models/holiday');
const BookingProject = require('../models/booking-project');
const BookingEvent = require('../models/booking-event');
const BookingWorkType = require('../models/booking-work-type');
const User = require('../models/user');
const BookingOplog = require('../models/booking-oplog');

const Budget = require('../models/budget');
const BudgetClient = require('../models/budget-client');
require('../models/budget-item');

exports = module.exports;
// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
exports.logOp = async (type, user, data, err) => {
    await BookingOplog.create({type: type, user: user, data: data, success: !err, reason: err});
};

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

exports.getProjects = async () => {
    const projects = await BookingProject.find({deleted: null, archived: false},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false }).lean();
    return dataHelper.getObjectOfNormalizedDocs(projects);
};

exports.getEvents = async () => {
    const projects = await BookingProject.find({deleted: null, archived: false}, {_id: true}).lean();
    const projectIds = projects.map(project => project._id);
    const events = await BookingEvent.find({project: {$in: projectIds}, archived: false},{__v: false, 'days.__v': false, 'days._id': false, archived: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(events);
};

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
exports.addEvent = async (id, event, noAddToProject) => {
    event._id = id;
    await BookingEvent.create(event);
    if(!noAddToProject) await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}});
};

exports.updateEvent = async (id, event) => {
    const oldEvent = await BookingEvent.findOneAndUpdate({_id: id}, {$set: event});
    if(oldEvent.project && oldEvent.project.toString() !== event.project) await Promise.all([
        BookingProject.findOneAndUpdate({_id: oldEvent.project}, {$pull: {events: id}}),
        BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}})
    ]);
    return dataHelper.normalizeDocument(oldEvent, true);
};

exports.removeEvent = async id => {
    const event = await BookingEvent.findByIdAndRemove(id);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: id}});
};

exports.splitEvent = async (id, event, id2, event2) => {
    event2._id = id2;
    await BookingEvent.create(event2);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id2}}); //add second part to the project
    await BookingEvent.findOneAndUpdate({_id: id}, {$set: event}); //update first part - changed length
};

exports.joinEvents = async (id, event, id2) => {
    await BookingEvent.findOneAndUpdate({_id: id}, {$set: event}); //update first part by joined data
    await BookingEvent.findOneAndRemove({_id: id2}); //remove second part
    await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: id2}}); //remove second part from the project
};

// *******************************************************************************************
// PROJECTS
// *******************************************************************************************
exports.addProject = async (id, project) => {
    project._id = id;
    const updatedProject = await updateBudgetMinutes(project);
    const createdProject = await BookingProject.create(updatedProject);
    return dataHelper.normalizeDocument(createdProject, true);
};

exports.updateProject = async (id, project) => {
    const newProject = await updateBudgetMinutes(project);
    const oldProject = await BookingProject.findOneAndUpdate({_id: id}, {$set: project});
    return {oldProject: dataHelper.normalizeDocument(oldProject, true), newProject: newProject};
};

exports.removeProject = async id => {
    await BookingProject.findOneAndUpdate({_id: id}, {$set : {deleted: new Date()}});
};

// *******************************************************************************************
// RESOURCES
// *******************************************************************************************
exports.addResource = async (id, resource) => {
    resource._id = id;
    await BookingResource.create(resource);
    await BookingGroup.findOneAndUpdate({_id: resource.group}, {$push : {members: id}});
    if(resource.pair) await BookingResource.findOneAndUpdate({_id: resource.pair},{$set: {pair: id}});
    return [await exports.getResourceGroups(), await exports.getResources()];
};

exports.updateResource = async (id, resource) => {
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

exports.removeResource = async id => {
    const numberOfEvents = await exports.getNumberOfEventsForResource(id);
    const resource = await BookingResource.findOne({_id: id});
    if(numberOfEvents > 0) {
        resource.deleted = true;
        resource.disabled = true;
        if(resource.pair) await BookingResource.findOneAndUpdate({_id: resource.pair}, {$set: {pair: null}});
        resource.pair = null;
        await resource.save();
    } else {
        await resource.remove();
        await BookingGroup.findOneAndUpdate({_id: resource.group}, {$pull: {members: resource._id}});
        if(resource.pair) await BookingResource.findOneAndUpdate({_id: resource.pair}, {$set: {pair: null}});
    }
    return [await exports.getResourceGroups(), await exports.getResources()];
};

exports.reorderResource = async (id1, members1, id2, members2, id3) => { //from group + members, to group + members, id of moved resource if between groups
    await BookingGroup.findOneAndUpdate({_id: id1}, {$set:{members: members1}});
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
exports.addGroup = async (id, group) => {
    group._id = id;
    await BookingGroup.create(group);
    return await exports.getResourceGroups();
};

exports.updateGroup = async (id, group) => {
    await BookingGroup.findOneAndUpdate({_id: id}, {$set: group});
    return await exports.getResourceGroups();
};

exports.removeGroup = async id => {
    await BookingGroup.findOneAndRemove({_id: id});
    return await exports.getResourceGroups();
};

exports.reorderGroups = async order => {
    await Promise.all(order.map((id, i) => BookingGroup.findOneAndUpdate({_id: id}, {$set:{order:i}})));
    return await exports.getResourceGroups();
};

// *******************************************************************************************
// K2
// *******************************************************************************************
exports.getK2linkedProjects = async () => {
    const projects = await BookingProject.find({deleted: null, K2rid: { $ne: null}}, {K2rid: true, _id: false}).lean();
    return projects.map(project => project.K2rid);
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
                    result.jobs[item.job] += item.numberOfUnits * item.unitDuration;
                }
            })
        });
        if(budget.client && mongoose.Types.ObjectId.isValid(budget.client)) {
            const kickBack = await BudgetClient.findOne({_id: budget.client}, {kickBack: true}).lean();
            if(kickBack) {
                result.kickBack = !!kickBack.kickBack;
                if (kickBack.kickBack) {
                    Object.keys(result.jobs).forEach(jobKey => {
                        result.jobs[jobKey] = Math.round(result.jobs[jobKey] * (1 - kickBack.kickBack)); //TODO double check
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

exports.getAvailableBudgets = async projectId => {
    const projects = await BookingProject.find({budget: {$ne: null}, deleted: null}, {budget: true}).lean();
    const linkedBudgets = projects.filter(project => project._id != projectId).map(project => project.budget);
    const budgets = await Budget.find({deleted: null, _id: {$nin: linkedBudgets}}, {label: true, version: true}).lean();
    return budgets.map(budget => ({id: budget._id, label: `${budget.label}${budget.version ? ` - ${budget.version}` : ''}`})).sort(dataHelper.sortByLabel)
};

// *********************************************************************************************************************
// PRODUCTION LOGIN PIN
// *********************************************************************************************************************
exports.changeUserPin = async (id, group, pin) => {
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
        await  User.findOneAndUpdate({_id: id}, {$set: {pinHash: hash}});
        return await exports.getUsers();
    } else throw new Error('Can\'t use this pin');
};



