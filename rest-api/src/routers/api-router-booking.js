'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-booking');
const wamp = require('../wamp');
const validateToken = require('../validateToken');
const logger = require('../logger');

module.exports = router;

// *********************************************************************************************************************
// GET INIT DATA
// *********************************************************************************************************************
router.get('/initData', validateToken,  async (req, res, next) => {
    try {
        const start = Date.now();
        logger.debug(`Requested booking init data. User: ${req.remote_user_name} (${req.remote_user})`);
        const groups = await db.getResourceGroups();
        const resources = await db.getResources();
        const holidays = await db.getHolidays();
        const projects = await db.getProjects();
        const events = await db.getEvents(Object.keys(projects));
        const jobs = await db.getJobs();
        const users = await db.getUsers();
        let lockedEvents = [];
        if(!!wamp.getSession()) lockedEvents = await wamp.getSession().call('getBookingLockedEvents');
        else logger.warn(`getBookingLockedEvents - no wamp connection`);
        logger.debug(`getData time: ${Date.now() - start}ms`);
        const data = {groups, resources, holidays, projects, events, jobs, users, lockedEvents};
        res.status(200).json(data);
    } catch(error) {
        logger.debug(`${error}`);
        next(JSON.stringify(error));
    }
});