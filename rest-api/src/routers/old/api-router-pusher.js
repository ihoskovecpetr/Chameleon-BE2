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
// GET GROUPS DATA FOR ADMIN APP
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
// UPDATE GROUP
// *********************************************************************************************************************
router.put('/groups/:id', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const groupData = req.body;
        if(!id || !groupData || (groupData._id && groupData._id !== id)) {
            next(new Error('Wrong or mismatched group data.'));
        } else {
            await db.updatePusherGroup(id, groupData);
            res.status(200).end();
        }
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// CREATE GROUP
// *********************************************************************************************************************
router.post('/groups', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const groupData = req.body;
        if(!groupData) {
            next(new Error('Missing group data.'));
        } else {
            await db.addPusherGroup(groupData);
            res.status(200).end();
        }
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// REMOVE GROUP
// *********************************************************************************************************************
router.delete('/groups/:id', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            next(new Error('Missing or bad group id.'));
        } else {
            await db.removePusherGroup(id);
            res.status(200).end();
        }
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

