'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../models/user');
const Project = require('../models/project');
const Person = require('../models/contact-person');
const Company = require('../models/contact-company');

// *******************************************************************************************
// get projects
// *******************************************************************************************
exports.getProjects = async () => {
    const projects = await Project.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(projects.map(project => Project.getHistory(project._id, '/name', {unique: true, limit: 3})));
    return projects.map((project, i) => {
        project.$name = histories[i];
        return project;
    });
};

// *******************************************************************************************
// get persons
// *******************************************************************************************
exports.getPersons = async () => {
    const persons = await Person.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(persons.map(person => Person.getHistory(person._id, '/name', {unique: true, limit: 3})));
    return persons.map((person, i) => {
        person.$name = histories[i];
        return person;
    });
};

// *******************************************************************************************
// get companies
// *******************************************************************************************
exports.getCompanies = async () => {
    const companies = await Company.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(companies.map(company => Person.getHistory(company._id, '/name', {unique: true, limit: 3})));
    return companies.map((company, i) => {
        company.$name = histories[i];
        return company;
    });
};

// *******************************************************************************************
// get upp users + role, name, uid
// *******************************************************************************************
exports.getUsersRole = async () => {
    return await User.find({}, {role: true, name: true, ssoId: true}).lean();
};