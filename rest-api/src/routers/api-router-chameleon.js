'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-chameleon');

const validateToken = require('../validateToken');

module.exports = router;

// *********************************************************************************************************************
// GET AUTHENTICATED USER
// *********************************************************************************************************************
router.get('/users/authenticated', validateToken,  async (req, res, next) => {
    try {
        const authenticatedUserId = req.remote_user;
        if(!authenticatedUserId) {
            next(new Error('No remote user authenticated'));
        } else {
            const user = await db.getUserByUid(req.remote_user, ['name', 'role', 'ssoId', 'access', 'email']);
            if(!user) {
                next(new Error(`Can't find user for authenticated user id: ${authenticatedUserId}`))
            }
            user.exp = req.token_expiration;
            res.status(200).json(user);
        }
    } catch(error) {
        next(error);
    }
});