'use strict';

const logger = require('../logger');
const db = require('../dbData/mongoDbData');
const path = require('path');
const SSHClient = require('ssh2').Client;
const fs = require('fs');

let privateKey = null;

module.exports = async () => {
    logger.debug('Project Archive Job Fired - Skipped for now');
    return;
    const processTasks = await db.getProcessTasks(); //TODO carefully test what return this function (projectId ????)
    for (const task of processTasks) {
        const reviewOpened = task.followed.some(reviewTask => reviewTask.resolved === null);
        if(!reviewOpened) {
            const someReviewCanceled = task.followed.some(reviewTask => reviewTask.dataTarget && reviewTask.dataTarget.canceled);
            if(someReviewCanceled) {
                await db.updateArchiveTask(task._id, {resolved: moment(), dataTarget: {canceled: true}});
            } else {
                if (task.project.projectId) {
                    let checks = '';
                    try {
                        delete task.dataOrigin.boogie;
                        task.followed.forEach(reviewTask => {
                            if(reviewTask.dataTarget && reviewTask.dataTarget.bypass) {
                                reviewTask.dataTarget.bypass.forEach(key => {
                                    if(task.dataOrigin[key]) task.dataOrigin[key] = false;
                                })
                            }
                        });
                        checks = Object.keys(task.dataOrigin).filter(key => task.dataOrigin[key]).join(' ');
                        const archiveResult = await reklamaArchive(task.project.projectId, checks, false); //TODO true for real archive
                        await db.updateArchiveTask(task._id, {resolved: moment(), dataTarget: {projectFolder: path.basename(archiveResult.data.projectFolder)}});
                        logger.warn(`Project "${task.project._id}" ready for archive with flags "${checks}", but the control file was not actually edited in beta testing`); //TODO remove for final version
                    } catch (e) {
                        if(e.code) {
                            switch(e.code) {
                                case 1:
                                case 2:
                                case 5:
                                case 6:
                                    await db.createArchiveReviewTask(task, {error: e.errorMessage});
                                    logger.warn(`ProjectArchive error, project: ${task.project._id}. Error: ${e.errorMessage}`);
                                    break;
                                case 3:
                                    await db.createArchiveReviewTask(task, {error: e.errorMessage, projectFolder: e.data.projectFolder});
                                    logger.warn(`ProjectArchive error, project: ${task.project._id}. Error: ${e.errorMessage}, ${e.data.projectFolder}`);
                                    break;
                                case 4:
                                    await db.createArchiveReviewTask(task, e.data, session);
                                    break;
                                default:
                                    await db.createArchiveReviewTask(task, {error: `Unknown error. Exit code: ${e.code}`});
                                    logger.warn(`ProjectArchive - unknown error, project: ${task.project._id}. Error: ${e}`);
                                    break;
                            }
                        } else {
                            await db.createArchiveReviewTask(task, {error: "Unknown error"});
                            logger.warn(`ProjectArchive - unknown error, project: ${task.project._id}. Error: ${e}`);
                        }
                    }
                } else {
                    logger.warn(`Can't start archive of project: ${task.project.label} [${task.project._id}]. Missing K2 project ID.`);
                    await db.createArchiveReviewTask(task, {error: "Missing K2 project ID."});
                }
            }
        }
    }
};
// *********************************************************************************************************************
// HELPERS
// *********************************************************************************************************************
const SSH_HOST = 'transcoder01';
const SSH_USER = 'miroslav.kozel';
const SSH_USER_KEY_PATH = '/Users/miroslav.kozel/.ssh/mkozel.rsa';
const REMOTE_BASH_PATH = '~/reklama_archive/reklama_archive.sh';

function reklamaArchive(projectId, check, archive, verbose) {
    return new Promise((resolve, reject) => {
        execRemoteCommand(`${REMOTE_BASH_PATH} ${projectId ? `-i ${projectId}` : ''}${check ? ` -c ${check}` : ''}${archive ? ' -a' : ''}${verbose ? ' -v' : ''}`)
            .then(data => {
                resolve(data)
            })
            .catch(data => {
                reject(data)
            })
    })
}

function execRemoteCommand(command) {
    return new Promise((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        try {if (!privateKey) privateKey = fs.readFileSync(SSH_USER_KEY_PATH)} catch(e) {reject({error: e})}
        if(privateKey) {
            const conn = new SSHClient();
            conn.on('ready', () => {
                conn.exec(`${command}`, (err, stream) => {
                    if (err) reject({error: err});
                    stream.on('close', (code, signal) => {
                        if(code !== 0 || errorOutput) reject({error: new Error(errorOutput.trim()), code:code, signal: signal, data: parseOutputLines(output.trim().split('\n')), errorMessage: errorOutput.trim()});
                        else resolve({ok: true, data: parseOutputLines(output.trim().split('\n'))});
                        conn.end();
                    }).on('data', data => {
                        output += data;
                    }).on('error', err => {
                        reject({error: err, data: parseOutputLines(output.trim().split('\n')), errorMessage: errorOutput.trim()});
                    }).stderr.on('data', (data) => {
                        errorOutput += data;
                    });
                });
            }).on('error', (err) => {
                reject({error: err});
            }).connect({
                host: SSH_HOST,
                port: 22,
                username: SSH_USER,
                privateKey: privateKey
            });
        }
    })
}

function parseOutputLines(data) {
    const output = {};
    for(let i=0; i < data.length; i++) {
        const fieldName = data[i].match(/^\[(.*)]$/);
        if(fieldName && i < data.length - 1) {
            const arrayLength = data[i + 1].match(/#(\d+)/);
            if(arrayLength) {
                output[convertFieldName(fieldName[1])] = data.slice(i + 2, i + 2 + arrayLength[1]);
                i = i + 1 + arrayLength[1];
            }
            else {
                output[convertFieldName(fieldName[1])] = data[i+1];
                i++;
            }
        }
    }
    return output
}

function convertFieldName(source) {
    const name =  source.toLowerCase().split('_');
    if(name && name.length > 1) {
        for(let i = 1; i < name.length; i++) name[i] = `${name[i].charAt(0).toUpperCase()}${name[i].substr(1)}`;
        return name.join('');
    } else return source;
}

