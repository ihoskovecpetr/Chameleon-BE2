'use strict';

const logger = require('../logger');
const moment = require('moment');
const wamp = require('../wamp');
const k2 = require('../k2-mssql');
const mongoose = require('mongoose');
const db = require('../dbData/mongoDbData');
const dataHelper = require('../lib/dataHelper');

module.exports = async projectId => {
    const dbConnected = mongoose.connection.readyState === 1; //0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    logger.debug(`K2 Job Fired [db connected: ${dbConnected}]${projectId ? ` - check only single project: ${projectId}` : ''}`);
    if(dbConnected) {
        try {
            const today = moment().startOf('day');
            let projects = await db.getK2linkedProjects(projectId);
            const resources = await db.getResourcesMap();
            const workTypes = await db.getWorkTypeMap();
            for(const project of projects) {
                let projectUpdated = false;
                const workLogPusher = [];
                const efficiency = await db.getProjectOperatorsEfficiency(project.events);
                const K2project = await k2.getK2project(project.K2rid);
                if(K2project.length > 0) {
                    if (project.K2client !== K2project[0].Zkr) {
                        project.K2client = K2project[0].Zkr;
                        projectUpdated = true;
                    }
                    if (project.K2name !== K2project[0].Popis) {
                        project.K2name = K2project[0].Popis;
                        projectUpdated = true;
                    }
                }
                const workLog = await k2.getK2workLog(project.K2rid);
                const work = workLog.map(log => {
                    let logKod = log.Kod.trim();
                    if(logKod === 'OV' && log.Zkr.trim() === 'TASK WORK') logKod = 'TW';
                    if(logKod === 'OV' && log.Zkr.trim() === 'PROGRAMATOR') logKod = 'PG';

                    // INTERNI_GRADING - ObjectId = 586ce3fca6bf9a09681bd7e0, K2rid = 73005854097557 set as OV !!!!!!
                    if(project.K2rid == '73005854097557') logKod = 'OV';
                    //detect new workTypes - support, development - Kod = 'IT'
                    const operator = resources[log.Jmno.trim().toLowerCase() + '.' + log.Prij.trim().toLowerCase()];
                    let job = workTypes[logKod] ? workTypes[logKod].id : null;
                    const jobIsBookable = workTypes[logKod] ? workTypes[logKod].bookable : false;
                    const jobIsMultiBookable = workTypes[logKod] && operator ? workTypes[logKod].multi : false;
                    if (!job) return null;
                    let duration = log.Mnoz;
                    switch (log.Abbr.trim()) {
                        case 'hod':
                            duration = duration * 60;
                            break;
                        case 'min':
                            break;
                        default:
                            return null;
                    }
                    const logDate = moment(log['ReservationDate']).startOf('day');
                    const logAge = today.diff(logDate,'days');
                    // *****************************************************************************
                    // DATA FOR PUSHER
                    // *****************************************************************************

                    const MAX_AGE_OF_LOGS = 10; //days
                    if(logAge <= MAX_AGE_OF_LOGS) {
                        workLogPusher.push({
                            _id: log['ProdejRID'].trim(),
                            project: project._id,
                            operatorSurname: log['Prij'].trim(),
                            operatorName: log['Jmno'].trim(),
                            operator: operator ? operator.user : null,
                            date: logDate.toDate(),
                            job: job,
                            operatorJob: operator ? operator.job : null,
                            hours: Math.round(duration / 6) / 10,
                            description: log['EX_Popis'].trim()
                        });
                    }

                    // *****************************************************************************
                    if(logAge <= 0) return null; //use only logs from yesterday and more (add hours after midnight)
                    //if not bookable or multiBookable job return null !!!!
                    if(!jobIsBookable && !jobIsMultiBookable) return null;

                    if(jobIsMultiBookable) job = operator.job;

                    const eff = operator ? efficiency[operator.resource + '@' + job] : null;
                    if (eff) duration = Math.round(duration * eff.sum / eff.count) / 100;
                    if(duration > 0) return {job: job, duration: duration};
                    else return null;
                }).reduce((output, item) => {
                    if(item) {
                        if (output[item.job]) {
                            output[item.job] += item.duration;
                        } else output[item.job] = item.duration;
                    }
                    return output;
                },{});

                let removeSome = false;
                for(let i = 0; i < project.jobs.length; i++) {
                    if(work[project.jobs[i].job]) {
                        if(project.jobs[i].doneDuration !== work[project.jobs[i].job]) {
                            project.jobs[i].doneDuration = work[project.jobs[i].job];
                            projectUpdated = true;
                        }
                        delete work[project.jobs[i].job]; // remove used to see logged jobs not yet in project....
                    } else {
                        if(project.jobs[i].doneDuration !== 0) {
                            project.jobs[i].doneDuration = 0;
                            removeSome = project.jobs[i].plannedDuration === 0;
                            projectUpdated = true;
                        }
                    }
                }

                if(removeSome) project.jobs = project.jobs.filter(item => {
                    return item.plannedDuration > 0 || item.doneDuration > 0;
                });

                if(Object.keys(work).length > 0) {
                    Object.keys(work).forEach(job => {
                        project.jobs.push({
                            job: job,
                            doneDuration: work[job],
                            plannedDuration: 0
                        });
                    });
                    projectUpdated = true;
                }

                if(projectUpdated) {
                    const result = exports.getNormalizedProject(project);
                    try {
                        await db.updateProject(project._id, project);
                        wamp.publish('updateProject', [], result);
                        logger.debug(`Project ${result.project.label} [${result.id}] updated by K2 data.`);
                        await db.logOp('updateProjectK2', '888888888888888888888888', result, null);
                    } catch(error) {
                        await db.logOp('updateProjectK2', '888888888888888888888888', result, error);
                        logger.warn(`Update Project ${result.label} [${result.id}] by K2 data error: ${error}`);
                    }
                }
                // DATA FOR PUSHER
                for(const worklog of workLogPusher) {
                    try {
                        const oldLog = await db.addOrUpdateWorklog(worklog);
                        if(!oldLog)  logger.debug(`Inserted new worklog: ${worklog._id}`);
                    } catch(error) {
                        logger.warn(`Update / Insert worklog error: ${error}`);
                    }
                }
            }
        } catch (error) {
            logger.warn(`K2 Job error: ${error}`);
        }
    }
};

// *********************************************************************************************************************
// get normalized project for wamp (booking)
// *********************************************************************************************************************
exports.getNormalizedProject = source => {
    const project = {...dataHelper.normalizeDocument(source)};
    const id = project._id.toString();
    delete project._id;
    return {id: id, project: project};
};