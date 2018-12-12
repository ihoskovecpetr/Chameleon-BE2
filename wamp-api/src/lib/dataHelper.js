'use strict';

const dateHelper = require('./dateHelper');

exports = module.exports;

exports.getNormalizedObject = source => {
    return source.reduce((output, sourceItem) => {
        const itemKey = sourceItem._id;
        const item = sourceItem.toJSON ? sourceItem.toJSON() : sourceItem;
        delete item._id;
        if(item.startDate) item.startDate = dateHelper.dateString(sourceItem.startDate);
        ['timing', 'invoice', 'onair'].forEach(key => {
            if(item[key] && item[key].length > 0) {
                for(let i = 0; i < item[key].length; i++) {
                    if(item[key][i].date) item[key][i].date = dateHelper.dateString(item[key][i].date);
                }
            }
        });
        output[itemKey] = item;
        return output;
    },{});
};

exports.normalizeProject = project => {
    return {
        id: project._id.toString(),
        project: {
            label: project.label,
            onair: project.onair.map(onair => {return {_id: onair._id.toString(), date: (onair.date ? dateHelper.dateString(onair.date) : null), state: onair.state, name: onair.name }}),
            bookingNotes: project.bookingNotes,
            timing: project.timing.map(timing => {return {date: dateHelper.dateString(timing.date), type: timing.type, category: timing.category, text: timing.text}}),
            invoice: project.invoice.map(invoice => {return {date: dateString(invoice.date), name: invoice.name}}),
            jobs: project.jobs.map(job => {return {job: job.job.toString(), doneDuration: job.doneDuration, plannedDuration: job.plannedDuration}}),
            events: project.events,
            offtime: project.offtime,
            created: project.created,
            lead2D: project.lead2D,
            lead3D: project.lead3D,
            leadMP: project.leadMP,
            producer: project.producer,
            supervisor: project.supervisor,
            manager: project.manager,
            internal: project.internal,
            confirmed: project.confirmed,
            K2name: project.K2name,
            K2client: project.K2client,
            K2rid: project.K2rid,
            budget: project.budget,
            kickBack: project.kickBack,
            K2projectId: project.K2projectId
        }
    }
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
