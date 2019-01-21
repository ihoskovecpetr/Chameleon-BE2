const moment = require('moment');
const crypto = require('crypto');
const PusherWorklog = require('../models/pusher-worklog');
const PusherTask = require('../models/pusher-task');

module.exports = {
    evaluateTaskConditions: evaluateTaskConditions,
    followTask: followTask,
    flattenIntervals: flattenIntervals,
    normalizeTask: normalizeTask,
    normalizeMessage: normalizeMessage,
    getOnairConfirmedStatus: getOnairConfirmedStatus
};

// normalize - map task data to form of accepted by Pusher
async function normalizeTask(taskData, users) {
    let task = {
        id: taskData._id,
        project: taskData.project ? taskData.project.label : '',
        dueTo: moment(taskData.deadline).add(taskData.postpone,'days').startOf('day').format('YYYY-MM-DD'),
        type: taskData.type,
        target: taskData.target && users[taskData.target] ? users[taskData.target].ssoId : null,
        valid: taskData.conditionsMet,
        timestamp: taskData.timestamp
    };
    // add data if exists for the task
    if(taskData.dataOrigin) {
        task.data = taskData.dataOrigin;
        if(task.data.who && task.data.who.toString() !== 'supervisor' && task.data.who.toString() !== 'producer' && task.data.who.toString() !== 'manager') {
            const who = users[task.data.who.toString()];
            task.data.who = who ? who.name : null;
        }
    }
    // add special to data depending on task type
    switch(taskData.type) {
        case 'VFX_ARCHIVE_MANAGER':
        case 'MAKING_OF_MANAGER':
        case 'ARCHIVE_MANAGER_CLEAN_VERSION':
            // Add lead2D as default operator if exists
            if(taskData.project.lead2D) {
                if (!task.data) task.data = {};
                task.data.operator2D = {
                    id: taskData.project.lead2D,
                    label: users[taskData.project.lead2D].name
                };
            }
            break;
        case 'ARCHIVE_MANAGER_PREPARE':
            // Add lead2D, lead3D and leadMP as default operators if they exists
            if(taskData.project.lead2D) {
                if (!task.data) task.data = {};
                task.data.operator2D = {
                    id: taskData.project.lead2D,
                    label: users[taskData.project.lead2D].name
                };
            }
            if(taskData.project.lead3D) {
                if (!task.data) task.data = {};
                task.data.operator3D = {
                    id: taskData.project.lead3D,
                    label: users[taskData.project.lead3D].name
                };
            }
            if(taskData.project.leadMP) {
                if (!task.data) task.data = {};
                task.data.operatorMP = {
                    id: taskData.project.leadMP,
                    label: users[taskData.project.leadMP].name
                };
            }
            break;
        case 'ARCHIVE_MANAGER':
            if(taskData.dataOrigin && (taskData.dataOrigin.operator2D || taskData.dataOrigin.operator3D || taskData.dataOrigin.operatorMP)) {
                if (!task.data) task.data = {};
                if(taskData.dataOrigin.operator2D) task.data.operator2D = users[taskData.dataOrigin.operator2D].name;
                if(taskData.dataOrigin.operator3D) task.data.operator3D = users[taskData.dataOrigin.operator3D].name;
                if(taskData.dataOrigin.operatorMP) task.data.operatorMP = users[taskData.dataOrigin.operatorMP].name;
            }
            break;
        case 'ARCHIVE_2D_BIG':
        case 'ARCHIVE_3D_BIG':
        case 'ARCHIVE_MP_BIG':
            if(taskData.origin) {
                if (!task.data) task.data = {};
                task.data.operator = users[taskData.origin].name;
            }
            break;
    }
    task = addCurrentTarget(taskData, task, users);
    task = addArchiveCheckList(taskData, task);
    const archiveTasks = ['ARCHIVE_2D_LEAD', 'ARCHIVE_2D_OPERATOR', 'ARCHIVE_2D_BIG', 'ARCHIVE_3D_LEAD', 'ARCHIVE_3D_BIG', 'ARCHIVE_MP_LEAD', 'ARCHIVE_MP_OPERATOR', 'ARCHIVE_MP_BIG'];
    if(archiveTasks.indexOf(taskData.type) >= 0) task = await addArchiveMembersAndBigStatus(taskData, task, users);
    return task;
}

