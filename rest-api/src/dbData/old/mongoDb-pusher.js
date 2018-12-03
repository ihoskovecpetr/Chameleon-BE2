'use strict';
const mongoose = require('mongoose');

//Collections
const PusherGroup = require('../models/pusher-group');

// *******************************************************************************************
// GROUPS (PUSHER MESSAGE)
// *******************************************************************************************
exports.getPublicPusherGroups = async fields => {
    if(fields && !Array.isArray(fields)) fields = [fields];
    const requestedField = {};
    if(fields) for(const field of fields) requestedField[field] = true;
    return await PusherGroup.find({owner: null}, requestedField).lean();
};

exports.updatePusherGroup = async (id, data) => {
    delete data._id;
    await PusherGroup.findOneAndUpdate({_id: id}, data);
};

exports.addPusherGroup = async data => {
    delete data._id;
    await PusherGroup.create(data);
};


exports.removePusherGroup = async (id) => {
    await PusherGroup.findOneAndDelete({_id: id});
};

