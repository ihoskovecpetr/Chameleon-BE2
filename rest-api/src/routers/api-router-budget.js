'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-budget');
const wamp = require('../wamp');
const moment = require('moment');

const pricelistPdf = require('../pdf/pricelistPdf');
const budgetPdf = require('../pdf/budgetPdf');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const logger = require('../logger');

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
// GET PRICELIST (id can be 'general')
// *********************************************************************************************************************
router.get('/pricelists/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id && (!req.params.id || req.params.id !== 'general')) {
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
// UPDATE PRICELIST (id can be 'general')
// *********************************************************************************************************************
router.put('/pricelists/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id && (!req.params.id || req.params.id !== 'general')) {
            const error = new Error('Update Pricelist. Wrong or missing pricelist id.');
            error.statusCode = 400;
            next(error);
        } else if(!req.body || !req.body.pricelist) {
            const error = new Error('Update Pricelist. Missing pricelist data.');
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
        await db.createPricelist(req.body);
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
// GET PDF OF PRICELIST
// *********************************************************************************************************************
router.get('/pricelists/pdf/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id && (!req.params.id || req.params.id !== 'general')) {
            const error = new Error('Get PDF of Pricelist. Wrong or missing pricelist id.');
            error.statusCode = 400;
            next(error);
        } else {
            const pricelist = await db.getPricelist(id);
            const filename = `Pricelist_${pricelist.label}_${moment().format('YYMMDD')}`;
            const filenameEncoded = encodeURIComponent(filename);
            res.setHeader('Content-Disposition', 'attachment; filename="' + filenameEncoded + '.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            const pdfDoc = pricelistPdf(pricelist, filename);
            pdfDoc.pipe(res);
            pdfDoc.end();
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
// UPDATE PRICELIST UNITS
// *********************************************************************************************************************
router.put('/units', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        let order = 0;
        const units = req.body.map(unit => ({_id: unit._id, label: unit.label, order: order++, timeRatio: unit.timeRatio ? unit.timeRatio : 0, default: unit.default }));
        await db.updateUnits(units);
        res.status(200).end();
    } catch(error) {
        next(error);
    }
});

// +++++  T E M P L A T E S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

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
// GET TEMPLATE BY ID
// *********************************************************************************************************************
router.get('/templates/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = ((req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) || (req.params.id == 'new')) ? req.params.id : null;
        if(!id) {
            const error = new Error('Get Template. Wrong or missing template id.');
            error.statusCode = 400;
            next(error);
        } else {
            const idsOnly = req.query['itemIdsOnly'] && req.query['itemIdsOnly'] === 'true';
            const template = await db.getTemplate(id, idsOnly);
            res.status(200).json(template);
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// CREATE TEMPLATE
// *********************************************************************************************************************
router.post('/templates', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const template = await db.createTemplate(req.body);
        res.status(200).json({id: template._id});
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// UPDATE TEMPLATE
// *********************************************************************************************************************
router.put('/templates/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Update Template. Wrong or missing template id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.updateTemplate(id, req.body);
            res.status(200).end();
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// REMOVE TEMPLATE
// *********************************************************************************************************************
router.delete('/templates/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Remove Template. Wrong or missing template id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.removeTemplate(id);
            res.status(200).end();
        }
    } catch(error) {
        next(error);
    }
});

// +++++  B U D G E T S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

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
// CREATE BUDGET
// *********************************************************************************************************************
router.post('/budgets', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        if(!req.body.label) {
            const error = new Error('Create Budget. Label of Budget missing.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = await db.createBudget(req.body);
            if (result.project) wamp.notifyAboutUpdatedProject(result.project);
            res.status(200).json({id: result.budget});
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// CREATE BUDGET - saveAs => create new budget as copy of budget (id)
// *********************************************************************************************************************
router.post('/budgets/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Create Budget - Copy. Wrong or missing source template id.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = db.createBudgetAsCopy(id, req.body);
            if(result.project) wamp.notifyAboutUpdatedProject(result.project);
            if(result.oldPrice || result.newPrice) {
                //TODO wamp.projectBudgetOfferChanged({project:  projects[0] ? {id: projects[0]._id.toString(), label: projects[0].label} : {id: null}, budget: {id: budgetId.toString(), price: oldPrices}}, {project:  projects[1] ? {id: projects[1]._id.toString(), label: projects[1].label} : {id: null}, budget: {id: budgetId.toString(), price: newPrices}}))
            }
            res.status(200).json({id: result.budget}); //newId of budget
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// UPDATE BUDGET
// *********************************************************************************************************************
router.put('/budgets/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Update Budget. Wrong or missing template id.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = await db.updateBudget(id, req.body);
            if(result.projects.oldProject) wamp.notifyAboutUpdatedProject(result.projects.oldProject);
            if(result.projects.newProject) wamp.notifyAboutUpdatedProject(result.projects.newProject);
            if(result.projects.project) wamp.notifyAboutUpdatedProject(result.projects.project);

            if(result.oldPrice || result.newPrice) {
                //TODO wamp.projectBudgetOfferChanged({project:  projects[0] ? {id: projects[0]._id.toString(), label: projects[0].label} : {id: null}, budget: {id: budgetId.toString(), price: oldPrices}}, {project:  projects[1] ? {id: projects[1]._id.toString(), label: projects[1].label} : {id: null}, budget: {id: budgetId.toString(), price: newPrices}}))
            }
            res.status(200).end();
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// REMOVE BUDGET
// *********************************************************************************************************************
router.delete('/budgets/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Remove Budget. Wrong or missing template id.');
            error.statusCode = 400;
            next(error);
        } else {
            const result = await db.removeBudget(id);
            if(result.project) wamp.notifyAboutUpdatedProject(result.project);
            if(result.oldPrice || result.newPrice) {
                //TODO wamp.projectBudgetOfferChanged({project:  project ? {id: project._id.toString(), label: project.label} : {id: null}, budget: {id: budgetId.toString(), price: null}}, {project:  project ? {id: project._id.toString(), label: project.label} : {id: null}, budget: {id: null}}))
            }
            res.status(200).end();
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET PDF OF BUDGET
// *********************************************************************************************************************
router.get('/budgets/pdf/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_READONLY)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const partIndex = req.query.part;
        if(!id && (!req.params.id || req.params.id !== 'general')) {
            const error = new Error('Get PDF of Budget. Wrong or missing pricelist id.');
            error.statusCode = 400;
            next(error);
        } else {
            const budget = await db.getBudget(id);
            const clients = (await db.getClients()).reduce((out, client) => {out[client._id] = client.label; return out}, {});
            budget.part = partIndex;
            if(clients[budget.client]) budget.client = clients[budget.client];
            const project = budget.label ? budget.label : budget.language === 'cz' ? 'Rozpočet' : 'Budget';
            const client = budget.client ? budget.client.replace(/s\. *r\. *o/i,'').replace(/a\. *s/i,'') : '';
            const version = budget.version ? budget.version : '';
            const date = budget.date ? moment(budget.date).format('YYMMDD') : moment().format('YYMMDD');
            const filename = `${project}_${client}_${version}_${date}`.replace(/[ .,]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
            const filenameEncoded = encodeURIComponent(filename);
            res.setHeader('Content-Disposition', `attachment; filename="${filenameEncoded}.pdf"`);
            res.setHeader('Content-Type', 'application/pdf');
            const pdfDoc = budgetPdf(budget, filename);
            pdfDoc.pipe(res);
            pdfDoc.end();
        }
    } catch(error) {
        next(error);
    }
});

// +++++  O T H E R S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

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

// *********************************************************************************************************************
// GET BOOKING PROJECT (For create new from booking, id='new' => new for not saved project yet)
// *********************************************************************************************************************
router.get('/projects/:id', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const id = req.params.id && (mongoose.Types.ObjectId.isValid(req.params.id) || req.params.id === 'new') ? req.params.id : null;
        if(!id) {
            const error = new Error('Get Booking Project. Wrong or missing budget id.');
            error.statusCode = 400;
            next(error);
        } else {
            const project = id !== 'new' ? await db.getProject(id) : {label: 'Not yet created!', _id: null};
            if(project) res.status(200).json(project);
            else {
                const error = new Error(`Get Booking Project. Can't find project id: '${id}'.`);
                error.statusCode = 404;
                next(error);
            }
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET LIST OF CONDITIONS
// *********************************************************************************************************************
router.get('/conditions', [validateToken, authoriseApiAccess(BUDGET_ACCESS_USER)],  async (req, res, next) => {
    try {
        const conditions = db.getConditions();
        res.status(200).json(conditions);
    } catch(error) {
        next(error);
    }
});






