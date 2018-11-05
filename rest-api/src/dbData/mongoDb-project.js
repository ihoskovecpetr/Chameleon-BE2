'use strict';
const mongoose = require('mongoose');
const nanoid = require('nanoid/generate');
const NANOID_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';
const NANOID_LENGTH = 10;

//Collections
const Project = require('../models/project');
const Person = require('../models/contact-person');
const Company = require('../models/contact-company');
const User = require('../models/user');

// *******************************************************************************************
// PROJECTS CRUD
// *******************************************************************************************
exports.createProject = async (projectData, user) => {
    projectData.projectId = nanoid(NANOID_ALPHABET, NANOID_LENGTH);
    projectData._user = user;
    const project = await Project.create(projectData);
    const result = project.toJSON();
    delete result.__v;
    return result;
};

exports.getProjects = async () => {
    const projects = await Project.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(projects.map(project => Project.getHistory(project._id, '/name', {unique: true, limit: 3})));
    return projects.map((project, i) => {
        project.$name = histories[i];
        return project;
    });
};

exports.updateProject = async (id, projectData, user) => {
    projectData._user = user;
    const project = await Project.findByIdAndUpdate(id, projectData, {new: true});
    const result = project.toJSON();
    delete result.__v;
    result.$name = await Project.getHistory(project._id, '/name', {unique: true, limit: 3});
    return result;
};

exports.removeProject = async (id, user) => {
    await Project.findByIdAndUpdate(id, {deleted: new Date(), _user: user});
};

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
    const persons = await Person.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(persons.map(person => Person.getHistory(person._id, '/name', {unique: true, limit: 3})));
    return persons.map((person, i) => {
        person.$name = histories[i];
        return person;
    });
};

exports.updatePerson = async (id, personData, user) => {
    personData._user = user;
    const person = await Person.findByIdAndUpdate(id, personData);
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
    result.$name = await Person.getHistory(person._id, '/name', {unique: true, limit: 3});
    return result;
};

exports.removePerson = async (id, user) => {
    await Person.findByIdAndUpdate(id, {deleted: new Date(), _user: user});
    await Company.update({person: id}, {$pull: {person: id}}, {multiple: true});
    /*
    const companies = await Company.find({person: id}, {person: true});
    companies.forEach(async company => {
        company.person = company.person.filter(person => person !== id);
        await company.save();
    });
    */
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
    const companies = await Company.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(companies.map(company => Person.getHistory(company._id, '/name', {unique: true, limit: 3})));
    return companies.map((company, i) => {
        company.$name = histories[i];
        return company;
    });
};

exports.updateCompany = async (id, companyData, user) => {
    companyData._user = user;
    const company = await Company.findByIdAndUpdate(id, companyData);
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
    result.$name = await Company.getHistory(company._id, '/name', {unique: true, limit: 3});
    return result;
};

exports.removeCompany = async (id, user) => {
    await Company.findByIdAndUpdate(id, {deleted: new Date(), _user: user});
    await Person.update({company: id}, {$pull: {company: id}}, {multiple: true});
    /*
    const persons = await Person.find({company: id}, {company: true});
    persons.forEach(async person => {
        person.company = person.company.filter(company => company !== id);
        await person.save();
    });
    */
};

// *******************************************************************************************
// USERS _R__
// *******************************************************************************************
exports.getUsers = async () => {
    return await User.find({},{name: true, role: true, ssoId: true}).lean();
};