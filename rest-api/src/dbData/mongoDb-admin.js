'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../../_common/models/user');
const PusherGroup = require('../../_common/models/pusher-group');
const BookingResource = require('../../_common/models/booking-resource');

// *******************************************************************************************
// get users
// *******************************************************************************************
exports.getUsers = async () => {
    return await User.find({}, {name: true, ssoId: true, pinGroupId: true, access: true, role: true, resource: true, email: true, tlf: true}).lean();
};

// *******************************************************************************************
// get booking resources
// *******************************************************************************************
exports.getResources = async type => {
    return await BookingResource.find(type ? {type: type} : {}, {label: true}).lean();
};

// *******************************************************************************************
// get pusher groups
// *******************************************************************************************
exports.getPusherPublicGroups = async () => {
    return await PusherGroup.find({owner: null}, {label: true, members: true}).lean();
};

// *******************************************************************************************
// add new user
// *******************************************************************************************
exports.addUser = async data => {
    const user = await User.create(data);
    await Promise.all(data.groups.map(group => PusherGroup.findOneAndUpdate({_id: group}, {$push: {members: user._id}})));
};

// *******************************************************************************************
// update user
// *******************************************************************************************
exports.updateUser = async (id, data) => {
    const user = await User.findOneAndUpdate({_id: id}, {$set: data});
    if(user) {
        const groups = await PusherGroup.find({owner: null}, {label: true, members: true}).lean();
        const promises = [];
        groups.forEach(group => {
            const wasMemberOfGroup = group.members.map(member => member.toString()).indexOf(id) >= 0;
            const willBeMemberOfGroup = data.groups.indexOf(group._id.toString()) >= 0;
            if(wasMemberOfGroup !== willBeMemberOfGroup) {
                const updateData = wasMemberOfGroup ? {$pull: {members: id}} : {$push: {members: id}};
                promises.push(PusherGroup.findOneAndUpdate({_id: group._id}, updateData));
            }
        });
        await Promise.all(promises);
    } else {
        throw new Error(`Can't update user "${id}" - User not found.`);
    }
};

// *******************************************************************************************
// add pusher group
// *******************************************************************************************
exports.addPusherGroup = async data => {
    delete data._id;
    await PusherGroup.create(data);
};

// *******************************************************************************************
// update pusher group
// *******************************************************************************************
exports.updatePusherGroup = async (id, data) => {
    delete data._id;
    await PusherGroup.findOneAndUpdate({_id: id}, data);
};

// *******************************************************************************************
// delete pusher group
// *******************************************************************************************
exports.removePusherGroup = async id => {
    await PusherGroup.findOneAndDelete({_id: id});
};