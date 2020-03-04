'use strict';
const mongoose = require('mongoose');
const dataHelper = require('../../_common/lib/dataHelper');
const logger = require('../logger');

//Collections
const BookingGroup = require('../../_common/models/booking-group');
const BookingResource = require('../../_common/models/booking-resource');
const Holiday = require('../../_common/models/holiday');
const BookingProject = require('../../_common/models/booking-project');
const BookingEvent = require('../../_common/models/booking-event');
const BookingWorkType = require('../../_common/models/booking-work-type');
const User = require('../../_common/models/user');
const Project = require('../../_common/models/project');

const projectToBooking = require('../../_common/lib/projectToBooking');

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

exports.getProjects = async () => { //TODO xBPx
    const bookingProjects = await BookingProject.find({deleted: null, archived: false, mergedToProject: null},{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false, checked: false, mergedToProject: false }).lean();
    const projects = await Project.find({deleted: null, archived: null, booking: true}, {_id: true, name: true, team: true, bookingBudget: true, K2: true, invoice: true, timing: true, bookingType: true, events: true, work: true, bookingNote: true, kickBack: true, created: true}).lean();
    return dataHelper.getObjectOfNormalizedDocs(bookingProjects.concat(projects.map(projectToBooking)));
};

exports.getEvents = async idsOfProjects => { //TODO xBPx
    if(typeof idsOfProjects === 'undefined') {
        const bookingProjects = await BookingProject.find({deleted: null, archived: false, mergedToProject: null}, {_id: true}).lean();
        const bookingProjectIds = bookingProjects.map(bookingProject => bookingProject._id);

        const projects = await Project.find({deleted: null, archived: null, booking: true}, {_id: true}).lean();
        const projectsIds = projects.map(project => project._id);
        idsOfProjects = bookingProjectIds.concat(projectsIds);
    }
    const events = await BookingEvent.find({project: {$in: idsOfProjects}, archived: false},{__v: false, 'days.__v': false, archived: false}).lean();
    return  dataHelper.getObjectOfNormalizedDocs(events);
};

exports.getJobs = async () => {
    const jobs = await BookingWorkType.find({bookable: true},{__v: false, K2ids: false, tariff: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(jobs);
};

exports.getUsers = async () => {
    const users = await User.find({},{__v:false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(users)
};




