'use strict';
const mongoose = require('mongoose');
//const logger = require('./logger');
//Collections
const User = require('../models/user');

// *******************************************************************************************
// get user
// *******************************************************************************************
exports.getUserRoleAccess = async uid => {
    const user = await User.findOne({ssoId: uid}, {access: true, role: true}).lean();
    return user ? {role: user.role, access: user.access} : {role: [], access: []};
};