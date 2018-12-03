'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-projects');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const PROJECTS_ACCESS_FULL = ['projects:full'];

module.exports = router;

// *********************************************************************************************************************
// PROJECTS
// *********************************************************************************************************************
router.get('/', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const projects = await db.getProjects();
        res.status(200).json(projects);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// PERSONS
// *********************************************************************************************************************
router.get('/persons', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const persons = await db.getPersons();
        res.status(200).json(persons);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// COMPANIES
// *********************************************************************************************************************
router.get('/companies', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const companies = await db.getCompanies();
        res.status(200).json(companies);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// UPP USERS
// *********************************************************************************************************************
router.get('/users/role', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const users = await db.getUsersRole();
        res.status(200).json(users);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});