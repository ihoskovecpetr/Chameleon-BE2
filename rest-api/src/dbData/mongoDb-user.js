'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../models/user');
const PusherGroup = require('../models/pusher-group');

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

exports.updateUser = async (id, data) => {
    const user = await User.findByIdAndUpdate(id, {$set: data});
    if(user) {
        const groups = await PusherGroup.find({owner: null}, {_id: true, label: true, members: true}).lean();
        const promises = [];
        groups.forEach(group => {
            const wasMemberOfGroup = group.members.map(member => member.toString()).indexOf(id) >= 0;
            const willBeMemberOfGroup = data.groups.indexOf(group._id.toString()) >= 0;
            if(wasMemberOfGroup !== willBeMemberOfGroup) {
                const updateData = wasMemberOfGroup ? {$pull: {members: id}} : {$push: {members: id}};
                promises.push(PusherGroup.findByIdAndUpdate(group._id, updateData));
            }
        });
        await Promise.all(promises);
    } else {
        throw new Error(`Can't update user "${id}" - User not found.`);
    }
};

exports.addUser = async (data) => {
    const user = await User.create(data);
    await Promise.all(data.groups.map(group => PusherGroup.findByIdAndUpdate(group, {$push: {members: user._id}})));
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