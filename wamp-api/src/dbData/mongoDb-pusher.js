'use strict';
const mongoose = require('mongoose');
const moment = require('moment');

//Collections
const PusherWorklog = require('../models/pusher-worklog');
const User = require('../models/user');
const BookingResource = require('../models/booking-resource');

// *********************************************************************************************************************
// GET USER BY SSO-ID
// *********************************************************************************************************************
exports.getUserBySsoId = async (ssoId, nullIfNotFound) => {
    const user = await User.findOne({ssoId: ssoId}).lean();
    if(!user) {
        if(nullIfNotFound) return null;
        else throw new Error(`No user for ssoId: ${ssoId}`);
    }
    const resource = await BookingResource.findOne({_id: user.resource}, {K2id: true}).lean();
    return {id: user._id.toString(), resource: resource ? resource._id.toString() : null, K2id: resource ? resource.K2id : null, name: user.name, email: user.email ? user.email : null, role: user.role, access: user.access};
};

// *********************************************************************************************************************
// GET WORK-LOGS FOR USER
// *********************************************************************************************************************
exports.getWorklogsForUser = async (user, full) => {
    const userIds = await exports.getUserBySsoId(user);
    const logs = await PusherWorklog.find({approved: false}).populate('project job operatorJob').lean();
    const projectsWithLogs = logs.reduce((output, log) => {
        const logK2id = log.operatorName.toLowerCase() + '.' + log.operatorSurname.toLowerCase();

        const logApproval = getLogStatus(log); //current status of log approval
        let logUserRole = getLogRole(log, userIds); //user's role(s) for the project which log belongs to

        // if user has any role for this log and it is not log about own work (excluded manager but it should never happen)
        let sendToThisUser =  !log.resolve && logUserRole.length > 0 && (logK2id != userIds.K2id || log.project.manager == userIds.id);

        // exclude if approval is already done by this user (role)
        if(sendToThisUser) {
            sendToThisUser = logUserRole.reduce((out, role) => {
                if (logApproval[role] === 0) return true;
                else return out;
            }, false);
        }
        // if user is manager of the project and it is not send by previous conditions
        // all approval are done but obviously still not approved - it means need final decision from manager
        // ANY WEIRED approval
        let managersDecision = false;
        if(full || (!log.resolve && !sendToThisUser && logUserRole.indexOf('manager') >= 0)) { //} log.project.manager == userIds.id)) {
            const complete = logApproval.manager !== 0 && logApproval.supervisor !== 0 && logApproval.lead2D !== 0 && logApproval.lead3D !== 0 && logApproval.producer !== 0 && logApproval.leadMP !== 0;
            const someWeired = logApproval.manager === 3 || logApproval.supervisor === 3 || logApproval.lead2D === 3 || logApproval.lead3D === 3 || logApproval.producer === 3 || logApproval.leadMP === 3;
            const someOk = logApproval.manager === 1 || logApproval.supervisor === 1 || logApproval.lead2D === 1 || logApproval.lead3D === 1 || logApproval.producer === 1 || logApproval.leadMP === 1;

            managersDecision = complete && (someWeired || !someOk);

            sendToThisUser = managersDecision;
        }
        if(full) {
            sendToThisUser = true;
            logUserRole = ['manager','supervisor','lead2D','lead3D', 'leadMP', 'producer'];
        }
        // if user is producer and log needs to be resolved
        if(!sendToThisUser && log.resolve && userIds.role.indexOf('booking:worklog-resolver') >= 0) {// PRODUCERS.indexOf(user) >= 0 ) {
            sendToThisUser = true;
        }
        if(sendToThisUser) {
            const _log = {
                id: log._id,
                operator: log.operatorName.toUpperCase() + ' ' + log.operatorSurname.toUpperCase(),
                date: moment(log.date).format(),
                work: log.job.shortLabel,
                hours: log.hours,
                description: log.description,
                roles: logUserRole,
                approval: logApproval,
                finalApprove: managersDecision,
                resolve: log.resolve
            };
            if(output[log.project._id]) {
                output[log.project._id].logs.push(_log);
            } else {
                output[log.project._id] = {
                    id: log.project._id,
                    label: log.project.label,
                    logs: [_log]
                }
            }
            return output;
        } else return output;

    }, {});

    // convert object to array and sort  logs by date
    const result = Object.keys(projectsWithLogs).map(projectId => {
        const project = projectsWithLogs[projectId];
        project.logs = project.logs.sort((a,b) => {
            const aa = a.resolve ? 2 : a.finalApprove ? 1 : 0;
            const bb = b.resolve ? 2 : b.finalApprove ? 1 : 0;
            const importanceComare = aa - bb;
            if(importanceComare !== 0) return importanceComare;
            const dateCompare = new Date(a.date) - new Date(b.date);
            if(dateCompare !== 0) return dateCompare;
            const operatorCompare =  (a.operator < b.operator) ? -1 : (a.operator > b.operator) ? 1 : 0;
            if(operatorCompare !== 0) return operatorCompare;
            const hoursCompare = b.hours - a.hours;
            if(hoursCompare !== 0) return hoursCompare;
            return (a.description < b.description) ? -1 : (a.description > b.description) ? 1 : 0;
        });
        return project;
    });

    return result.sort((a, b) => {return (a.label < b.label) ? -1 : (a.label > b.label) ? 1 : 0});
};

// -------------- HELPERS ----------------------------------------------------------------------------------------------

