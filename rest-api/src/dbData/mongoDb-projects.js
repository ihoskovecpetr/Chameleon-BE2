'use strict';
const mongoose = require('mongoose');
const nanoid = require('nanoid/generate');
const NANOID_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';
const NANOID_LENGTH = 10;

//Collections
const User = require('../../_common/models/user');
const Project = require('../../_common/models/project');
const Person = require('../../_common/models/contact-person');
const Company = require('../../_common/models/contact-company');
const BookingProject = require('../../_common/models/booking-project');
const BookingEvent = require('../../_common/models/booking-event');
const PusherTask = require('../../_common/models/pusher-task');
const PusherWorkLog = require('../../_common/models/pusher-worklog');
const BookingWorkType = require('../../_common/models/booking-work-type');
const Budget = require('../../_common/models/budget');
const logger = require('../logger');


const dataHelper = require('../../_common/lib/dataHelper');
const dateHelper = require('../../_common/lib/dateHelper');
const projectToBooking = require('../../_common/lib/projectToBooking');
const budgetDb = require("./mongoDb-budget");

// *******************************************************************************************
// GET ALL DATA
// *******************************************************************************************
exports.getData = async () => {
    const projects = await exports.getProjects();
    const persons = await exports.getPersons();
    const companies = await exports.getCompanies();
    const users = await exports.getUsersRole();
    const work = await exports.getWorkMap();
    return {projects, persons, companies, users, work}
};

// *******************************************************************************************
// PROJECTS CRUD
// *******************************************************************************************
exports.createProject = async (projectData, user) => {
    projectData.projectId = nanoid(NANOID_ALPHABET, NANOID_LENGTH);
    projectData._user = user;

    if(projectData.bookingId && projectData.bookingId._id) projectData.bookingId = projectData.bookingId._id;
    if(projectData.bookingBudget && projectData.bookingBudget._id) projectData.bookingBudget = projectData.bookingBudget._id;
    if(projectData.clientBudget  && projectData.clientBudget._id)  projectData.clientBudget = projectData.clientBudget._id;
    //TODO sentBudget []
    const work = projectData.work ? [...projectData.work] : null;
    delete projectData.work;
    const project = await Project.create(projectData);
    await updateProjectHours(project, work);
    let booking = null;
    if(projectData.bookingId) {
        booking = await BookingProject.findOneAndUpdate({_id: projectData.bookingId}, {mergedToProject: project._id});
        await BookingEvent.updateMany({project: projectData.bookingId}, {$set: {project: project._id}});
        await PusherTask.updateMany({project: projectData.bookingId}, {$set: {project: project._id}});
        await PusherWorkLog.updateMany({project: projectData.bookingId}, {$set: {project: project._id}});
    }
    return {project: await normalizeProject(project), booking: booking};
};

exports.getProject = async id => {
    const project = await Project.findOne({_id: id}, {__v: false}).lean().populate({path: 'bookingId', select: {_id: true, label: true}});
    if(project) {
        project.bookingBudget = await budgetDb.getBudgetForProject(project.bookingBudget);
        project.clientBudget = await budgetDb.getBudgetForProject(project.clientBudget);
        //TODO sentBudget []
    }
    return project;
};

exports.getProjects = async () => {
    const projects = await Project.find({deleted: null, archived: null}, {__v: false}).lean().populate({path: 'bookingId', select: {_id: true, label: true}});
    for(const project of projects) {
        project.bookingBudget = await budgetDb.getBudgetForProject(project.bookingBudget);
        project.clientBudget = await budgetDb.getBudgetForProject(project.clientBudget);
        //TODO sentBudget []
    }
    return projects;
};

exports.updateProject = async (id, updateData, user) => {
    updateData._user = user;

    if(updateData.bookingId && updateData.bookingId._id) updateData.bookingId = updateData.bookingId._id;
    if(updateData.bookingBudget && updateData.bookingBudget._id) updateData.bookingBudget = updateData.bookingBudget._id;
    if(updateData.clientBudget  && updateData.clientBudget._id)  updateData.clientBudget = updateData.clientBudget._id;
    //TODO sentBudget []
    //if(updateData.sentBudget && Array.isArray(updateData.sentBudget) && updateData.sentBudget.length > 0) updateData.sentBudget = updateData.sentBudget.map(budget => budget._id ? budget._id : budget);
    const work = updateData.work ? [...updateData.work] : null;
    delete updateData.work;
    const project = await Project.findOneAndUpdate({_id: id}, updateData, {new: true});
    await updateProjectHours(project, work);
    let booking = null;
    if(updateData.bookingId) {
        booking = await BookingProject.findOneAndUpdate({_id: updateData.bookingId}, {mergedToProject: id});
        await BookingEvent.updateMany({project: updateData.bookingId}, {$set: {project: id}});
        await PusherTask.updateMany({project: updateData.bookingId}, {$set: {project: id}});
        await PusherWorkLog.updateMany({project: updateData.bookingId}, {$set: {project: id}});
    } else if(updateData.budget && project.bookingId) { //needed only for budget to get previous state of budget.booking - so far
        booking = await BookingProject.findOne({_id: project.bookingId}).lean();
    }
    return {project: await normalizeProject(project), booking: booking};
};

