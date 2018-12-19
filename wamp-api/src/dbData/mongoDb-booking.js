'use strict';
const mongoose = require('mongoose');
const dataHelper = require('../lib/dataHelper');

//Collections
const BookingGroup = require('../models/booking-group');
const BookingResource = require('../models/booking-resource');
const Holiday = require('../models/holiday');
const BookingProject = require('../models/booking-project');
const BookingEvent = require('../models/booking-event');
const BookingWorkType = require('../models/booking-work-type');
const User = require('../models/user');
const BookingOplog = require('../models/booking-oplog');

exports = module.exports;
// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
exports.logOp = async (type, user, data, err) => {
    await BookingOplog.create({type: type, user: user, data: data, success: !err, reason: err});
};

// *******************************************************************************************
// GET DATA
// *******************************************************************************************
exports.getResourceGroups = async () => {
    const groups = await BookingGroup.find({},{__v:false}).lean();
    return dataHelper.getNormalizedObject(groups);
};

exports.getResources = async () => {
    const resources = await BookingResource.find({},{__v:false, tariff: false}).lean();
    return dataHelper.getNormalizedObject(resources);
};

exports.getHolidays = async () => {
    const holidays = await Holiday.find().lean();
    return holidays.length > 0 ? holidays[0].days : holidays
};

exports.getProjects = async () => {
    const projects = await BookingProject.find({deleted: null},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false }).lean();
    return dataHelper.getNormalizedObject(projects);
};

exports.getEvents = async () => {
    const projects = await BookingProject.find({deleted: null}, {_id: true}).lean();
    const projectIds = projects.map(project => project._id);
    const events = await BookingEvent.find({project: {$in: projectIds}},{__v: false, 'days.__v': false, 'days._id': false}).lean();
    return dataHelper.getNormalizedObject(events);
};

exports.getJobs = async () => {
    const jobs = await BookingWorkType.find({bookable: true},{__v: false, K2ids: false, tariff: false}).lean();
    return dataHelper.getNormalizedObject(jobs);
};

exports.getUsers = async () => {
    const users = await User.find({},{__v:false}).lean();
    return dataHelper.getNormalizedObject(users)
};

// *******************************************************************************************
// EVENTS
// *******************************************************************************************
exports.updateEvent = async (id, event) => {
    const oldEvent = await BookingEvent.findOneAndUpdate({_id: id}, {$set: event});
    if(oldEvent.project && oldEvent.project.toString() !== event.project) await Promise.all([
        BookingProject.findOneAndUpdate({_id: oldEvent.project}, {$pull: {events: id}}),
        BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}})
    ]);
    return oldEvent;
};

exports.addEvent = async (id, event) => {
    event._id = id;
    await BookingEvent.create(event);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id}});
};

exports.removeEvent = async id => {
    const event = await BookingEvent.findByIdAndRemove(id);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: id}});
};

exports.splitEvent = async (id, event, id2, event2) => {
    event2._id = id2;
    await BookingEvent.create(event2);
    await BookingProject.findOneAndUpdate({_id: event.project}, {$push: {events: id2}}); //add second part to the project
    await BookingEvent.findOneAndUpdate({_id: id}, {$set: event}); //update first part - changed length
};

exports.joinEvents = async (id, event, id2) => {
    await BookingEvent.findOneAndUpdate({_id: id}, {$set: event}); //update first part by joined data
    await BookingEvent.findOneAndRemove({_id: id2}); //remove second part
    await BookingProject.findOneAndUpdate({_id: event.project}, {$pull: {events: id2}}); //remove second part from the project
};
