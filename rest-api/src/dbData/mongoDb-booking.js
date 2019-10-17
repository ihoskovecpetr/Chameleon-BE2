'use strict';
const mongoose = require('mongoose');
const dataHelper = require('../../_common/lib/dataHelper');
//const logger = require('../logger');

//Collections
const BookingGroup = require('../../_common/models/booking-group');
const BookingResource = require('../../_common/models/booking-resource');
const Holiday = require('../../_common/models/holiday');
const BookingProject = require('../../_common/models/booking-project');
const BookingEvent = require('../../_common/models/booking-event');
const BookingWorkType = require('../../_common/models/booking-work-type');
const User = require('../../_common/models/user');

exports = module.exports;

// *******************************************************************************************
// GET DATA
// *******************************************************************************************
exports.getResourceGroups = async () => {
    const groups = await BookingGroup.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(groups);
};

exports.getResources = async () => {
    const resources = await BookingResource.find({},{__v:false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(resources);
};

exports.getHolidays = async () => {
    const holidays = await Holiday.find().lean();
    return holidays.length > 0 ? holidays[0].days : holidays
};

exports.getProjects = async () => {
    const projects = await BookingProject.find({deleted: null, archived: false},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false }).lean();
    return dataHelper.getObjectOfNormalizedDocs(projects);
};

exports.getEvents = async () => {
    const projects = await BookingProject.find({deleted: null, archived: false}, {_id: true}).lean();
    const projectIds = projects.map(project => project._id);
    const events = await BookingEvent.find({project: {$in: projectIds}, archived: false},{__v: false, 'days.__v': false, 'days._id': false, archived: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(events);
};

exports.getJobs = async () => {
    const jobs = await BookingWorkType.find({bookable: true},{__v: false, K2ids: false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(jobs);
};

exports.getUsers = async () => {
    const users = await User.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(users)
};




