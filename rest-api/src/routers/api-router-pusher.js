const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-pusher');
const dbUser = require('../dbData/mongoDb-user');
const logger = require('../logger');
const validateToken = require('../validateToken');

module.exports = router;

const ADMIN_ACCESS = ['chameleon:admin'];

// *********************************************************************************************************************
// GET USERS FULL DATA FOR ADMIN APP
// *********************************************************************************************************************
router.get('/groups/admin', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const groups = await db.getPublicPusherGroups(['label', 'members']);
        res.status(200).json(groups);
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
                    const userAccess = await dbUser.getUserAppAccess(user);
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