exports.removeProject = async (id, user) => {
    const project = await Project.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
    return await normalizeProject(project);
};

exports.getProjectBookedData = async id => {
    const project = await Project.findOne({_id: id}, {events: true}).lean().populate({path: 'events', select: {startDate: true, job: true, efficiency: true, days: true}});
    if(project) {
        return project.events.reduce((out, event) => {
            if(event.job) {
                if(!out[event.job]) out[event.job] = {booked: 0, remains: 0};
                event.days.forEach(day => {
                    const dayDuration = day.duration * event.efficiency / 100;
                    out[event.job].booked += dayDuration;
                    if(dateHelper.isFutureEventDay(event.startDate, 1)) {
                        out[event.job].remains += dayDuration;
                    }
                });
            }
            return out;
        }, {});
    } else return null;
};

async function updateProjectHours(project, newWork) {
    if(project.bookingBudget || project.clientBudget) {
        const spentHoursMap = project.work && project.work.length > 0 ? project.work.reduce((out, work) => {out[work.type] = work.doneDuration; return out}, {}) : newWork && newWork.length > 0 ? newWork.reduce((out, work) => {out[work.type] = work.doneDuration; return out}, {}) : {};
        project.work = [];
        const budgetHoursMap = await budgetDb.getBudgetHoursMap(project.bookingBudget) || await budgetDb.getBudgetHoursMap(project.clientBudget) || {};
        Object.keys(budgetHoursMap).forEach(workId => {
            project.work.push({type: workId, plannedDuration: budgetHoursMap[workId], doneDuration: spentHoursMap[workId] ? spentHoursMap[workId] : 0});
            if(spentHoursMap[workId]) delete spentHoursMap[workId];
        });
        Object.keys(spentHoursMap).forEach(workId => {
            project.work.push({type: workId, plannedDuration: 0, doneDuration: spentHoursMap[workId]});
        });
        await project.save();
    } else if(newWork) {
        project.work = newWork.filter(work => work.plannedDuration || work.doneDuration);
        await project.save();
    }
}

async function normalizeProject(project) {
    if(!project) return project;
    const result = project.toJSON();
    delete result.__v;
    //result.$name = await Project.getHistory(project._id, '/name', {unique: true, limit: 3});
    if(result.bookingId) {
        const booking = await BookingProject.findOne({_id: result.bookingId}, {_id: true, label: true}).lean();
        if(booking) result.bookingId = booking;
    }
    result.bookingBudget = await budgetDb.getBudgetForProject(result.bookingBudget);
    result.clientBudget = await budgetDb.getBudgetForProject(result.clientBudget);
    //TODO sentBudget []
    return result;
}

// *******************************************************************************************
// PERSONS CRUD
// *******************************************************************************************
exports.createPerson = async (personData, user) => {
    personData._user = user;
    const person = await Person.create(personData);
    if(person.company && person.company.length > 0) await Company.update({_id: {$in: person.company}}, {$push: {person: person._id}}, {multi: true});
    const result = person.toObject();
    delete result.__v;
    return result;
};
exports.getPersons = async () => {
    return await Person.find({deleted: null, archived: null},{__v: false}).lean();
    /*
    const histories = await Promise.all(persons.map(person => Person.getHistory(person._id, '/name', {unique: true, limit: 3})));
    return persons.map((person, i) => {
        person.$name = histories[i];
        return person;
    });
    */
};

exports.updatePerson = async (id, personData, user) => {
    personData._user = user;
    const person = await Person.findOneAndUpdate({_id: id}, personData);
    if(personData.company) {
        const oldCompany = person.company.map(company => company.toString());
        const newCompany = personData.company;
        const addTo = newCompany.filter(company => oldCompany.indexOf(company) < 0);
        const removeFrom = oldCompany.filter(company => newCompany.indexOf(company) < 0);
        if(addTo.length > 0) await Company.update({_id: {$in: addTo}}, {$push: {person: id}}, {multi: true});
        if(removeFrom.length > 0) await Company.update({_id: {$in: removeFrom}}, {$pull: {person: id}}, {multi: true});
    }
    const result = person.toJSON();
    delete result.__v;
    Object.assign(result, personData);
    //result.$name = await Person.getHistory(person._id, '/name', {unique: true, limit: 3});
    return result;
};

