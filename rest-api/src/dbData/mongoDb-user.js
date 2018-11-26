'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../models/user');

// *******************************************************************************************
// USERS
// *******************************************************************************************
exports.getUsers = async fields => {
    if(fields && !Array.isArray(fields)) fields = [fields];
    const requestedField = {};
    if(fields) for(const field of fields) requestedField[field] = true;
    return await User.find({}, requestedField).lean();
};

exports.getUserByUid = async (uid, fields) => {
    if(fields && !Array.isArray(fields)) fields = [fields];
    const requestedField = {};
    if(fields) for(const field of fields) requestedField[field] = true;
    const user =  await User.findOne({ssoId: uid}, requestedField).lean();
    if (user) return user;
    throw new Error(`User: ${uid} not found.`);
};

// *******************************************************************************************
// get user's (uid) access for authorize API access
// *******************************************************************************************
exports.getUserAppAccess = async uid => {
    const user =  await User.findOne({ssoId: uid}, {access: true}).lean();
    if(user) {
        if(user.access.length > 0) return user.access;
        else throw new Error(`Access forbidden. User: ${uid}. App: ${app}`);
    } else throw new Error(`User: '${uid}' not found.`);
};