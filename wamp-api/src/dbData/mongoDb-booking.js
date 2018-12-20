'use strict';
const mongoose = require('mongoose');
const dataHelper = require('../lib/dataHelper');
//const logger = require('../logger');

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
    const projects = await BookingProject.find({deleted: null},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false }).lean();
    return dataHelper.getObjectOfNormalizedDocs(projects);
};

exports.getEvents = async () => {
    const projects = await BookingProject.find({deleted: null}, {_id: true}).lean();
    const projectIds = projects.map(project => project._id);
    const events = await BookingEvent.find({project: {$in: projectIds}},{__v: false, 'days.__v': false, 'days._id': false}).lean();
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
            result.kickBack = !!kickBack.kickBack;
            if(kickBack.kickBack) {
                Object.keys(result.jobs).forEach(jobKey => {
                    result.jobs[jobKey] = Math.round(result.jobs[jobKey] * (1 - kickBack.kickBack)); //TODO double check
                })
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



