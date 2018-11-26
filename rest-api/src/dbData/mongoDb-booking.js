'use strict';
const mongoose = require('mongoose');

//Collections
const BookingResource = require('../models/booking-resource');

// *******************************************************************************************
// RESOURCES
// *******************************************************************************************
exports.getBookingOperatorResources = async fields => {
    if(fields && !Array.isArray(fields)) fields = [fields];
    const requestedField = {};
    if(fields) for(const field of fields) requestedField[field] = true;
    return await BookingResource.find({type: 'OPERATOR'}, requestedField).lean();
};