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
                //Update K2client and K2name if was changed
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

                //get worklogs for current project
                const projectWorkLogs = await k2.getK2workLog(project.K2rid, ['OV', 'SV', '2D', '3D', 'MP', 'BL', 'FL', 'IT']); //internal, supervision, 2D - 1, 3D, Matte Paint, Grading, 2D -2, IT??

                //map projectWorkLogs to {job, duration} and then make map job: duration  + add worklog to workLogPusher (if age < 20? days)
                const projectJobDurationMap = projectWorkLogs.map(workLog => {
                    let logKod = workLog.Kod.trim();
                    if(logKod === 'OV' && workLog.Zkr.trim() === 'TASK WORK') logKod = 'TW';
                    if(logKod === 'OV' && workLog.Zkr.trim() === 'PROGRAMATOR') logKod = 'PG';
                    if(logKod === '2D' && workLog.Zkr.trim() === 'ONLINE PREP') logKod = 'OP';

                    // INTERNI_GRADING - ObjectId = 586ce3fca6bf9a09681bd7e0, K2rid = 73005854097557 set as OV !!!!!!
                    if(project.K2rid == '73005854097557') logKod = 'OV';
                    //detect new workTypes - support, development - Kod = 'IT'
                    const operator = resources[workLog.Jmno.trim().toLowerCase() + '.' + workLog.Prij.trim().toLowerCase()];
                    let job = workTypes[logKod] ? workTypes[logKod].id : null;
                    const jobIsBookable = workTypes[logKod] ? workTypes[logKod].bookable : false;
                    const jobIsMultiBookable = workTypes[logKod] && operator ? workTypes[logKod].multi : false;
                    if (!job) return null;
                    let duration = workLog.Mnoz;
                    switch (workLog.Abbr.trim()) {
                        case 'hod':
                            duration = duration * 60;
                            break;
                        case 'min':
                            break;
                        default:
                            return null;
                    }
                    const logDate = moment(workLog['ReservationDate']).startOf('day');
                    const logAge = today.diff(logDate,'days');
                    // *****************************************************************************
                    // DATA FOR PUSHER
                    // *****************************************************************************

                    const MAX_AGE_OF_LOGS = 20; //days
                    if(logAge <= MAX_AGE_OF_LOGS) {
                        workLogPusher.push({
                            _id: workLog['ProdejRID'].trim(),
                            project: project._id,
                            operatorSurname: workLog['Prij'].trim(),
                            operatorName: workLog['Jmno'].trim(),
                            operator: operator ? operator.user : null,
                            date: logDate.toDate(),
                            job: job,
                            operatorJob: operator ? operator.job : null,
                            hours: Math.round(duration / 6) / 10,
                            description: workLog['EX_Popis'].trim()
                        });
                    }

                    // *****************************************************************************
                    if(logAge <= 0) return null; //use only logs from yesterday and more (add hours after midnight)
                    //if not bookable or multiBookable job return null !!!!
                    if(!jobIsBookable && !jobIsMultiBookable) return null;

                    if(jobIsMultiBookable) job = operator.job;

                    const eff = operator ? efficiency[operator.resource + '@' + job] : null;
                    if (eff) duration = Math.round(duration * eff.sum / eff.count) / 100;
                    if(duration > 0) return {job: job, duration: duration}; //MAIN MAP OUTPUT
                    else return null;
                }).reduce((output, item) => {
                    if(item) {
                        if (output[item.job]) {
                            output[item.job] += item.duration;
                        } else output[item.job] = item.duration;
                    }
                    return output; //OBJECT OUTPUT - removed null, set map job => duration
                },{});

                let removeSome = false;

                //check if duration of project's job has been changed
                for(let i = 0; i < project.jobs.length; i++) {
                    const projectWork = project.jobs[i];
                    if(projectJobDurationMap[projectWork.job]) {
                        if(projectWork.doneDuration !== projectJobDurationMap[projectWork.job]) {
                            //logger.debug(`Duration of job ${projectWork.job} of ${project.label} changed :: ${projectWork.doneDuration} -> ${projectJobDurationMap[projectWork.job]}, h diff: ${Math.round((projectJobDurationMap[projectWork.job] - projectWork.doneDuration) / 6) / 10}`);
                            projectWork.doneDuration = projectJobDurationMap[projectWork.job];
                            projectUpdated = true;
                        }
                        delete projectJobDurationMap[projectWork.job]; // remove used to see logged jobs not yet in project....
                    } else {
                        if(projectWork.doneDuration !== 0) {
                            projectWork.doneDuration = 0;
                            removeSome = projectWork.plannedDuration === 0;
                            projectUpdated = true;
                        }
                    }
                }

                if(removeSome) project.jobs = project.jobs.filter(item => {
                    return item.plannedDuration > 0 || item.doneDuration > 0;
                });

                if(Object.keys(projectJobDurationMap).length > 0) {
                    Object.keys(projectJobDurationMap).forEach(job => {
                        project.jobs.push({
                            job: job,
                            doneDuration: projectJobDurationMap[job],
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
                for(const workLog of workLogPusher) {
                    try {
                        const oldLog = await db.addOrUpdateWorklog(workLog);
                        if(!oldLog) {
                            logger.debug(`Inserted new WorkLog: ${workLog._id}, project: ${project.label}`);
                            if(!workLog.operator) logger.debug(`WorkLog operator '${workLog.operatorName}:${workLog.operatorSurname}' not recognised.`);
                        }
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