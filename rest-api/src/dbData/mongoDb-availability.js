'use strict';
const mongoose = require('mongoose');

//Collections
const User = require('../../_common/models/user');
const BookingResource = require('../../_common/models/booking-resource');
const BookingEvent = require('../../_common/models/booking-event');
const BookingProject = require('../../_common/models/booking-project');
//const BookingOplog = require('../../_common/models/booking-oplog');


//const logger = require('../logger');

// *******************************************************************************************
// get user
// *******************************************************************************************
exports.getUserBySsoIdOrNull = async id => {
    const userData = await User.findOne({ssoId: id}).lean();
    if(userData) {
        const user = {
            id: userData._id.toString(),
            resource: null,
            K2id: null,
            name: userData.name,
            email: userData.email ? userData.email : null,
            role: userData.role,
            access: userData.access
        };
        if(userData.resource) {
            const resource = await BookingResource.findOne({_id: userData.resource}).lean();
            if (resource) {
                user.K2id = resource.K2id;
                user.resource = resource._id.toString();
                user.fullTime = resource.fullTime;
            }
        }
        return user;
    }
    return null;
};

// *******************************************************************************************
// add event
// *******************************************************************************************
exports.addEvent = async (id, event) => {
    event._id = id;
    await BookingEvent.create(event);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}}); //project is '0000...' time-off - so no it is BookingProject
};

// *******************************************************************************************
// remove avb event
// *******************************************************************************************
exports.removeAvbEvent = async avbId => {
    const event = await BookingEvent.findOneAndRemove({avbEvent: avbId});
    if(event) await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: event._id}}); //project is '0000...' time-off - so no it is BookingProject
    return event;
};

// *******************************************************************************************
// update avb event
// *******************************************************************************************
exports.updateAvbEvent = async (avbId, eventUpdate) => {
    const oldEvent = await BookingEvent.findOne({avbEvent: avbId}).lean();
    if(eventUpdate.days && Array.isArray(eventUpdate.days) && eventUpdate.days.length > 0) {
        const duration = oldEvent.days.reduce((out, day) => {return day.duration > out ? day.duration : out}, 0);
        for (let i=0; i < eventUpdate.days.length; i++) {
            eventUpdate.days[i].duration = duration;
        }
    }
    const event = await BookingEvent.findOneAndUpdate({avbEvent: avbId}, {$set: eventUpdate}, {new: true});
    return {event: event ? event.toObject() : null, oldEvent: oldEvent}
};

// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
//exports.logOp = async (type, user, data, err) => {
//    await BookingOplog.create({type: type, user: user, data: data, success: err ? false : true, reason: err});
//};


