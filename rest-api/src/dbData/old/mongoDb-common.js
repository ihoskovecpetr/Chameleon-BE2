'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../models/user');

// *******************************************************************************************
// get user's (uid) access for authorize API access
// *******************************************************************************************
exports.getUserAppAccess = async uid => {
    return await User.findOne({ssoId: uid}, {access: true}).lean();
};

exports.getUserByUid = async (uid, fields) => {
    if(fields && !Array.isArray(fields)) fields = [fields];
    const requestedField = {};
    if(fields) for(const field of fields) requestedField[field] = true;
    return await User.findOne({ssoId: uid}, requestedField).lean();
};