exports.removePerson = async (id, user) => {
    await Person.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
    await Company.update({person: id}, {$pull: {person: id}}, {multiple: true});
};

// *******************************************************************************************
// COMPANIES CRUD
// *******************************************************************************************
exports.createCompany = async (companyData, user) => {
    companyData._user = user;
    const company = await Company.create(companyData);
    if(company.person && company.person.length > 0) await Person.update({_id: {$in: company.person}}, {$push: {company: company._id}}, {multi: true});
    const result = company.toObject();
    delete result.__v;
    return result;
};

exports.getCompanies = async () => {
    return await Company.find({deleted: null, archived: null},{__v: false}).lean();
    /*
    const histories = await Promise.all(companies.map(company => Person.getHistory(company._id, '/name', {unique: true, limit: 3})));
    return companies.map((company, i) => {
        company.$name = histories[i];
        return company;
    });
     */
};

exports.updateCompany = async (id, companyData, user) => {
    companyData._user = user;
    const company = await Company.findOneAndUpdate({_id: id}, companyData);
    if(companyData.person) {
        const oldPerson = company.person.map(person => person.toString());
        const newPerson = companyData.person;
        const addTo = newPerson.filter(person => oldPerson.indexOf(person) < 0);
        const removeFrom = oldPerson.filter(person => newPerson.indexOf(person) < 0);
        if(addTo.length > 0) await Person.update({_id: {$in: addTo}}, {$push: {company: id}}, {multi: true});
        if(removeFrom.length > 0) await Person.update({_id: {$in: removeFrom}}, {$pull: {company: id}}, {multi: true});
    }
    const result = company.toJSON();
    Object.assign(result, companyData);
    delete result.__v;
    //result.$name = await Company.getHistory(company._id, '/name', {unique: true, limit: 3});
    return result;
};

exports.removeCompany = async (id, user) => {
    await Company.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
    await Person.update({company: id}, {$pull: {company: id}}, {multiple: true});
};

// *******************************************************************************************
// UPP USERS - role, name, uid
// *******************************************************************************************
exports.getUsersRole = async () => {
    return await User.find({}, {role: true, name: true, ssoId: true}).lean();
};

// *******************************************************************************************
// GET BOOKING DATA
// *******************************************************************************************
exports.getBooking = async id => {
    const booking = await BookingProject.findOne({_id: id}, {created: false, deleted: false, mergedToProject: false, __v: false}).lean().populate({path: 'budget', select: {_id: true, label: true, version: true}});
    return dataHelper.normalizeDocument(booking);
};

// *******************************************************************************************
// BOOKING TO LINK WITH
// *******************************************************************************************
exports.getBookings = async () => {
    return await BookingProject.find({deleted: null, offtime: false, mergedToProject: null}, {label: true}).lean();
};

// *********************************************************************************************************************
// get normalized project for wamp (booking)
// *********************************************************************************************************************
exports.getNormalizedBookingProject = source => {
    const project = dataHelper.normalizeDocument(projectToBooking(source));
    const id = project._id.toString();
    delete project._id;
    return {id: id, project: project};
};

// *********************************************************************************************************************
// GET BOOKING EVENTS FOR ARRAY OF IDs
// *********************************************************************************************************************
exports.getBookingEvents = async ids => {
    if(!ids) ids = [];
    if(!Array.isArray(ids)) ids = [ids];
    const events = await BookingEvent.find({_id: {$in: ids}}, {__v: false, 'days.__v': false, 'days._id': false, archived: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(events);
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
// BUDGET
// *******************************************************************************************
exports.getAvailableBudgets = async projectId => { //TODO xBPx
    const bookingProjects = await BookingProject.find({budget: {$ne: null}, deleted: null, mergedToProject: null}, {budget: true}).lean();
    const projects1 = await Project.find({booking: true, bookingBudget: {$ne: null}, deleted: null}, {bookingBudget: true}).lean();
    const projects2 = await Project.find({booking: true, clientBudget: {$ne: null}, deleted: null}, {clientBudget: true}).lean();
    const linkedBudgets =  bookingProjects.map(p => p.budget).concat(projects1.map(p => p.bookingBudget)).concat(projects2.map(p => p.clientBudget));
    return await Budget.find({deleted: null, _id: {$nin: linkedBudgets}}, {label: true, version: true}).lean();
};
// *******************************************************************************************
// MISC
// *******************************************************************************************
exports.getWorkMap = async () => {
  const work = await BookingWorkType.find({bookable: true}, 'shortLabel').lean();
  return work.reduce((out, work) => {out[work._id] = work.shortLabel; return out}, {});
};