function addArchiveCheckList(taskData, task) {
    if(task.type === 'ARCHIVE_MANAGER') {
        if(!task.data) task.data = {};
        const statuses = taskData.dataOrigin && taskData.dataOrigin.checkList ? taskData.dataOrigin.checkList : {};
        const names = ["master", "archive2D", "archive3D", "archiveMP", "offline", "presentation", "vfx", "grading", "boogie"];
        task.data.checkList = names.map(name => {
            return {
                name: name,
                status: statuses[name] ? statuses[name] : 0
            }
        });
    }
    return task;
}

function addCurrentTarget(taskData, task, users) {
    if(!taskData.target) return task;
    switch(task.type) {
        // target - MANAGER
        case 'ONAIR_SET':
        case 'PUBLISH_MANAGER_SHOW':
        case 'FEEDBACK_MANAGER':
        case 'ARCHIVE_MANAGER_CLEAN_VERSION':
        case 'ARCHIVE_MANAGER_PREPARE':
        case 'INVOICE_SET':
        case 'INVOICE_SEND':
        case 'INVOICE_CHECK':
        case 'CLOSE_TO_FINAL':
        case 'K2_PROJECT':
        case 'VFX_ARCHIVE_MANAGER':
        case 'ARCHIVE_MANAGER':
        case 'ARCHIVE_ADV_MANAGER_UPLOAD':
        case 'MAKING_OF_MANAGER':
        case 'ONAIR_CONFIRM':
        case 'PUBLISH_MANAGER_TEXT_CREATE':
        case 'PUBLISH_MANAGER_TEXT':
        case 'BUDGET_LINK':
        case 'FEEDBACK_FILL_MANAGER':
            if(taskData.project.manager && taskData.project.manager.toString() !== taskData.target.toString()) {
                task.currentTarget = {name: users[taskData.project.manager].name, ssoId: users[taskData.project.manager].ssoId, id: taskData.project.manager};
            }
            break;
        // target - SUPERVISOR
        case 'VFX_ARCHIVE_SUPERVISOR':
        case 'FEEDBACK_SHOOT_SUPERVISOR':
        case 'MAKING_OF_SUPERVISOR':
        case 'SHOWREEL_SHOTS':
        case 'FEEDBACK_SUPERVISOR':
        case 'TEAM_FEEDBACK_SUPERVISOR':
        case 'ARCHIVE_ADV_SUPERVISOR_TAGS':
        case 'PUBLISH_SUPERVISOR_TEXT_CREATE':
            if(taskData.project.supervisor && taskData.project.supervisor.toString() !== taskData.target.toString()) {
                task.currentTarget = {name: users[taskData.project.supervisor].name, ssoId: users[taskData.project.supervisor].ssoId, id: taskData.project.supervisor};
            } else if(!taskData.project.supervisor && taskData.project.manager && taskData.project.manager.toString() !== taskData.target.toString()) {
                task.currentTarget = {name: users[taskData.project.manager].name, ssoId: users[taskData.project.manager].ssoId, id: taskData.project.manager};
            }
            break;
    }
    return task;
}

async function addArchiveMembersAndBigStatus(taskData, task, users) {
    if(!taskData.target) return task;
    const jobType = task.type.substr(8, 2);
    let operatorSubTasks = await PusherTask.find({project: taskData.project._id, type: `ARCHIVE_${jobType}_OPERATOR`}).lean();
    operatorSubTasks = operatorSubTasks.reduce((tasks, task) => {
        tasks[task.target] = task;
        return tasks;
    }, {});
    let bigTasks = await PusherTask.find({project: taskData.project._id, type: `ARCHIVE_${jobType}_BIG`}).lean();
    bigTasks = bigTasks.reduce((tasks, task) => {
        tasks[task.origin] = task;
        return tasks;
    }, {});

    let operators;
    if(!task.data) task.data = {};
    if(taskData.project.manager && users[taskData.project.manager]) task.data.manager = users[taskData.project.manager].name;
    if(taskData.project.supervisor && users[taskData.project.supervisor]) task.data.supervisor = users[taskData.project.supervisor].name;
    if(task.type === 'ARCHIVE_2D_LEAD' || task.type === 'ARCHIVE_MP_LEAD') operators = await getProjectOperators(jobType, taskData, operatorSubTasks, bigTasks);
    else if((task.type === 'ARCHIVE_2D_OPERATOR' || task.type === 'ARCHIVE_MP_OPERATOR') && taskData.origin && users[taskData.origin]) task.data.sender = users[taskData.origin].name;
    if(operators) {
        operators = operators.filter(user => !user.id || !users[user.id] || users[user.id].ssoId !== task.target); //filter out target user
        if(operators.length > 0) task.data.operators = operators;
    }
    //add big task status
    task.data.big = bigTasks[taskData.target] ? !!bigTasks[taskData.target].resolved : null;
    return task;
}

