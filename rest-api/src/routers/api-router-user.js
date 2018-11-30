const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-user');
const ad = require('../dbData/ADdata');
const validateToken = require('../validateToken');

module.exports = router;

const PROJECTS_FULL_ACCESS  = ['projects:full'];
const ADMIN_ACCESS = ['chameleon:admin'];

// *********************************************************************************************************************
// GET USERS FOR PROJECTS (role, name, ssiId [uid], _id)
// *********************************************************************************************************************
router.get('/role', [validateToken, authorizeApiAccess(PROJECTS_FULL_ACCESS)],  async (req, res, next) => {
    try {
        const users = await db.getUsers(['role', 'name', 'ssoId']);
        res.status(200).json(users);
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// GET AUTHENTICATED USER
// *********************************************************************************************************************
router.get('/authenticated', validateToken, async (req, res, next) => {
    try {
        const authenticatedUserId = req.remote_user;
        if(!authenticatedUserId) {
            next(new Error('No remote user authenticated'));
        } else {
            const user = await db.getUserByUid(req.remote_user, ['name', 'role', 'ssoId', 'access', 'email']);
            user.exp = req.token_expiration;
            res.status(200).json(user);
        }
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// GET USERS FULL DATA FOR ADMIN APP
// *********************************************************************************************************************
router.get('/admin', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const users = await db.getUsers(['name', 'ssoId', 'pinGroupId', 'access', 'role', 'resource', 'email', 'tlf']);
        res.status(200).json(users);
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// PUT USER - UPDATE USER
// *********************************************************************************************************************
router.put('/:id', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const userData = req.body;
        if(!id || !userData || (userData._id && userData._id !== id)) {
            next(new Error('Wrong or mismatched user data.'));
        } else {
            await db.updateUser(id, userData);
            res.status(200).end();
        }
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// POST USERS - ADD NEW  USER
// *********************************************************************************************************************
router.post('/', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const userData = req.body;
        if(!userData) {
            next(new Error('Missing user data.'));
        } else {
            await db.addUser(userData);
            res.status(200).end();
        }
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// GET USER'S AD DATA FOR ADMIN CONSOLE
// *********************************************************************************************************************
router.get('/ad/:uid', [validateToken, authorizeApiAccess(ADMIN_ACCESS)],  async (req, res, next) => {
    try {
        const uid = req.params.uid;
        const user = await ad.getUser(uid);
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