// --------------------------------------------------
// current status of log for all relevant approvers
// --------------------------------------------------
// 0 = not approved, 1,2,3 = approved ok, maybe, wired, 4 = own log, 5 = approve is not required
function getLogStatus(log) {
    const logOperator = log.operator ? log.operator.toString() : null; //user ID

    // if project role exists => set log status otherwise 5
    const logStatus = {
        manager: log.project.manager ? log.confirmManager : 5,
        supervisor: log.project.supervisor ? log.confirmSupervisor : 5,
        lead2D: log.project.lead2D ? log.confirm2D : 5,
        lead3D: log.project.lead3D ? log.confirm3D : 5,
        leadMP: log.project.leadMP ? log.confirmMP : 5
    };

    // if it is own log - set 4
    if(log.project.manager  && log.project.manager == logOperator) logStatus.manager = 4;
    if(log.project.supervisor  && log.project.supervisor == logOperator) logStatus.supervisor = 4;
    if(log.project.lead2D  && log.project.lead2D == logOperator) logStatus.lead2D = 4;
    if(log.project.lead3D  && log.project.lead3D == logOperator) logStatus.lead3D = 4;
    if(log.project.leadMP  && log.project.leadMP == logOperator) logStatus.leadMP = 4;

    // set 5 if log.job.type is not required to be approved by the role
    switch(log.job.type) {
        case 'GR': // grading only manager
            logStatus.supervisor = 5;
            logStatus.lead2D = 5;
            logStatus.lead3D = 5;
            logStatus.leadMP = 5;
            break;
        case '2D': // 2D - manager, supervisor, lead2D
            logStatus.lead3D = 5;
            logStatus.leadMP = 5;
            break;
        case '3D': // 3D - manager, supervisor, lead3D
            logStatus.lead2D = 5;
            logStatus.leadMP = 5;
            break;
        case 'MP': // MP - all
            break;
        case 'SV': // SV - manager and supervisor
            logStatus.lead2D = 5;
            logStatus.lead3D = 5;
            logStatus.leadMP = 5;
            break;
        case 'OV':
        case 'TW': // OV and TW - if there is operator job -> lead2d = GR and 2D, lead3D = 3D, leadMP = MP
            if(log.operatorJob) {
                if(log.operatorJob.type !== '2D' && log.operatorJob.type !== 'GR') logStatus.lead2D = 5;
                if(log.operatorJob.type !== '3D') logStatus.lead3D = 5;
                if(log.operatorJob.type !== 'MP') logStatus.leadMP = 5;
            }
            break;
        //TODO solve DEV and SUP mapped to 2D, 3D, leads....
    }
    // producer approve log of supervisor of the project
    logStatus.producer = log.project.supervisor && log.project.supervisor == logOperator ? log.confirmProducer : 5;

    /*
    return {
        manager: log.project.manager ? log.project.manager == logOperator ? 4 : log.confirmManager : null,
        supervisor: log.job.type === 'GR' ? 5 : log.project.supervisor ? log.project.supervisor == logOperator ? 4 : log.confirmSupervisor : null,
        lead2D: ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type !== '2D' && log.operatorJob.type !== 'GR') || log.job.type === 'GR' || log.job.type === '3D'  || log.job.type === 'SV' ? 5 :                           log.project.lead2D  ?    log.project.lead2D == logOperator ? 4 : log.confirm2D : null,
        lead3D: ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type !== '3D') || log.job.type === 'GR' || log.job.type === '2D' || log.job.type === 'SV' ? 5 :                           log.project.lead3D  ?    log.project.lead3D == logOperator ? 4 : log.confirm3D : null,
        leadMP: ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type !== 'MP') || log.job.type === 'GR' || log.job.type === '2D' || log.job.type === '3D'  || log.job.type === 'SV' ? 5 : log.project.leadMP  ?    log.project.leadMP == logOperator ? 4 : log.confirmMP : null,
        producer: log.project.supervisor && log.project.supervisor == logOperator ? log.confirmProducer : 5
    };
    */
    return logStatus;
}
// --------------------------------------------------
// user role for log
// --------------------------------------------------
function getLogRole(log, userIds) {
    const logOperator = log.operator ? log.operator.toString() : null; //user ID
    const logUserRole = [];

    //TODO solve DEV and SUP mapped to 2D, 3D, leads....
    if(log.project.manager == userIds.id    &&    ['2D','3D','MP','GR','OV','TW','SV'].indexOf(log.job.type) >= 0) logUserRole.push('manager');
    if(log.project.supervisor == userIds.id &&    ['2D','3D','MP',     'OV','TW','SV'].indexOf(log.job.type) >= 0) logUserRole.push('supervisor');
    if(log.project.lead2D == userIds.id     &&   (['2D','MP'].indexOf(log.job.type) >= 0 || ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && (log.operatorJob.type === '2D' || log.operatorJob.type === 'GR')))) logUserRole.push('lead2D');
    if(log.project.lead3D == userIds.id     &&   (['3D','MP'].indexOf(log.job.type) >= 0 || ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type === '3D'))) logUserRole.push('lead3D');
    if(log.project.leadMP == userIds.id     &&   (['MP'].indexOf(log.job.type) >= 0      || ((log.job.type === 'OV' || log.job.type === 'TW') && log.operatorJob && log.operatorJob.type === 'MP'))) logUserRole.push('leadMP');

    if(logOperator != userIds.id && userIds.role.indexOf('booking:main-producer') >= 0 && log.project.supervisor && log.project.supervisor == logOperator) logUserRole.push('producer');

    return logUserRole;
}