async function getProjectOperators(jobType, taskData, operatorSubTasks, bigTasks) {
    const logs = await PusherWorklog.find({project: taskData.project._id}, {operatorName: true, operatorSurname: true, operator: true, job: true}).populate('operator job').lean();
    let operators = logs.filter(log => log.job && log.job.type === jobType).map(log => {return {
        id: log.operator ? log.operator._id.toString() : getPseudoId(`${log.operatorName} ${log.operatorSurname}`),
        pseudoId: !log.operator,
        pusher: log.operator && log.operator.access.indexOf('pusher:app') >= 0,
        label: log.operator ? log.operator.name : `${log.operatorName} ${log.operatorSurname}`,
    }}).filter((log1, index, self) => {
        const firstIndex = self.findIndex(log2 => log1.id === log2.id && log1.name === log2.name);
        return firstIndex === index;
    });
    if(operators.length > 0) {
        operators = operators.map(operator => {
            //operator.status = tasks[operator.id] ? tasks[operator.id].resolved ? tasks[operator.id].dataTarget && tasks[operator.id].dataTarget.bigArchive ? 3 : 2 : 1 : 0;
            const subTask =  operatorSubTasks[operator.id] ? !!operatorSubTasks[operator.id].resolved : null;
            const big = bigTasks[operator.id] ? !!bigTasks[operator.id].resolved : null;
            operator.status = {done: subTask, big: big};
            return operator;
        });
    }
    return operators;
}

function getPseudoId(str) {
    const hash = crypto.createHash('md5');
    return hash.update(str).digest('hex').substr(0,24);
}

async function normalizeMessage(message, users, userId) {
    if(userId) {
        const targetIndex = message.target.reduce((targetIndex, target, index) => target.toString() == userId ? index : targetIndex, -1);
        const targetPostpone = message.postpone[targetIndex];
        return{
            id: message._id,
            dueTo: moment(message.deadline).add(targetPostpone,'days').startOf('day').format('YYYY-MM-DD'),
            type: message.type,
            target: users[userId] && users[userId].access && users[userId].access.indexOf('pusher:app') >= 0 && users[userId].ssoId ? users[userId].ssoId : '',
            label: message.label,
            timestamp: message.timestamp,
            message: message.message ? message.message : undefined,
            details: message.details ? message.details : undefined,
            confirm: message.confirm,
            email: users[userId] && users[userId].access && users[userId].access.indexOf('pusher:email') >= 0 && users[userId].email ? `${users[userId].name} <${users[userId].email}>` : undefined,
            origin: message.origin && users[message.origin] && users[message.origin].access.indexOf('pusher:app') >= 0 ? message.origin : null
        };
    } else {
        return message.target.map((target, index) => {
            return {
                id: message._id,
                dueTo: moment(message.deadline).add(message.postpone[index],'days').startOf('day').format('YYYY-MM-DD'),
                type: message.type,
                target: users[target] && users[target].access && users[target].access.indexOf('pusher:app') >= 0 && users[target].ssoId ? users[target].ssoId : '',
                label: message.label,
                timestamp: message.timestamp,
                message: message.message ? message.message : undefined,
                details: message.details ? message.details : undefined,
                confirm: message.confirm,
                email: users[target] && users[target].access && users[target].access.indexOf('pusher:email') >= 0 && users[target].email ? `${users[target].name} <${users[target].email}>` : undefined,
                origin: message.origin && users[message.origin] && users[message.origin].access.indexOf('pusher:app') >= 0 ? message.origin : null
            }
        });
    }
}

