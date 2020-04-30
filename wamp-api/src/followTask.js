'use strict';

const moment = require('moment');

module.exports = task => {
    const followTasks = [];
    const followMessages = [];
    const followCommand = [];

    switch (task.type) {
        // *****************************************************************************************************
        // VFX ARCHIVE
        // *****************************************************************************************************
        case 'VFX_ARCHIVE_SUPERVISOR':
            if(task.dataTarget) {
                followTasks.push({
                    project: task.project._id,
                    type: 'VFX_ARCHIVE_MANAGER',
                    target: task.project.manager, //task.target._id
                    deadline: moment().add(10, 'days').startOf('day'),
                    dataOrigin: task.dataTarget
                });
            }
            break;
        case 'VFX_ARCHIVE_MANAGER':
            followTasks.push({
                project: task.project._id,
                type: 'VFX_ARCHIVE_OPERATOR',
                target: task.dataTarget.operator, //task.target._id
                deadline: moment().add(task.dataTarget.dueTo, 'days').startOf('day'),
                dataOrigin: {note: task.dataTarget.note ? task.dataTarget.note : null}
            });
            break;
        case 'VFX_ARCHIVE_OPERATOR':
            followMessages.push({
                type: 'INFO',
                label: task.project.label,
                message: 'Data for VFX archive done by ' + task.target.name,
                details: 'Archive data path: ' + task.dataTarget.link,
                target: task.project.manager, //task.target._id
                deadline: moment().add(10, 'days').startOf('day')
            });
            break;
        // *****************************************************************************************************
        // ARCHIVE
        // *****************************************************************************************************
        case 'ARCHIVE_MANAGER_PREPARE':
            if(task.dataTarget && (task.dataTarget.operator2D || task.dataTarget.operator3D || task.dataTarget.operatorMP)) {
                if(task.dataTarget.operator2D) { // 2D first
                    followTasks.push({
                        project: task.project._id,
                        type: 'ARCHIVE_2D_LEAD',
                        target: task.dataTarget.operator2D,
                        deadline: moment().add(3, 'days').startOf('day'),
                        dataOrigin: task.dataTarget
                    });
                } else if(task.dataTarget.operator3D) { // no 2D, than 3D
                    followTasks.push({
                        project: task.project._id,
                        type: 'ARCHIVE_3D_LEAD',
                        target: task.dataTarget.operator3D,
                        deadline: moment().add(3, 'days').startOf('day'),
                        dataOrigin: task.dataTarget
                    });
                } else if(task.dataTarget.operatorMP) { // no 3D, than MP
                    followTasks.push({
                        project: task.project._id,
                        type: 'ARCHIVE_MP_LEAD',
                        target: task.dataTarget.operatorMP,
                        deadline: moment().add(3, 'days').startOf('day'),
                        dataOrigin: task.dataTarget
                    });
                }
            } else { //No preparation needed - back to manager
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_MANAGER',
                    target: task.project.manager,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataTarget
                });
            }
            break;

        case 'ARCHIVE_2D_LEAD':
            if(task.dataOrigin && task.dataOrigin.operator3D) { //3D exists
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_3D_LEAD',
                    target: task.dataOrigin.operator3D,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataOrigin
                });
            } else if(task.dataOrigin && task.dataOrigin.operatorMP) {
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_MP_LEAD',
                    target: task.dataOrigin.operatorMP,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataOrigin
                });
            } else { //back to manager
                if(!task.dataOrigin && task.dataTarget && task.dataTarget.bigArchive) task.dataOrigin = {};
                if(task.dataTarget && task.dataTarget.bigArchive) task.dataOrigin.bigArchive2D = true;
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_MANAGER',
                    target: task.project.manager,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataOrigin
                });
            }
            break;

        case 'ARCHIVE_3D_LEAD':
            if(task.dataOrigin && task.dataOrigin.operatorMP) {
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_MP_LEAD',
                    target: task.dataOrigin.operatorMP,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataOrigin
                });
            } else {
                if(!task.dataOrigin && task.dataTarget && task.dataTarget.bigArchive) task.dataOrigin = {};
                if(task.dataTarget && task.dataTarget.bigArchive) task.dataOrigin.bigArchive3D = true;
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_MANAGER',
                    target: task.project.manager,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataOrigin
                });
            }
            break;

        case 'ARCHIVE_MP_LEAD':
            if(!task.dataOrigin && task.dataTarget && task.dataTarget.bigArchive) task.dataOrigin = {};
            if(task.dataTarget && task.dataTarget.bigArchive) task.dataOrigin.bigArchiveMP = true;
            followTasks.push({
                project: task.project._id,
                type: 'ARCHIVE_MANAGER',
                target: task.project.manager,
                deadline: moment().add(3, 'days').startOf('day'),
                dataOrigin: task.dataOrigin
            });
            break;

        case 'ARCHIVE_MANAGER':
            followTasks.push({
                project: task.project._id,
                type: 'ARCHIVE_ADV_MANAGER_UPLOAD',
                target: task.project.manager,
                deadline: moment().add(15, 'days').startOf('day'),
                dataOrigin: task.dataOrigin
            });
            followTasks.push({
                project: task.project._id,
                type: 'ARCHIVE_PROCESS',
                origin: task.target,
                dataOrigin: task.dataTarget.checkList
            });
            break;
        case 'ARCHIVE_ADV_MANAGER_UPLOAD':
            if(task.dataTarget) {
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_ADV_SUPERVISOR_TAGS',
                    target: task.project.supervisor ? task.project.supervisor : task.project.manager,
                    deadline: moment().add(15, 'days').startOf('day'),
                    dataOrigin: task.dataOrigin
                });
            }
            break;
        case 'ARCHIVE_MANAGER_CLEAN_VERSION':
            if(task.dataTarget && task.dataTarget.operator2D) {
                followTasks.push({
                    project: task.project._id,
                    type: 'ARCHIVE_2D_LEAD_CLEAN_VERSION',
                    target: task.dataTarget.operator2D,
                    deadline: moment().add(3, 'days').startOf('day'),
                    dataOrigin: task.dataTarget
                });
            }
            break;
        // *****************************************************************************************************
        // MAKING OF
        // *****************************************************************************************************
        case 'MAKING_OF_SUPERVISOR':
            if(task.dataTarget) {
                followTasks.push({
                    project: task.project._id,
                    type: 'MAKING_OF_PRODUCER',
                    target: {role: 'booking:main-producer'},
                    deadline: moment().add(5, 'days').startOf('day'),
                    dataOrigin: task.dataTarget
                });
            }
            break;
        case 'MAKING_OF_PRODUCER':
            const clipName1 = task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir.name ? task.dataOrigin.onAir.name : null;
            if(task.dataTarget) {
                followTasks.push({
                    project: task.project._id,
                    type: 'MAKING_OF_MANAGER',
                    target: task.project.manager,
                    deadline: moment().add(5, 'days').startOf('day'),
                    dataOrigin: task.dataTarget
                });
                followMessages.push({
                    type: 'INFO',
                    label: task.project.label + (clipName1 ? ' - ' + clipName1 : ''),
                    message: 'Producer has decided to create VFX breakdown',
                    target: {role: 'booking:pr-manager'},
                    deadline: moment().add(5, 'days').startOf('day')
                });
            }
            break;
        case 'MAKING_OF_MANAGER':
            if(task.dataTarget.operator) { //Deprecated from pusher 2.0.0
                followTasks.push({
                    project: task.project._id,
                    type: 'MAKING_OF_OPERATOR',
                    target: task.dataTarget.operator,
                    deadline: moment().add(task.dataTarget.dueTo, 'days').startOf('day'),
                    dataOrigin: {note: task.dataTarget.note ? task.dataTarget.note : null}
                });
            }
            if(task.dataTarget.operator2D) {
                followTasks.push({
                    project: task.project._id,
                    type: 'MAKING_OF_OPERATOR_2D',
                    target: task.dataTarget.operator2D,
                    deadline: moment().add(task.dataTarget.dueTo, 'days').startOf('day'),
                    dataOrigin: {note: task.dataTarget.note ? task.dataTarget.note : null, operator2D: task.dataTarget.operator2D ? task.dataTarget.operator2D : null, operator3D: task.dataTarget.operator3D ? task.dataTarget.operator3D : null}
                });
            }
            if(task.dataTarget.operator3D) {
                followTasks.push({
                    project: task.project._id,
                    type: 'MAKING_OF_OPERATOR_3D',
                    target: task.dataTarget.operator3D,
                    deadline: moment().add(task.dataTarget.dueTo, 'days').startOf('day'),
                    dataOrigin: {note: task.dataTarget.note ? task.dataTarget.note : null, operator2D: task.dataTarget.operator2D ? task.dataTarget.operator2D : null, operator3D: task.dataTarget.operator3D ? task.dataTarget.operator3D : null}
                });
            }
            break;
        case 'MAKING_OF_OPERATOR': //Deprecated from pusher 2.0.0
            const clipName2 = task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir.name ? task.dataOrigin.onAir.name : null;
            followMessages.push({
                type: 'INFO',
                label: task.project.label + (clipName2 ? ' - ' + clipName2 : ''),
                message: 'VFX breakdown done by ' + task.target.name,
                target: task.project.manager, //task.target._id
                deadline: moment().add(10, 'days').startOf('day')
            });
            break;
        case 'MAKING_OF_OPERATOR_2D':
            const clipName3 = task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir.name ? task.dataOrigin.onAir.name : null;
            followMessages.push({
                type: 'INFO',
                label: task.project.label + (clipName3 ? ' - ' + clipName3 : ''),
                message: 'VFX breakdown done by ' + task.target.name + ' (2D)',
                target: task.project.manager, //task.target._id
                deadline: moment().add(10, 'days').startOf('day')
            });
            break;
        case 'MAKING_OF_OPERATOR_3D':
            const clipName4 = task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir.name ? task.dataOrigin.onAir.name : null;
            followMessages.push({
                type: 'INFO',
                label: task.project.label + (clipName4 ? ' - ' + clipName4 : ''),
                message: 'VFX breakdown done by ' + task.target.name + ' (3D)',
                target: task.project.manager, //task.target._id
                deadline: moment().add(10, 'days').startOf('day')
            });
            break;
        // *****************************************************************************************************
        // FEEDBACK
        // *****************************************************************************************************
        case 'FEEDBACK_SHOOT_SUPERVISOR':
        case 'FEEDBACK_SUPERVISOR':
            //case 'FEEDBACK_MANAGER':
            if(task.dataTarget) {
                followTasks.push({
                    project: task.project._id,
                    type: 'FEEDBACK_FILL_MANAGER', //it is to Producer now
                    target:  task.project.producer ? task.project.producer : task.project.manager,
                    deadline: moment().add(15, 'days').startOf('day'),
                    dataOrigin: Object.assign(task.dataTarget, {who: task.target})
                });
            }
            break;
        // *****************************************************************************************************
        // ON-AIR
        // *****************************************************************************************************
        case 'ONAIR_CONFIRM':
            if(task.dataOrigin && task.dataTarget && task.dataTarget.confirmed) {
                followCommand.push({
                    command: 'updateOnairState',
                    project: task.project._id,
                    onair: task.dataOrigin.onAir._id,
                    state: 'fixed'
                });
            }
            break;
        // *****************************************************************************************************
        // CLOSE TO FINAL
        // *****************************************************************************************************
        case 'CLOSE_TO_FINAL':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'CLOSE_TO_FINAL_PRODUCER',
                    target: {role: 'booking:main-producer'},
                    deadline: moment().startOf('day'),
                    dataOrigin: {
                        note: task.dataTarget.note ? task.dataTarget.note : null
                    }
                });
            }
            break;
        // *****************************************************************************************************
        // PUBLISH
        // *****************************************************************************************************
        case 'PUBLISH_MANAGER_SHOW':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_PRODUCER_DECIDE',
                    target: {role: 'booking:main-producer'},
                    deadline: moment().add(5, 'days').startOf('day'),
                    dataOrigin: {
                        note: task.dataTarget.note ? task.dataTarget.note : null,
                        onAir: task.dataOrigin.onAir ? task.dataOrigin.onAir : null
                    }
                });
            } else {
                followCommand.push({
                    command: 'deleteOnair',
                    project: task.project._id,
                    onair: task.dataOrigin.onAir._id,
                });
            }
            break;
        case 'PUBLISH_PRODUCER_DECIDE':
            if(task.dataTarget && task.dataTarget.channels && task.dataOrigin && task.dataOrigin.onAir) {
                if(task.dataTarget.channels.cinema) {
                    followTasks.push({
                        project: task.project._id,
                        type: 'PUBLISH_CINEMA',
                        target: task.project.manager,
                        deadline: moment().add(20, 'days').startOf('day'),
                        dataOrigin: {onAir: task.dataOrigin.onAir},
                        conditions: [[{
                            type: 'MAKING_OF_SUPERVISOR',
                            data: '$not_exists'
                        },{
                            type: 'MAKING_OF_SUPERVISOR',
                            data: '$resolved_not_data'
                        },{
                            type: 'MAKING_OF_PRODUCER',
                            data: '$resolved_not_data'
                        },{
                            type: 'MAKING_OF_OPERATOR',
                            data: '$resolved',
                        }]]
                    });

                }
                if(task.dataTarget.channels.facebook || task.dataTarget.channels.web || task.dataTarget.channels.instagram) { //added instagram
                    followTasks.push({
                        project: task.project._id,
                        type: 'ONAIR_CONFIRM',
                        target: task.project.manager,
                        deadline: task.dataOrigin.onAir && task.dataOrigin.onAir.date ? moment(task.dataOrigin.onAir.date).startOf('day') : moment().add(5, 'days').startOf('day'),
                        dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataTarget.channels}
                    });
                    followMessages.push({
                        type: 'INFO',
                        label: `${task.project.label}${task.dataOrigin.onAir.name ? ` - ${task.dataOrigin.onAir.name}` : ''}`,
                        message: `Producer has decided to publish this project.`,
                        details: `Publish medium: ${Object.keys(task.dataTarget.channels).filter(c => task.dataTarget.channels[c]).join(', ')}`,
                        target: {role: 'booking:pr-manager'},
                        deadline: moment().add(10, 'days').startOf('day')
                    });

                    if(task.project.supervisor) {
                        followTasks.push({
                            project: task.project._id,
                            type: 'PUBLISH_SUPERVISOR_TEXT_CREATE',
                            target: task.project.supervisor,
                            deadline: moment().add(5, 'days').startOf('day'),
                            dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataTarget.channels},
                            conditions: [[{
                                type: 'ONAIR_CONFIRM',
                                data: '$not_resolved'
                            },{
                                type: 'ONAIR_CONFIRM',
                                data: 'confirmed',
                                op: 'eq',
                                value: true
                            }]]
                        });
                    } else {
                        followTasks.push({
                            project: task.project._id,
                            type: 'PUBLISH_MANAGER_TEXT_CREATE',
                            target: task.project.manager,
                            deadline: moment().add(5, 'days').startOf('day'),
                            dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataTarget.channels},
                            conditions: [[{
                                type: 'ONAIR_CONFIRM',
                                data: '$not_resolved'
                            },{
                                type: 'ONAIR_CONFIRM',
                                data: 'confirmed',
                                op: 'eq',
                                value: true
                            }]]
                        });
                    }
                }
            }
            break;
        case 'PUBLISH_SUPERVISOR_TEXT_CREATE':
            followTasks.push({
                project: task.project._id,
                type: 'PUBLISH_MANAGER_TEXT',
                target: task.project.manager,
                deadline: moment().add(2, 'days').startOf('day'),
                dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataTarget.text},
                conditions: [[{
                    type: 'ONAIR_CONFIRM',
                    data: '$not_resolved'
                },{
                    type: 'ONAIR_CONFIRM',
                    data: 'confirmed',
                    op: 'eq',
                    value: true
                }]]
            });
            break;
        case 'PUBLISH_MANAGER_TEXT_CREATE':
            followTasks.push({
                project: task.project._id,
                type: 'PUBLISH_PR_MANAGER_TEXT',
                target: {role: 'booking:pr-manager'},
                deadline: moment().add(2, 'days').startOf('day'),
                dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataTarget.text},
                conditions: [[{
                    type: 'ONAIR_CONFIRM',
                    data: '$not_resolved'
                },{
                    type: 'ONAIR_CONFIRM',
                    data: 'confirmed',
                    op: 'eq',
                    value: true
                }]]
            });
            break;
    }
    return {tasks: followTasks, messages: followMessages, commands: followCommand}
};