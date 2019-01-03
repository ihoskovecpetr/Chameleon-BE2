'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-budget');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const BUDGET_ACCESS_FULL = ['budget:full'];
const BUDGET_ACCESS_USER = BUDGET_ACCESS_FULL.concat(['budget:user']);
const BUDGET_ACCESS_READONLY = BUDGET_ACCESS_USER.concat(['budget:readonly']);

module.exports = router;

// +++++  P R I C E L I S T S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// *********************************************************************************************************************
// GET LIST OF ALL PRICELISTS
// *********************************************************************************************************************
router.get('/pricelists', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const pricelists = await db.getPricelists();
        res.status(200).json(pricelists);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET GENERAL PRICELIST
// *********************************************************************************************************************
router.get('/pricelists/general', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const pricelist = await db.getPricelist();
        res.status(200).json(pricelist);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET PRICELIST
// *********************************************************************************************************************
router.get('/pricelists/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Get Pricelist. Wrong or missing pricelist id.');
            error.statusCode = 400;
            next(error);
        } else {
            const pricelist = await db.getPricelist(id);
            res.status(200).json(pricelist);
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// UPDATE GENERAL PRICELIST
// *********************************************************************************************************************
router.put('/pricelists/general', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
   try {
       if(!req.body.pricelist) {
           const error = new Error('Update General Pricelist. Missing pricelist data.');
           error.statusCode = 400;
           next(error);
       } else {
           await db.updateGeneralPricelist(req.body.pricelist);
           res.status(200).end();
       }
   } catch(error) {
       next(error);
   }
});

// *********************************************************************************************************************
// UPDATE PRICELIST
// *********************************************************************************************************************
router.put('/pricelists/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Update Pricelist. Wrong or missing pricelist id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.updatePricelist(id, req.body);
            res.status(200).end();
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// CREATE PRICELIST
// *********************************************************************************************************************
router.post('/pricelists', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        await db.createPricelist(id, req.body);
        res.status(200).end();
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// DELETE PRICELIST
// *********************************************************************************************************************
router.delete('/pricelists/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Delete Pricelist. Wrong or missing pricelist id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.deletePricelist(id);
            res.status(200).end();
        }
    } catch(error) {
        next(error);
    }
});










// *********************************************************************************************************************
// GET PRICELIST UNITS
// *********************************************************************************************************************
router.get('/units', [validateToken, authoriseApiAccess(BUDGET_ACCESS_READONLY)],  async (req, res, next) => {
    try {
        const units = await db.getUnits();
        res.status(200).json(units);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET JOBS (WORK TYPES)
// *********************************************************************************************************************
router.get('/jobs', [validateToken, authoriseApiAccess(BUDGET_ACCESS_READONLY)],  async (req, res, next) => {
    try {
        const workTypes = await db.getWorkTypes();
        res.status(200).json(workTypes);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET LIST OF ALL BUDGETS
// *********************************************************************************************************************
router.get('/budgets', [validateToken, authoriseApiAccess(BUDGET_ACCESS_READONLY)],  async (req, res, next) => {
    try {
        const budgets = await db.getBudgets();
        res.status(200).json(budgets);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET BUDGET BY ID
// *********************************************************************************************************************
router.get('/budgets/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_READONLY)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Get Budget. Wrong or missing budget id.');
            error.statusCode = 400;
            next(error);
        } else {
            const budget = await db.getBudget(id);
            res.status(200).json(budget);
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET LIST OF ALL CLIENTS
// *********************************************************************************************************************
router.get('/clients', [validateToken, authoriseApiAccess(BUDGET_ACCESS_READONLY)],  async (req, res, next) => {
    try {
        const clients = await db.getClients();
        res.status(200).json(clients);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET TEMPLATES
// *********************************************************************************************************************
router.get('/templates', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const templates = await db.getTemplates();
        res.status(200).json(templates);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET BOOKING PROJECTS TO PAIR WITH
// *********************************************************************************************************************
router.get('/projects', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const include = req.query.include && mongoose.Types.ObjectId.isValid(req.query.include) ? req.query.include : null;
        const projects = await db.getProjects(include);
        res.status(200).json(projects);
    } catch(error) {
        next(error);
    }
});


