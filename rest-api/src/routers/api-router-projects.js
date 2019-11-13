'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-projects');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');
const shouldUpdateBooking = require('../shouldUpdateBooking');

const dataHelper = require('../../_common/lib/dataHelper');
const wamp = require('../wamp');
const logger = require('../logger');

const PROJECTS_ACCESS_FULL = ['projects:full'];

module.exports = router;

// *********************************************************************************************************************
// PROJECTS ALL-DATA
// *********************************************************************************************************************
router.get('/data', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const result = await db.getData();
        res.status(200).json(result);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// PROJECTS CRUD
// *********************************************************************************************************************
router.post('/', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    let result;
    try {
        if(!req.body) {
            const error = new Error('Projects - create. Missing project data.');
            error.statusCode = 400;
            next(error);
        } else {
            result = await db.createProject(req.body, req.remote_user);
            res.status(201).json(result.project);
        }
    } catch(error) {
        next(error);
    }
    try {
        if (result.project.booking || result.project.bookingId) {
            if (result.project.booking && result.project.bookingId) {//update project
                wamp.publish('exchangeProject', [], {new: db.getNormalizedBookingProject(result.project), old: {id: result.booking._id, project: dataHelper.normalizeDocument(result.booking, true)}});
            } else if (result.project.booking) {//create project
                wamp.publish('addProject', [], db.getNormalizedBookingProject(result.project));
            } else if (result.project.bookingId) {//remove project
                wamp.publish('removeProject', [], {id: result.booking._id, project: dataHelper.normalizeDocument(result.booking, true)});
            }
            //todo publish K2check, updatePusherData, pusherCheck, projectBudgetChanged
        }
    } catch(error) {
        logger.warn(`Create project - update booking error: ${error}`);
    }
});
// *********************************************************************************************************************
// GET
// *********************************************************************************************************************
//get all projects
router.get('/', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const result = await db.getProjects();
        res.status(200).json(result);
    } catch(error) {
        next(error);
    }
});
// all booking projects to link with
router.get('/booking', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const bookings = await db.getBookings();
        res.status(200).json(bookings);
    } catch(error) {
        next(error);
    }
});
//get single project
router.get('/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
   try {
       const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
       if(!id) {
           const error = new Error('Projects - get single project. Wrong or mismatched project id.');
           error.statusCode = 400;
           next(error);
       } else {
           const result = await db.getProject(id);
           res.status(200).json(result);
       }
   } catch(error) {
       next(error);
   }
});
// single booking project
router.get('/booking/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Projects/booking - get data. Wrong booking id.');
            error.statusCode = 400;
            next(error);
        } else {
            const booking = await db.getBooking(id);
            if(!booking) {
                const error = new Error(`Projects/booking - get data. Booking id [${id}] not found.`);
                error.statusCode = 400;
                next(error);
            } else res.status(200).json(booking);
        }
    } catch(error) {
        next(error);
    }
});
// ************************
router.put('/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    let result;
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id || !req.body || (req.body._id && req.body._id !== id)) {
            const error = new Error('Projects - update. Wrong or mismatched project id or missing data.');
            error.statusCode = 400;
            next(error);
        } else {
            result = await db.updateProject(id, req.body, req.remote_user);
            res.status(200).json(result.project);
        }
    } catch(error) {
        next(error);
    }
    try {
        switch (shouldUpdateBooking(req.body, result.booking)) {
            case 'add':
                const data = db.getNormalizedBookingProject(result.project);
                data.events = await db.getBookingEvents(result.project.events);
                wamp.publish('addProject', [], data);
                break;
            case 'remove':
                wamp.publish('removeProject', [], db.getNormalizedBookingProject(result.project));
                break;
            case 'update':
                wamp.publish('updateProject', [], db.getNormalizedBookingProject(result.project));
                break;
            case 'exchange':
                wamp.publish('exchangeProject', [], {new: db.getNormalizedBookingProject(result.project), old: {id: result.booking._id, project: dataHelper.normalizeDocument(result.booking, true)}});
                break;
        }
        //todo publish K2check, updatePusherData, pusherCheck, projectBudgetChanged
    } catch(error) {
        logger.warn(`Update project - update booking error: ${error}`);
    }
});

router.delete('/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Projects - delete. Wrong project id.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = await db.removeProject(id, req.remote_user);
            res.status(204).end();
            //TODO if project.booking - notify live booking client about deleted project!
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// PERSONS CRUD
// *********************************************************************************************************************
router.post('/persons', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        if(!req.body) {
            const error = new Error('Projects/person - create. Missing person data.');
            error.statusCode = 402;
            next(error);
        } else {
            const result = await db.createPerson(req.body, req.remote_user);
            res.status(201).json(result);
        }
    } catch(error) {
        next(error);
    }
});

router.get('/persons', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const result = await db.getPersons();
        res.status(200).json(result);
    } catch(error) {
        next(error);
    }
});

router.put('/persons/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id || !req.body || (req.body._id && req.body._id !== id)) {
            const error = new Error('Projects/person - update. Wrong or mismatched person id or missing data.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = await db.updatePerson(id, req.body, req.remote_user);
            res.status(200).json(result);
        }
    } catch(error) {
        next(error);
    }
});

router.delete('/persons/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Projects/person - delete. Wrong person id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.removePerson(id, req.remote_user);
            res.status(204).end();
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// COMPANIES CRUD
// *********************************************************************************************************************
router.post('/companies', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        if(!req.body) {
            const error = new Error('Projects/company - create. Missing company data.');
            error.statusCode = 402;
            next(error);
        } else {
            const result = await db.createCompany(req.body, req.remote_user);
            res.status(201).json(result);
        }
    } catch(error) {
        next(error);
    }
});

router.get('/companies', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const result = await db.getCompanies();
        res.status(200).json(result);
    } catch(error) {
        next(error);
    }
});

router.put('/companies/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id || !req.body || (req.body._id && req.body._id !== id)) {
            const error = new Error('Projects/company - update. Wrong or mismatched company id or missing data.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = await db.updateCompany(id, req.body, req.remote_user);
            res.status(200).json(result);
        }
    } catch(error) {
        next(error);
    }
});

router.delete('/companies/:id', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Projects/company - delete. Wrong company id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.removeCompany(id, req.remote_user);
            res.status(204).end();
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// UPP USERS -R-- (role, name, uid)
// *********************************************************************************************************************
router.get('/users/role', [validateToken, authoriseApiAccess(PROJECTS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const users = await db.getUsersRole();
        res.status(200).json(users);
    } catch(error) {
        next(error);
    }
});


