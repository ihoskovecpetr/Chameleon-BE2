'use strict';

const mongoose = require('mongoose');
const dataHelper = require('../lib/dataHelper');
const logger = require('../logger');

//Collections
const BookingProject = require('../models/booking-project');
const BookingResource = require('../models/booking-resource');
const BookingWorkType = require('../models/booking-work-type');
const User = require('../models/user');
const BookingEvent = require('../models/booking-event');
const BookingOplog = require('../models/booking-oplog');

exports = module.exports;
// *********************************************************************************************************************
// DB LOGGING
// *********************************************************************************************************************
exports.logOp = async (type, user, data, err) => {
    await BookingOplog.create({type: type, user: user, data: data, success: !err, reason: err});
};

// *********************************************************************************************************************
// Get K2 linked projects
// *********************************************************************************************************************
exports.getK2linkedProjects = async projectId => {
    const query = {deleted: null, $and: [{K2rid : {$ne: null}}, {K2rid: {$ne: '0'}}]};
    if(projectId) query._id = projectId;
    return await BookingProject.find(query, {__v:false, 'jobs.__v':false, 'jobs._id':false, 'timing.__v':false, 'timing._id':false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v':false, deleted:false }).lean();
};

// *********************************************************************************************************************
// Get Resource map
// *********************************************************************************************************************
exports.getResourcesMap = async () => {
    const resources = await BookingResource.find({type: 'OPERATOR', K2id: {$ne: null}}, 'K2id job').lean();
    const users = await User.find({}, 'resource').lean();
    return dataHelper.mapResources(resources, users);
};

// *********************************************************************************************************************
// Get WorkType map
// *********************************************************************************************************************
exports.getWorkTypeMap = async () => {
    const workTypes = await BookingWorkType.find({},{K2ids: true, bookable: true, multi: true}).lean();
    return dataHelper.mapJobs(workTypes);
};

// *********************************************************************************************************************
// Get Project Operators Efficiency
// *********************************************************************************************************************
exports.getProjectOperatorsEfficiency = async eventIds => {
    const events = await Promise.all(eventIds.map(eventId => BookingEvent.findOne({_id: eventId, operator: {$ne: null}}, {operator : true, efficiency: true, job: true, _id: false})));
    return dataHelper.mapEffeciency(events);
};

// *********************************************************************************************************************
// Update booking project
// *********************************************************************************************************************
exports.updateProject = async (id, project) => {
    logger.debug(`Updating project: ${id}`);
    await BookingProject.findOneAndUpdate({_id: id}, {$set: project});
};