function evaluateTaskConditions(task, projectId, onairId, allTasks) {
    let result = true;
    if(!task.conditions) return true;
    task.conditions.forEach(andCondition => { // AND ARRAY
        if(result) {
            if (Array.isArray(andCondition)) {
                let orResult = false;
                andCondition.forEach(orCondition => { // OR ARRAY
                    if (!orResult) orResult = evaluateSingleCondition(task, orCondition, projectId, onairId, allTasks);
                });
                result = result && orResult;
            } else {
                result = result && evaluateSingleCondition(task, andCondition, projectId, onairId, allTasks);
            }
        }
    });
    return result;
}

function getOnairConfirmedStatus(projectId, onairId, tasks) {
    const task = tasks.find(task => task.type === 'ONAIR_CONFIRM' && task.project && projectId && task.project.toString() === projectId.toString() && task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir._id && onairId && task.dataOrigin.onAir._id.toString() === onairId.toString());
    if(task) return task.resolved && task.dataTarget && task.dataTarget.confirmed ? true : false;
    else return null;
}

function evaluateSingleCondition(task, condition, projectId, onairId, allTasks) {
    // get all task for the projectId and onairId if it is defined and for the type of task specified by the condition
    let conditionalTask;
    let conditionalTaskData;
    if(condition.type && condition.type === '$this') {
        conditionalTask = task;
        conditionalTaskData = task.dataOrigin;
    } else {
        const projectTasksOfType = allTasks.filter(t =>
            ((t.project ? t.project.toString() : t.project) === (projectId ? projectId.toString() : projectId)) //project
            && t.type === condition.type // type
            && (onairId && t.dataOrigin && t.dataOrigin.onAir && t.dataOrigin.onAir._id ? t.dataOrigin.onAir._id.toString() === onairId.toString() : true )) // onairId if specified
            .sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp)
            }); //sort to get last event of the type and project

        if (projectTasksOfType.length === 0) return condition.data === '$not_exists'; // if doesn't exists, condition is not met if it is not required as condition

        conditionalTask = projectTasksOfType[projectTasksOfType.length - 1]; // get last one
        conditionalTaskData = conditionalTask.dataTarget;
    }

    let result = false;

    if(typeof condition.data === 'string' && condition.data.indexOf('$') === 0) { // condition is not related to dataTarget/dataOrigin field, instead it has special meaning
        switch(condition.data) {
            case '$not_resolved':
                if(conditionalTask.resolved === null) result = true;
                break;
            case '$resolved':
                if(conditionalTask.resolved !== null) result = true;
                break;
            case '$resolved_data':
                if(conditionalTask.resolved !== null && conditionalTask.dataTarget !== null) result = true;
                break;
            case '$resolved_not_data':
                if(conditionalTask.resolved !== null && conditionalTask.dataTarget === null) result = true;
                break;
        }
    } else {
        if(conditionalTaskData && typeof conditionalTaskData[condition.data] !== 'undefined' && typeof condition.value !== 'undefined' && typeof condition.op !== 'undefined') {
            let first = conditionalTaskData[condition.data];
            let second = condition.value;

            if(typeof second === 'string' && second.indexOf('$') === 0) {
                if(second.indexOf('$today') === 0) {
                    const today = second.split(' ', 3);
                    if(today.length === 3) {
                        first = new Date(first);
                        first.setHours(0,0,0,0);
                        second = new Date();
                        second.setHours(0,0,0,0);
                        const days = parseInt(today[2]);
                        const day = second.getDate();
                        if(today[1].trim() === '+') {
                            second.setDate(day + days);
                        } else if(today[1].trim() === '-') {
                            second.setDate(day - days);
                        }
                    } else {
                        first = new Date(first);
                        first.setHours(0,0,0,0);
                        second = new Date();
                        second.setHours(0,0,0,0);
                    }
                }
            }
            switch (condition.op) {
                case 'exists':
                    result = first !== undefined;
                    break;
                case 'eq':
                    result = first == second;
                    break;
                case 'ne':
                    result = first != second;
                    break;
                case 'gt':
                    result = first > second;
                    break;
                case 'gte':
                    result = first >= second;
                    break;
                case 'lt':
                    result = first < second;
                    break;
                case 'lte':
                    result = first <= second;
                    break;
            }
        }
    }
    return result;
}

