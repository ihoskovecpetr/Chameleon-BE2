'use strict';

const express = require('express');
const router = express.Router();
const moment = require('moment');
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-analytics');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const ANALYTICS_ACCESS_FULL = ['analytics:full'];
const ANALYTICS_ACCESS_MANAGER = ANALYTICS_ACCESS_FULL.concat(['analytics.restricted-1']);

module.exports = router;

// *********************************************************************************************************************
// GET UTILIZATION
// *********************************************************************************************************************
router.get('/utilization', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_MANAGER)],  async (req, res, next) => {
    try {
        const from = moment(req.query.from, 'YYYY-MM-DD', true);
        const to = moment(req.query.to, 'YYYY-MM-DD', true);
        if(!from.isValid() || !to.isValid() || to.add(1, 'days').diff(from) <= 0) {
            const error = new Error('Analytics / utilization - date range is not valid.');
            error.statusCode = 400;
            next(error);
        } else {
            const utilization = await db.getManagersAndSupervisorsUtilization(from, to);
            res.status(200).json(utilization);
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET EFFICIENCY
// *********************************************************************************************************************
router.get('/efficiency', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const from = moment(req.query.from, 'YYYY-MM-DD', true);
        const to = moment(req.query.to, 'YYYY-MM-DD', true);
        if(!from.isValid() || !to.isValid() || to.add(1, 'days').diff(from) <= 0) {
            const error = new Error('Analytics / efficiency - date range is not valid.');
            error.statusCode = 400;
            next(error);
        } else {
            const efficiency = await db.getManagersAndSupervisorsEfficiency(from, to);
            res.status(200).json(efficiency);
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET NOTIFICATIONS
// *********************************************************************************************************************
router.get('/notification', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_MANAGER)],  async (req, res, next) => {
    try {
        const notifications = await db.getNotifications();
        res.status(200).json(notifications);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET PROJECTS BOOKING BALANCE
// *********************************************************************************************************************
router.get('/projects', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_MANAGER)],  async (req, res, next) => {
    try {
        const from = moment(req.query.from, 'YYYY-MM-DD', true);
        const to = moment(req.query.to, 'YYYY-MM-DD', true);
        if(!from.isValid() || !to.isValid() || to.add(1, 'days').diff(from) <= 0) {
            const error = new Error('Analytics / projects - date range is not valid.');
            error.statusCode = 400;
            next(error);
        } else {
            const underBooked = req.query.under && req.query.under === 'true';
            const projects = await db.getProjects(from, to, underBooked);
            res.status(200).json(projects);
        }
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// GET PROJECTS FINAL
// *********************************************************************************************************************
router.get('/projects-final', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const projects = await db.getProjectsFinal();
        res.status(200).json(projects);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// SET PROJECTS FINAL CHECKED
// *********************************************************************************************************************
router.delete('/projects-final/:id', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_FULL)],  async (req, res, next) => {
   try {
       const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
       if(!id) {
           const error = new Error('Check final project. Wrong or missing pricelist id.');
           error.statusCode = 400;
           next(error);
       } else {
           await db.checkProjectFinal(id);
           res.status(200).end();
       }
   } catch(error) {
       next(error);
   }
});

// *********************************************************************************************************************
// GET PROFIT
// *********************************************************************************************************************
router.get('/profit', [validateToken, authoriseApiAccess(ANALYTICS_ACCESS_FULL)],  async (req, res, next) => {
    try {
        const from = moment(req.query.from, 'YYYY-MM-DD', true);
        const to = moment(req.query.to, 'YYYY-MM-DD', true);
        if(!from.isValid() || !to.isValid() || to.add(1, 'days').diff(from) <= 0) {
            const error = new Error('Analytics / profit - date range is not valid.');
            error.statusCode = 400;
            next(error);
        } else {
            const profit = await db.getProfit(from, to);
            res.status(200).json(profit);
        }
    } catch(error) {
        next(error);
    }
});