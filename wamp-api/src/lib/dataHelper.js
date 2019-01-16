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

//TODO vvvvvvvvvv

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

exports.mapJobs = source => {
    return source.reduce((output, sourceItem) => {
        for(let i=0; i < sourceItem.K2ids.length; i++) {
            output[sourceItem.K2ids[i]] = {id: sourceItem._id, bookable: sourceItem.bookable, multi: sourceItem.multi};
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
