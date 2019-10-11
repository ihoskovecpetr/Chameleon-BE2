'use strict';
const mongoose = require('mongoose');
const nanoid = require('nanoid/generate');
const NANOID_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';
const NANOID_LENGTH = 10;

//Collections
const User = require('../models/user');
const Project = require('../models/project');
const Person = require('../models/contact-person');
const Company = require('../models/contact-company');
const Booking = require('../models/booking-project');
const logger = require('../logger');


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
    if(projectData.booking) projectData = await linkBookingToProject(projectData);
    const project = await Project.create(projectData);
    return await normalizeProject(project);
};

exports.getProjects = async () => {
    return Project.find({deleted: null, archived: null},{__v: false}).populate({path: 'booking', select: {_id: true, label: true}}).lean(); //due to populate await is not necessary????
    /*const histories = await Promise.all(projects.map(project => Project.getHistory(project._id, '/name', {unique: true, limit: 3})));
    return projects.map((project, i) => {
        project.$name = histories[i];
        return project;
    });*/
};

exports.updateProject = async (id, projectData, user) => { //TODO projectData is only update, not full project data !!!!!!!!!!!!!!
    projectData._user = user;
    if(projectData.booking) projectData = await linkBookingToProject(projectData);
    const project = await Project.findOneAndUpdate({_id: id}, projectData, {new: true});
    return await normalizeProject(project);
};

exports.removeProject = async (id, user) => {
    await Project.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
    //TODO delete linked booking project as well? in case wamp update live
};

async function linkBookingToProject(projectSata) {
    if(!projectSata.booking._id) {
        //TODO create new booking from projectData and set _id to projectData.booking = booking._id, set at least team (manager)
        const bookingData = {
            label: projectSata.booking.label,
            manager: null,
            producer: null,
            supervisor: null,
            lead2D: null,
            lead3D: null,
            leadMP: null
        };
        if(projectSata.team) {
            for(const member of projectSata.team) {
                if(!bookingData.manager && member.role.indexOf('MANAGER') >= 0) bookingData.manager = member.id;
                if(!bookingData.producer && member.role.indexOf('PRODUCER') >= 0) bookingData.producer = member.id;
                if(!bookingData.supervisor && member.role.indexOf('SUPERVISOR') >= 0) bookingData.supervisor = member.id;
                if(!bookingData.lead2D && member.role.indexOf('LEAD_2D') >= 0) bookingData.lead2D = member.id;
                if(!bookingData.lead3D && member.role.indexOf('LEAD_3D') >= 0) bookingData.lead3D = member.id;
                if(!bookingData.leadMP && member.role.indexOf('LEAD_MP') >= 0) bookingData.leadMP = member.id;
            }
        }
        const booking = await Booking.create(bookingData);
        //TODO wamp add project to live booking - booking normalized project
        projectSata.booking = booking._id;
    } else {
        projectSata.booking = projectSata.booking._id;
        //TODO synchronize data from projects and booking in case of linked
    }
    return projectSata;
}

async function normalizeProject(project) {
    const result = project.toJSON();
    delete result.__v;
    //result.$name = await Project.getHistory(project._id, '/name', {unique: true, limit: 3});
    if(result.booking) {
        const booking = await Booking.findOne({_id: result.booking}, {_id: true, label: true}).lean();
        if(booking) result.booking = booking;
        else {
            result.booking = null;
            //TODO report that booking linked with project doesnt exists - should never happen => logger.warn()
        }
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
// BOOKING TO LINK WITH
// *******************************************************************************************
exports.getBookings = async id => {
    const projectsWithLinkedBooking = await Project.find({booking: {$ne: null}}, {booking: true}).lean();
    const linkedBookings = projectsWithLinkedBooking.map(project => project.booking.toString());
    const bookings = await Booking.find({deleted: null, offtime: false}, {label: true}).lean();
    return bookings.filter(booking => linkedBookings.indexOf(booking._id.toString()) < 0).map(booking => ({value: booking._id.toString(), label: booking.label}));
};