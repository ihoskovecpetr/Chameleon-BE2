'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-admin');
const ad = require('../dbData/ADdata');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const ADMIN_ACCESS = ['chameleon:admin'];

module.exports = router;

// *********************************************************************************************************************
// GET ALL USERS
// *********************************************************************************************************************
router.get('/users', [validateToken, authoriseApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const users = await db.getUsers();
        res.status(200).json(users);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// GET RESOURCES (OPERATORS)
// *********************************************************************************************************************
router.get('/resources', [validateToken, authoriseApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const resources = await db.getResources('OPERATOR');
        res.status(200).json(resources);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// GET PUSHER GROUPS
// *********************************************************************************************************************
router.get('/pusher-groups', [validateToken, authoriseApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const groups = await db.getPusherPublicGroups();
        res.status(200).json(groups);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// GET USER FROM ACTIVE DIRECTORY
// *********************************************************************************************************************
router.get('/users/ad/:uid', [validateToken, authoriseApiAccess(ADMIN_ACCESS)], async (req, res, next) => {
    try {
        const uid = req.params.uid;
        const user = await ad.getUser(uid);
        res.status(200).json(user);
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// ADD NEW USER
// *********************************************************************************************************************
router.post('/users', [validateToken, authoriseApiAccess(ADMIN_ACCESS)], async (req, res, next) => {
    try {
        const userData = req.body;
        if(!userData) {
            const error = new Error('Admin - user add. Missing user data.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.addUser(userData);
            res.status(201).end();
        }
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});


// *********************************************************************************************************************
// UPDATE USER DATA
// *********************************************************************************************************************
router.put('/users/:id', [validateToken, authoriseApiAccess(ADMIN_ACCESS)], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const userData = req.body;
        if(!id || !userData || (userData._id && userData._id !== id)) {
            const error = new Error('Admin - user update. Wrong or mismatched user data.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.updateUser(id, userData);
            res.status(204).end();
        }
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// ADD NEW PUSHER GROUP
// *********************************************************************************************************************
router.post('/pusher-groups', [validateToken, authoriseApiAccess(ADMIN_ACCESS)], async (req, res, next) => {
    try {
        const groupData = req.body;
        if(!groupData) {
            const error = new Error('Admin - pusher group add. Missing group data.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.addPusherGroup(groupData);
            res.status(201).end();
        }
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});


// *********************************************************************************************************************
// UPDATE PUSHER GROUP
// *********************************************************************************************************************
router.put('/pusher-groups/:id', [validateToken, authoriseApiAccess(ADMIN_ACCESS)], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const groupData = req.body;
        if(!id || !groupData || (groupData._id && groupData._id !== id)) {
            const error = new Error('Admin - pusher group update. Wrong or mismatched group data.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.updatePusherGroup(id, groupData);
            res.status(204).end();
        }
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});

// *********************************************************************************************************************
// DELETE PUSHER GROUP
// *********************************************************************************************************************
router.delete('/pusher-groups/:id', [validateToken, authoriseApiAccess(ADMIN_ACCESS)], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            const error = new Error('Admin - pusher group delete. Missing or bad group id.');
            error.statusCode = 400;
            next(error);
        } else {
            await db.removePusherGroup(id);
            res.status(204).end();
        }
    } catch(error) {
        error.statusCode = 500;
        next(error);
    }
});