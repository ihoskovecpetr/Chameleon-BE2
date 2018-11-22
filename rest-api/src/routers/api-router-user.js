const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-user');
const logger = require('../logger');
const validateToken = require('../validateToken');

module.exports = router;

const PROJECTS_FULL_ACCESS  = ['projects:full'];

router.get('/', [validateToken, authorizeApiAccess(PROJECTS_FULL_ACCESS)],  async (req, res, next) => {
    try {
        const users = await db.getUsers();
        res.status(200).json(users);
    } catch(e) {
        next(e);
    }
});

router.get('/authenticated', validateToken, async (req, res, next) => {
    try {
        const authenticatedUserId = req.remote_user;
        if(!authenticatedUserId) throw new Error('No remote user authenticated');
        const user = await db.getUserByUid(req.remote_user);
        user.exp = req.token_expiration;
        res.status(200).json(user);
    } catch(e) {
        next(e);
    }
});

router.get('/:id', [validateToken, authorizeApiAccess()], async (req, res, next) => {
    try {
        const uid = req.params.id ? req.params.id : null;
        const user = await db.getUserByUid(uid);
        res.status(200).json(user);
    } catch(e) {
        next(e);
    }
});


// *********************************************************************************************************************
// AUTHORIZE API ACCESS
// *********************************************************************************************************************
function authorizeApiAccess(access) {
    return async function(req, res, next) {
        const user = req.remote_user;
        if(!user) {
            res.status(403).json({error: 'Unauthorized! Access Forbidden.'});
        } else {
            if(!access) next();
            else {
                if(!Array.isArray(access)) access = [access];
                try {
                    const userAccess = await db.getUserAppAccess(user);
                    let hasAccess = false;
                    for(const a of access) hasAccess = !hasAccess && userAccess.indexOf(a) >= 0;
                    if(hasAccess) next();
                    else res.status(403).json({error: 'Unauthorized! Access Forbidden.'});
                } catch(e) {
                    res.status(403).json({error: `${e}`});
                }
            }
        }
    };
}

// *********************************************************************************************************************
// API REQUEST ERROR HANDLING
// *********************************************************************************************************************
router.use(function (err, req, res) {
    delete err.stack;
    logger.error(err);
    let statusCode = err.statusCode || 500;
    res.status(statusCode).json({error: `${err}`});
});