// *****************************************************************************************************
// FOLLOW TASK
// *****************************************************************************************************
function followTask(task) {
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
            followTasks.push({
                project: task.project._id,
                type: 'MAKING_OF_OPERATOR',
                target: task.dataTarget.operator, //task.target._id
                deadline: moment().add(task.dataTarget.dueTo, 'days').startOf('day'),
                dataOrigin: {note: task.dataTarget.note ? task.dataTarget.note : null}
            });
            break;
        case 'MAKING_OF_OPERATOR':
            const clipName2 = task.dataOrigin && task.dataOrigin.onAir && task.dataOrigin.onAir.name ? task.dataOrigin.onAir.name : null;
            followMessages.push({
                type: 'INFO',
                label: task.project.label + (clipName2 ? ' - ' + clipName2 : ''),
                message: 'VFX breakdown done by ' + task.target.name,
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
                    type: 'FEEDBACK_FILL_MANAGER',
                    target: {role: 'booking:manager'},
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
                    //deadline: moment().add(5, 'days').startOf('day'),
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
                /*
                if(task.dataTarget.channels.banner) {
                    followTasks.push({
                        project: task.project._id,
                        type: 'PUBLISH_BANNER',
                        target: {role: 'booking:pr-manager'},
                        deadline: moment().add(20, 'days').startOf('day'),
                        dataOrigin: {onAir: task.dataOrigin.onAir}
                    });

                }
                */
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
                        //details: `Publish medium: ${task.dataTarget.channels.facebook && task.dataTarget.channels.web ? 'facebook and web' : task.dataTarget.channels.facebook ? 'facebook' : 'web'}.`,
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
        case 'PUBLISH_MANAGER_TEXT': //TODO DEPRECATED
        case 'PUBLISH_MANAGER_TEXT_CREATE':
        case 'PUBLISH_MANAGER_TEXT_REVISE': //TODO DEPRECATED
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

        /*
        case 'PUBLISH_PR_MANAGER_TEXT':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_MANAGER_TEXT_REVISE',
                    target: task.project.manager,
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {
                        onAir: task.dataOrigin.onAir,
                        channels: task.dataOrigin.channels,
                        text: task.dataTarget.text,
                        note: task.dataTarget.note
                    },
                    conditions: [[{
                        type: 'ONAIR_CONFIRM',
                        data: '$not_resolved'
                    }, {
                        type: 'ONAIR_CONFIRM',
                        data: 'confirmed',
                        op: 'eq',
                        value: true
                    }]]
                });
            } else {
                if (task.project.supervisor) {
                    followTasks.push({
                        project: task.project._id,
                        type: 'PUBLISH_SUPERVISOR_TEXT_VERIFY',
                        target: task.project.supervisor,
                        deadline: moment().add(2, 'days').startOf('day'),
                        dataOrigin: {
                            onAir: task.dataOrigin.onAir,
                            channels: task.dataOrigin.channels,
                            text: task.dataTarget.text
                        },
                        conditions: [[{
                            type: 'ONAIR_CONFIRM',
                            data: '$not_resolved'
                        }, {
                            type: 'ONAIR_CONFIRM',
                            data: 'confirmed',
                            op: 'eq',
                            value: true
                        }]]
                    });
                } else {
                    followTasks.push({
                        project: task.project._id,
                        type: 'PUBLISH_MANAGER_TEXT_VERIFY',
                        target: task.project.manager,
                        deadline: moment().add(2, 'days').startOf('day'),
                        dataOrigin: {
                            onAir: task.dataOrigin.onAir,
                            channels: task.dataOrigin.channels,
                            text: task.dataTarget.text
                        },
                        conditions: [[{
                            type: 'ONAIR_CONFIRM',
                            data: '$not_resolved'
                        }, {
                            type: 'ONAIR_CONFIRM',
                            data: 'confirmed',
                            op: 'eq',
                            value: true
                        }]]
                    });
                }
            }
            break;
        case 'PUBLISH_SUPERVISOR_TEXT_VERIFY':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_PR_MANAGER_TEXT_REVISE',
                    target: {role: 'booking:pr-manager'},
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataOrigin.text, note: task.dataTarget.note, who: 'supervisor'},
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
                    type: 'PUBLISH_MANAGER_TEXT_VERIFY',
                    target: task.project.manager,
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataOrigin.text},
                    conditions: [[{
                        type: 'ONAIR_CONFIRM',
                        data: '$not_resolved'
                    }, {
                        type: 'ONAIR_CONFIRM',
                        data: 'confirmed',
                        op: 'eq',
                        value: true
                    }]]
                });
            }
            break;

        case 'PUBLISH_MANAGER_TEXT_VERIFY':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_PR_MANAGER_TEXT_REVISE',
                    target: {role: 'booking:pr-manager'},
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataOrigin.text, note: task.dataTarget.note, who: 'manager'},
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
                    type: 'PUBLISH_PRODUCER_TEXT',
                    target: {role: 'booking:main-producer'},
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataOrigin.text},
                    conditions: [[{
                        type: 'ONAIR_CONFIRM',
                        data: '$not_resolved'
                    }, {
                        type: 'ONAIR_CONFIRM',
                        data: 'confirmed',
                        op: 'eq',
                        value: true
                    }]]
                });
            }
            break;

        case 'PUBLISH_PRODUCER_TEXT':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_PR_MANAGER_TEXT_REVISE',
                    target: {role: 'booking:pr-manager'},
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, channels: task.dataOrigin.channels, text: task.dataOrigin.text, note: task.dataTarget.note, who: 'producer'},
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
                //TODO clear conditions, block publishing to conditions or 2x? only condition ONAIR_CONFIRM === false -> not show
                if(task.dataOrigin.channels.facebook) {
                    followTasks.push({
                        project: task.project._id,
                        type: 'PUBLISH_FACEBOOK',
                        target: {role: 'booking:pr-manager'},
                        deadline: task.dataOrigin.onAir && task.dataOrigin.onAir.date ? moment(task.dataOrigin.onAir.date).add(5, 'days').startOf('day') : moment().add(5, 'days').startOf('day'),
                        dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataOrigin.text, onAirConfirmed: false},
                        conditions: [[{
                            type: 'ONAIR_CONFIRM',
                            data: '$not_resolved'
                        },{
                            type: 'ONAIR_CONFIRM',
                            data: 'confirmed',
                            op: 'eq',
                            value: true
                        }]]

                        conditions: [{
                            type: 'ONAIR_CONFIRM',
                            data: 'confirmed',
                            op: 'eq',
                            value: true
                        },{
                            type: 'ONAIR_CONFIRM',
                            data: 'onAir',
                            op: 'lt',
                            value: '$today'
                        }]

                    });
                }
                if(task.dataOrigin.channels.web) {
                    if(task.dataOrigin.channels.facebook) {
                        // FIRST FINISH WEB MODIFICATION OF TEXT
                        followTasks.push({
                            project: task.project._id,
                            type: 'PUBLISH_PR_MANAGER_TEXT_WEBSITE',
                            target: {role: 'booking:pr-manager'},
                            deadline: moment().add(2, 'days').startOf('day'),
                            dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataOrigin.text},
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
                        //TODO clear conditions, block publishing to conditions or 2x?
                        followTasks.push({
                            project: task.project._id,
                            type: 'PUBLISH_WEB',
                            target: {role: 'booking:pr-manager'},
                            deadline: task.dataOrigin.onAir && task.dataOrigin.onAir.date ? moment(task.dataOrigin.onAir.date).add(5, 'days').startOf('day') : moment().add(5, 'days').startOf('day'),
                            dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataOrigin.text, onAirConfirmed: false},
                            conditions: [[{
                                type: 'ONAIR_CONFIRM',
                                data: '$not_resolved'
                            },{
                                type: 'ONAIR_CONFIRM',
                                data: 'confirmed',
                                op: 'eq',
                                value: true
                            }]]

                            conditions: [{
                                type: 'ONAIR_CONFIRM',
                                data: 'confirmed',
                                op: 'eq',
                                value: true
                            },{
                                type: 'ONAIR_CONFIRM',
                                data: 'onAir',
                                op: 'lt',
                                value: '$today'
                            }]

                        });
                    }
                }
            }
            break;
        case 'PUBLISH_PR_MANAGER_TEXT_REVISE':
            if(task.dataTarget && task.dataTarget.who && task.dataTarget.who == 'producer') {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_PRODUCER_TEXT',
                    target: {role: 'booking:main-producer'},
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
            } else if(task.dataTarget && task.dataTarget.who && task.dataTarget.who == 'supervisor'){
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_SUPERVISOR_TEXT_VERIFY',
                    target: task.project.supervisor ? task.project.supervisor : task.project.manager,
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
            } else {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_MANAGER_TEXT_VERIFY',
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
            }
            break;
        case 'PUBLISH_PR_MANAGER_TEXT_WEBSITE':
            followTasks.push({
                project: task.project._id,
                type: 'PUBLISH_PRODUCER_TEXT_WEBSITE',
                target: {role: 'booking:main-producer'},
                deadline: moment().add(2, 'days').startOf('day'),
                dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataTarget.text},
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
        case 'PUBLISH_PRODUCER_TEXT_WEBSITE':
            if(task.dataTarget && task.dataTarget.note) {
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_PR_MANAGER_TEXT_WEBSITE_REVISE',
                    target: {role: 'booking:pr-manager'},
                    deadline: moment().add(2, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataOrigin.text, note: task.dataTarget.note},
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
                //TODO clear conditions, block publishing to conditions or 2x?
                followTasks.push({
                    project: task.project._id,
                    type: 'PUBLISH_WEB',
                    target: {role: 'booking:pr-manager'},
                    deadline: task.dataOrigin.onAir && task.dataOrigin.onAir.date ? moment(task.dataOrigin.onAir.date).add(5, 'days').startOf('day') : moment().add(5, 'days').startOf('day'),
                    dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataOrigin.text, onAirConfirmed: false},
                    conditions: [[{
                        type: 'ONAIR_CONFIRM',
                        data: '$not_resolved'
                    },{
                        type: 'ONAIR_CONFIRM',
                        data: 'confirmed',
                        op: 'eq',
                        value: true
                    }]]

                    conditions: [{
                        type: 'ONAIR_CONFIRM',
                        data: 'confirmed',
                        op: 'eq',
                        value: true
                    },{
                        type: 'ONAIR_CONFIRM',
                        data: 'onAir',
                        op: 'lt',
                        value: '$today'
                    }]

                });
            }
            break;
        case 'PUBLISH_PR_MANAGER_TEXT_WEBSITE_REVISE':
            followTasks.push({
                project: task.project._id,
                type: 'PUBLISH_PRODUCER_TEXT_WEBSITE',
                target: {role: 'booking:main-producer'},
                deadline: moment().add(2, 'days').startOf('day'),
                dataOrigin: {onAir: task.dataOrigin.onAir, text: task.dataTarget.text},
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
            break;*/
    }
    return {tasks: followTasks, messages: followMessages, commands: followCommand}
}

const BACK_TO_HISTORY_DAYS = 30;
const MAX_GAP_TO_JOIN = 7;

function flattenIntervals(intervals, today) {
    const notBeforeDay = moment().startOf('day').add(-BACK_TO_HISTORY_DAYS,'days');
    if(intervals.length === 0) return intervals;
    intervals = intervals.map(interval => {return {firstDate: interval.firstDate, lastDate: interval.lastDate.clone().add(1 + MAX_GAP_TO_JOIN,'days')}});
    var result = [intervals[0]];
    for(var i = 1; i < intervals.length; i++) {
        const top = result[result.length - 1];
        if(top.lastDate.isBefore(intervals[i].firstDate)) result.push(intervals[i]);
        else if(top.lastDate.isBefore(intervals[i].lastDate)) {
            top.lastDate = intervals[i].lastDate;
            result.pop();
            result.push(top);
        }
    }
    result = result
        .map(interval => {return {firstDate: interval.firstDate, lastDate: interval.lastDate.clone().add(-1 - MAX_GAP_TO_JOIN,'days')}})
        .filter(interval => interval.lastDate.isBefore(today) && interval.lastDate.isAfter(notBeforeDay))
        .map(interval => {return {firstDate: interval.firstDate.valueOf(), lastDate: interval.lastDate.valueOf()}});
    return result;
}
