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
const logger = require('../logger');


const dataHelper = require('../../_common/lib/dataHelper');
const projectToBooking = require('../../_common/lib/projectToBooking');
//const moment = require('moment');

// *******************************************************************************************
// GET ALL DATA
// *******************************************************************************************
exports.getData = async () => {
    const projects = await exports.getProjects();
    const persons = await exports.getPersons();
    const companies = await exports.getCompanies();
    const users = await exports.getUsersRole();
    return {projects, persons, companies, users}
};

// *******************************************************************************************
// PROJECTS CRUD
// *******************************************************************************************
exports.createProject = async (projectData, user) => {
    projectData.projectId = nanoid(NANOID_ALPHABET, NANOID_LENGTH);
    projectData._user = user;
    if(projectData.bookingId && projectData.bookingId._id) projectData.bookingId = projectData.bookingId._id;
    const project = await Project.create(projectData);
    let booking = null;
    if(projectData.bookingId) {
        booking = await BookingProject.findOneAndUpdate({_id: projectData.bookingId}, {mergedToProject: project._id});
        await BookingEvent.updateMany({project: projectData.bookingId}, {$set: {project: project._id}});
    }
    return {project: await normalizeProject(project), booking: booking};
};

exports.getProjects = async () => {
    return Project.find({deleted: null, archived: null}, {__v: false}).populate({path: 'bookingId', select: {_id: true, label: true}}).lean(); //due to populate await is not necessary????
    /*const histories = await Promise.all(projects.map(project => Project.getHistory(project._id, '/name', {unique: true, limit: 3})));
    return projects.map((project, i) => {
        project.$name = histories[i];
        return project;
    });*/
};

exports.updateProject = async (id, updateData, user) => {
    updateData._user = user;
    if(updateData.bookingId && updateData.bookingId._id) updateData.bookingId = updateData.bookingId._id;
    const project = await Project.findOneAndUpdate({_id: id}, updateData, {new: true});
    let booking = null;
    if(updateData.bookingId) {
        booking = await BookingProject.findOneAndUpdate({_id: updateData.bookingId}, {mergedToProject: id});
        await BookingEvent.updateMany({project: updateData.bookingId}, {$set: {project: id}});
    } else if(updateData.budget && project.bookingId) { //needed only for budget to get previous state of budget.booking - so far
        booking = await BookingProject.findOne({_id: project.bookingId}).lean();
    }
    return {project: await normalizeProject(project), booking: booking};
};

exports.removeProject = async (id, user) => {
    const project = await Project.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
    return await normalizeProject(project);
};

async function normalizeProject(project) {
    const result = project.toJSON();
    delete result.__v;
    //result.$name = await Project.getHistory(project._id, '/name', {unique: true, limit: 3});
    if(result.bookingId) {
        const booking = await BookingProject.findOne({_id: result.bookingId}, {_id: true, label: true}).lean();
        if(booking) result.bookingId = booking;
    }
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
    const booking = await BookingProject.findOne({_id: id}, {created: false, deleted: false, mergedToProject: false, __v: false}).lean();
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