const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-user');
const logger = require('../logger');
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
// PUT USER - UPDATE USER FROM ADMIN CONSOLE
// *********************************************************************************************************************

// *********************************************************************************************************************
// POST USERS - ADD FROM ADMIN CONSOLE
// *********************************************************************************************************************

// *********************************************************************************************************************
// GET USER'S AD DATA FOR ADMIN CONSOLE
// *********************************************************************************************************************

// *********************************************************************************************************************
// PUT /groups - update groupa
// *********************************************************************************************************************

/*
async function getUsersForAdminConsole() {
    const users = await User.find({}, {_id: true, name: true, ssoId: true, pinGroupId: true, access: true, role: true, resource: true, email:true, tlf: true}).lean();
    const resources = await BookingResource.find({type: 'OPERATOR'}, {_id: true, label: true}).lean();
    const groups = await PusherGroup.find({owner: null}, {_id: true, label: true, members: true}).lean();
    return {users, resources, groups}
}

async function updateUserForAdminConsole(uid, data) {
    const user = await User.findByIdAndUpdate(uid, {$set: data});
    if(user) {
        const groups = await PusherGroup.find({owner: null}, {_id: true, label: true, members: true}).lean();
        const promises = [];
        groups.forEach(group => {
            const wasMemberOfGroup = group.members.map(member => member.toString()).indexOf(uid) >= 0;
            const willBeMemberOfGroup = data.groups.indexOf(group._id.toString()) >= 0;
            if(wasMemberOfGroup !== willBeMemberOfGroup) {
                const updateData = wasMemberOfGroup ? {$pull: {members: uid}} : {$push: {members: uid}};
                promises.push(PusherGroup.findByIdAndUpdate(group._id, updateData));
            }
        });
        await Promise.all(promises);
    } else {
        throw new Error(`Can't update user "${uid}" - User not found.`);
    }
}

async function addUserForAdminConsole(data) {
    const user = await User.create(data);
    await Promise.all(data.groups.map(group => PusherGroup.findByIdAndUpdate(group, {$push: {members: user._id}})));
}

async function updateGroupsForAdminConsole(data) {
    if(data) {
        const promises = [];
        const groups = await PusherGroup.find({owner: null}, {_id: true, label: true, members: true}).lean();
        data.forEach(group => {
            if(group._id === null) {
                delete group._id;
                promises.push(PusherGroup.create(group));
            } else {
                const original = groups.find(g => g._id.toString() === group._id);
                if(original) {
                    let update = null;
                    if(original.label !== group.label) {
                        if(!update) update = {};
                        update.label = group.label;
                    }
                    const originalMembers = original.members.map(m => m.toString()).sort();
                    const currentMembers = group.members.map(m => m.toString()).sort();
                    if(originalMembers.length !== currentMembers.length) {
                        if(!update) update = {};
                        update.members = group.members;
                    } else {
                        let needUpdate = false;
                        for(let i=0; i < originalMembers.length; i++) {
                            if(!needUpdate && originalMembers[i] !== currentMembers[i]) {
                                needUpdate = true;
                                if(!update) update = {};
                                update.members = group.members;
                            }
                        }
                    }
                    if(update) promises.push(PusherGroup.update({_id: group._id}, {$set: update}));
                }
            }
        });
        const toRemove = groups.map(g => g._id.toString()).filter(g => !data.find(gg => gg._id === g));
        if(toRemove.length > 0) {
            promises.push(PusherGroup.remove({_id: {$in: toRemove}}));
        }
        await Promise.all(promises);
    }
}
*/
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
