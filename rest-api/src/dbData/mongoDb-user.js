'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../models/user');

// *******************************************************************************************
// USERS
// *******************************************************************************************
exports.getUsers = async () => {
    return await User.find({},{name: true, role: true, ssoId: true}).lean();
};

exports.getUserByUid = async uid => {
    const user =  await User.findOne({ssoId: uid}, {name: true, role: true, ssoId: true, access: true, email: true}).lean();
    if (user) return user;
    throw new Error(`User: ${uid} not found.`);
};

exports.getUserAppAccess = async uid => {
    const user =  await User.findOne({ssoId: uid}, {access: true}).lean();
    if(user) {
        if(user.access.length > 0) return user.access;
        else throw new Error(`Access forbidden. User: ${uid}. App: ${app}`);
    } else throw new Error(`User: '${uid}' not found.`);
};