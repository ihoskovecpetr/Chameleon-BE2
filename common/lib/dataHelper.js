'use strict';

const dateHelper = require('./dateHelper');

exports = module.exports;

exports.getObjectOfNormalizedDocs = source => {
    return source.reduce((output, item) => {
        output[item._id] = exports.normalizeDocument(item, true);
        return output;
    }, {});
};

exports.normalizeDocument = (source, removeId) => {
    const result = source.toJSON ? source.toJSON() : source;
    if(removeId) delete result._id;
    delete result.__v;
    //event specific
    if(result.startDate) result.startDate = dateHelper.dateString(result.startDate);
    if(result['days']) result['days'] = result['days'].map(day => ({start: day.start, float: day.float, duration: day.duration}));
    //project specific
    if(result['onair']) result['onair'] = result['onair'].map(onair => ({_id: onair._id.toString(), date: (onair.date ? dateHelper.dateString(onair.date) : null), state: onair.state, name: onair.name }));
    if(result['timing']) result['timing'] = result['timing'].map(timing => ({date: dateHelper.dateString(timing.date), type: timing.type, category: timing.category, text: timing.text}));
    if(result['invoice']) result['invoice'] = result['invoice'].map(invoice => ({date: dateHelper.dateString(invoice.date), name: invoice.name}));
    if(result['jobs']) result['jobs'] = result['jobs'].map(job => ({job: job.job, doneDuration: job.doneDuration, plannedDuration: job.plannedDuration}));
    return result;
};

exports.sortByLabel = (a, b) => {
    return a.label.localeCompare(b.label);
};

exports.mapResources = (resources, users) => {
    return resources.reduce((output, resource) => {
        let userId = null;
        users.forEach(user => {
            if(user.resource == resource._id.toString()) userId = user._id;
        });
        output[resource.K2id] = {resource: resource._id, user: userId, job: resource.job};
        return output;
    },{});
};

exports.mapJobs = source => {
    return source.reduce((output, sourceItem) => {
        for(let i=0; i < sourceItem.K2ids.length; i++) {
            output[sourceItem.K2ids[i]] = {id: sourceItem._id, bookable: sourceItem.bookable, multi: sourceItem.multi};
        }
        return output;
    },{});
};

exports.mapEffeciency = source => {
    return source.reduce((output, sourceItem) => {
        if(sourceItem) {
            const key = sourceItem.operator + '@' + sourceItem.job;
            if(output[key]) {
                output[key].sum += sourceItem.efficiency;
                output[key].count += 1;
            }
            else output[key] = {sum: sourceItem.efficiency, count: 1};
        }
        return output;
    },{});
};

exports.timingReduce = timings => {
    if(!timings) return [];
    const projects = timings.reduce((o, t) => {
        if(o[t.project]) o[t.project].push({type: t.type, category: t.category, text: t.text});
        else o[t.project] = [{type: t.type, category: t.category, text: t.text}];
        return o;
    }, {});
    return Object.keys(projects).map(p => {return {project:p, timings: projects[p]}});
};
/*
exports.evaluateTaskConditions = (task, projectId, onairId, allTasks) => {
    if(!task.conditions) return true;
    let result = true;
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
};

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
 */
