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

exports = module.exports;
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
