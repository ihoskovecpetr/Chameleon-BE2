'use strict';
const mongoose = require('mongoose');
const moment = require('moment');
const k2 = require('../k2-mssql');
const logger = require('../logger');

//Collections
const User = require('../models/user');
const BookingProject = require('../models/booking-project');
const BookingWorkType = require('../models/booking-work-type');
const BudgetItem = require('../models/budget-item');
require('../models/booking-event');
require('../models/budget');

// *********************************************************************************************************************
// MANAGERS AND SUPERVISORS UTILIZATION
// *********************************************************************************************************************
exports.getManagersAndSupervisorsUtilization = async (from, to) => {
    const today = moment().startOf('day');
    const users = await User.find({},{role: true, name: true}).lean();
    const projects = await BookingProject.find({deleted: null, internal: {$ne: true}, offtime: {$ne: true}}, {manager:true, supervisor:true, events:true, _id:false, label:true}).populate('manager supervisor events').lean();

    const usersPrepared = users.reduce((out, user) => {
        if(user.role.indexOf('booking:manager') >= 0) {
            out.managers[user._id] = {name: user.name, projects: 0, projectsList: [], hours: 0, remains: 0};
        }
        if(user.role.indexOf('booking:supervisor') >= 0) {
            out.supervisors[user._id] = {name: user.name, projects: 0, projectsList: [], hours: 0, remains: 0};
        }
        return out;
    }, {managers: {}, supervisors: {}});

    const result = projects.reduce((out, project) => {
        const events = project.events.filter(event => {
            const eventStart = moment(event.startDate);
            const eventEnd = eventStart.clone().add(event.days.length,'days');
            return eventStart.isBefore(to) && eventEnd.isAfter(from);
        });
        if(events.length > 0) {
            const projectMinutes = project.events.reduce((sum, event) => {
                const eventStart = moment(event.startDate);
                const eventMinutes = event.days.reduce((min, day, dayIndex) => {
                    min.duration += day.duration;
                    if(!eventStart.clone().add(dayIndex,'days').isBefore(today)) {
                        min.remains += day.duration;
                    }
                    return min;
                }, {duration: 0, remains: 0});
                sum.duration += eventMinutes.duration;
                sum.remains += eventMinutes.remains;
                return sum;
            }, {duration: 0, remains: 0});
            if(project.manager) {
                if(out.managers[project.manager._id]) {
                    out.managers[project.manager._id].projects += 1;
                    out.managers[project.manager._id].projectsList.push({label: project.label, hours: projectMinutes.duration / 60, remains: projectMinutes.remains / 60});
                    out.managers[project.manager._id].hours += projectMinutes.duration / 60;
                    out.managers[project.manager._id].remains += projectMinutes.remains / 60;
                }
            }
            if(project.supervisor) {
                if(out.supervisors[project.supervisor._id]) {
                    out.supervisors[project.supervisor._id].projects += 1;
                    out.supervisors[project.supervisor._id].projectsList.push({label: project.label, hours: projectMinutes.duration / 60, remains: projectMinutes.remains / 60});
                    out.supervisors[project.supervisor._id].hours += projectMinutes.duration / 60;
                    out.supervisors[project.supervisor._id].remains += projectMinutes.remains / 60;
                }
            }
        }
        return out;
    }, usersPrepared);

    return {managers: Object.keys(result.managers).map(manager => result.managers[manager]), supervisors: Object.keys(result.supervisors).map(supervisor => result.supervisors[supervisor])}
};

// *********************************************************************************************************************
// MANAGERS AND SUPERVISORS EFFICIENCY
// *********************************************************************************************************************
exports.getManagersAndSupervisorsEfficiency = async (from, to) => {
    const today = moment().startOf('day');
    const users = await User.find({},{role: true, name: true}).lean();
    const projects = await BookingProject.find({deleted: null, internal: {$ne: true}, offtime: {$ne: true}},{manager: true, supervisor: true, events: true, jobs: true, _id:false}).populate('manager supervisor events').lean();

    const usersPrepared = users.reduce((out, user) => {
        if(user.role.indexOf('booking:manager') >= 0) {
            out.managers[user._id] = {name: user.name, budget:0, spent:0, remains: 0};
        }
        if(user.role.indexOf('booking:supervisor') >= 0) {
            out.supervisors[user._id] = {name: user.name, budget: 0, spent: 0, remains: 0};
        }
        return out;
    }, {managers: {}, supervisors: {}});

    const result = projects.reduce((out, project) => {
        const events = project.events.filter(event => {
            const eventStart = moment(event.startDate);
            const eventEnd = eventStart.clone().add(event.days.length,'days');
            return eventStart.isBefore(to) && eventEnd.isAfter(from);
        });
        if(events.length > 0) {
            const durations = project.jobs.reduce((sum, job) => {
                sum.planned += job.plannedDuration;
                sum.done += job.doneDuration;
                sum.jobs[job.job] = job.plannedDuration;
                return sum;
            }, {planned: 0, done: 0, jobs: {}});

            const remains = project.events.reduce((out, event) => {
                if(event.job && durations.jobs[event.job] && durations.jobs[event.job] > 0) {
                    let dayIndex = today.diff(moment(event.startDate),'days');
                    if(dayIndex < event.days.length) {
                        if(dayIndex < 0) dayIndex = 0;
                        for(let i = dayIndex; i < event.days.length; i++) out += event.days[i].duration;
                    }
                }
                return out;
            }, 0);

            if (project.manager) {
                if (out.managers[project.manager._id]) {
                    out.managers[project.manager._id].budget += durations.planned / 60;
                    out.managers[project.manager._id].spent += durations.done / 60;
                    out.managers[project.manager._id].remains += remains / 60;
                }
            }

            if (project.supervisor) {
                if (out.supervisors[project.supervisor._id]) {
                    out.supervisors[project.supervisor._id].budget += durations.planned / 60;
                    out.supervisors[project.supervisor._id].spent += durations.done / 60;
                    out.supervisors[project.supervisor._id].remains += remains / 60;
                }
            }
        }
        return out;
    }, usersPrepared);

    return {managers: Object.keys(result.managers).map(manager => {
            const o = result.managers[manager];
            o.spent = Math.round(o.spent);
            o.remains = Math.round(o.remains);
            return o;
        }), supervisors: Object.keys(result.supervisors).map(supervisor => {
            const o = result.supervisors[supervisor];
            o.spent = Math.round(o.spent);
            o.remains = Math.round(o.remains);
            return o;
        })}
};

// *********************************************************************************************************************
// BOOKING NOTIFICATIONS
// *********************************************************************************************************************
exports.getNotifications = async () => {
    const projects = await BookingProject.find({confirmed: true, manager: {$ne: null}, events: {$gt: []}, deleted: null, internal: {$ne: true}, offtime: {$ne: true}},{events:true, timing:true, label:true, jobs:true, manager:true, K2rid:true, _id:false, onair: true, budget: true}).populate('manager events').lean();
    return projects.map(project => ({
        label: project.label,
        K2: project.K2rid !== null,
        budgetSum: Math.round(project.jobs.reduce((sum, item) => sum + item.plannedDuration, 0) / 60),
        bookedSum: Math.round(project.events.reduce((sum, item) => {
            const eventSum = item.days.reduce((sum, item) => sum + item.duration, 0);
            return sum + eventSum;
        }, 0) / 60),
        timing: project.timing && project.timing.length > 0,
        dates: project.events.reduce((out, event) => {
            const startDate = moment(event.startDate).startOf('day');
            const lastDate = startDate.clone().add(event.days.length - 1, 'days');
            if(out.first === null) out.first = startDate;
            else if(startDate.isBefore(out.first)) out.first = startDate;
            if(out.last === null) out.last = lastDate;
            else if(lastDate.isAfter(out.last)) out.last = lastDate;
            return out;
        },{first: null, last: null}),
        manager: project.manager.name,
        onair: onAirSet(project.onair),
        budgetLink : !!project.budget
    })).sort((a, b) => {
        const aName = a.manager.split(' ');
        const bName = b.manager.split(' ');
        const byLabel = (aName[1] + aName[0]).localeCompare((bName[1] + bName[0]));
        if(byLabel === 0) return a.dates.first.diff(b.dates.first, 'days');
        else return byLabel;
    }).reduce((o, project) => {
        if(!project.K2) {
            o.noK2.push({
                label: project.label,
                manager: project.manager,
                booked: project.bookedSum
            });
        }
        if(!project.timing && project.dates.last.isAfter(moment('2016-04-28','YYYY-MM-DD')) && project.budgetSum > 30) {
            o.noTiming.push({
                label: project.label,
                manager: project.manager,
                booked: project.bookedSum
            });
        }
        if(project.budgetSum === 0 && project.bookedSum > 100) {
            o.noBudget.push({
                label: project.label,
                manager: project.manager,
                booked: project.bookedSum
            });
        }
        //NO ON-AIRS - started on end 2016
        if(!project.onair.set && !project.onair.empty && project.dates.last.isAfter(moment('2016-09-30', 'YYYY-MM-DD')) && project.dates.last.diff(moment().startOf('day'), 'days') <= 10 && project.budgetSum > 30) { //10 days before last booked day, project at least 30h booked
            o.noOnair.push({
                label: project.label,
                manager: project.manager,
                booked: project.bookedSum,
                empty: false
            });
        }
        //DELETED ON-AIRS last 2 months
        if(!project.onair.set && project.onair.empty && project.dates.last.isAfter(moment().add(-2, 'month')) && project.dates.last.diff(moment().startOf('day'), 'days') <= 10 && project.budgetSum > 30) { //10 days before last booked day, project at least 30h booked 3 months frame for deleted onair
            o.noOnair.push({
                label: project.label,
                manager: project.manager,
                booked: project.bookedSum,
                empty: true
            });
        }
        //PROJECTS WITHOUT BUDGET LINKED // - ended after 1.7.2017
        if(!project.budgetLink) {// &&  item.dates.last.isAfter(moment('2017-06-30', 'YYYY-MM-DD'))) {
            o.noBudgetLink.push({
                label: project.label,
                manager: project.manager,
                booked: project.bookedSum
            });
        }
        return o;
    }, {noK2: [], noTiming: [], noBudget: [], noOnair: [], noBudgetLink: []});
};

// *********************************************************************************************************************
// BOOKING PROJECTS STATUS
// *********************************************************************************************************************
exports.getProjects = async (from, to, underBooked) => {
    const workTypeMap = (await BookingWorkType.find().lean()).reduce((o, workType) => {o[workType._id.toString()] = workType.label; return o}, {});
    const projects = await BookingProject.find({deleted: null, internal: {$ne: true}, offtime: {$ne: true}},{events: true, jobs: true, label: true, manager: true, _id: false}).populate('events manager').lean();
    const today = moment().startOf('day');
    return projects.reduce((out, project) => {
        const events = project.events.filter(event => {
            const eventStart = moment(event.startDate);
            const eventEnd = eventStart.clone().add(event.days.length,'days');
            return eventStart.isBefore(to) && eventEnd.isAfter(from);
        });
        if(events.length > 0) {
            const jobList = ['2D','3D','Matte painting'];
            const projectJobs = project.jobs.reduce((o, job) => {
                if(jobList.indexOf(workTypeMap[job.job]) >= 0) {
                    o[job.job] = {
                        label: workTypeMap[job.job],
                        spent: job.doneDuration,
                        budget: job.plannedDuration,
                        remains: 0
                    };
                }
                return o;
            }, {});
            project.events.forEach(event => {
                if(projectJobs[event.job]) {
                    let durationAfter = 0;
                    for(let dayIndex = 0; dayIndex < event.days.length; dayIndex++) {
                        const day = moment(event.startDate).add(dayIndex,'days');
                        if(!day.isBefore(today)) {
                            durationAfter += (event.days[dayIndex].duration * event.efficiency) / 100;
                        }
                    }
                    projectJobs[event.job].remains += durationAfter;
                }
            });
            const jobs = [];
            for(let jobId in projectJobs) {
                if(projectJobs.hasOwnProperty(jobId)) {
                    const balance = projectJobs[jobId].spent + projectJobs[jobId].remains - projectJobs[jobId].budget;

                    if(underBooked) {
                        if(projectJobs[jobId].budget > (30*60) && balance < 0 ) { // ignore jobs under 30hours budget, take under-booked
                            const percent = balance / projectJobs[jobId].budget;
                            if(percent < -0.1) jobs.push(projectJobs[jobId]); // ignore if diff <= -10%
                        }
                    } else {
                        if(projectJobs[jobId].budget > (30*60) && balance > 0 ) { // ignore jobs under 30hours budget, take overbooked
                            const percent = balance / projectJobs[jobId].budget;
                            if(percent > 0.1) jobs.push(projectJobs[jobId]); // ignore if diff <= 10%
                        }
                    }
                }
            }
            if(jobs.length > 0) {
                out.push({
                    project: project.label,
                    manager: project.manager ? project.manager.name : 'No manager',
                    jobs: jobs
                });
            }
        }
        return out;
    },[]);
};

// *********************************************************************************************************************
// BOOKING PROJECTS FINAL
// *********************************************************************************************************************
exports.getProjectsFinal = async () => {
    const LAST_DATE_AGE_DAYS = 30;
    const LAST_DATE_CUT_OFF_DATE = '2017-05-31';
    const SMALL_PROJECT_HOURS = 30;

    const workTypesMap = (await BookingWorkType.find().lean()).filter(workType => workType.bookable).reduce((o, workType) => {o[workType._id.toString()] = workType.shortLabel; return o}, {});
    const projectsData = await BookingProject.find({deleted: null, internal: {$ne: true}, offtime: {$ne: true}, confirmed: true, checked: null}, {manager: true, supervisor: true, events: true, label: true, K2rid: true, budget: true, jobs: true }).populate('manager supervisor events budget jobs').lean();

    const projects = projectsData
        .map(project => ({
            id: project._id,
            label: project.label,
            manager: project.manager ? project.manager.name : '',
            supervisor: project.supervisor ? project.supervisor.name : '',
            budget: project.budget ?  {offer: project.budget.offer, price: project.budget.parts, currency: project.budget.currency} : null,
            invoice: project.K2rid,
            lastDate: project.events.reduce((last, event) => {
                const eventLast = moment(event.startDate).add(event.days.length, 'days').startOf('day');
                return last && eventLast.isBefore(last) ? last : eventLast;
            }, null),
            jobsSpent: project.jobs.reduce((spent, job) => {
                spent[workTypesMap[job.job]] = job.doneDuration;
                spent.all += job.doneDuration;
                return spent;
            }, {all: 0}),
            jobsBudget: project.jobs.reduce((budget, job) => {
                budget[workTypesMap[job.job]] = job.plannedDuration;
                budget.all += job.plannedDuration;
                return budget;
            }, {all: 0}),
            jobsBooked: project.events.reduce((booked, event) => {
                let eventJob = event.job ? workTypesMap[event.job.toString()] : 'other';
                if(!eventJob) eventJob = 'unknown';
                if(!booked[eventJob]) booked[eventJob] = 0;
                const eventDuration = event.days.reduce((sum, day) => {sum += day.duration * event.efficiency / 100; return sum} , 0);
                booked[eventJob] += eventDuration;
                booked.all += eventDuration;
                return booked;
            }, {all: 0})
        }))
        .filter(project => (project.jobsSpent.all > SMALL_PROJECT_HOURS * 60 || project.jobsBooked.all > SMALL_PROJECT_HOURS * 60) && project.lastDate && project.lastDate.isAfter(moment(LAST_DATE_CUT_OFF_DATE, 'YYYY-MM-DD').startOf('day')) && ( moment().startOf('day').diff(project.lastDate, 'days') > LAST_DATE_AGE_DAYS))
        .sort((a, b) => a.lastDate.diff(b.lastDate, 'days'));

    const budgetItemIds = projects
        .reduce((budgetPartsIds, project) => {
            if(project.budget) budgetPartsIds = budgetPartsIds.concat(project.budget.price);
            return budgetPartsIds
        }, [])
        .map(id => id.toString())
        .filter((id, i, self) => self.indexOf(id) === i);

    const budgetItems = (await BudgetItem.find({_id: {$in: budgetItemIds}}).lean())
        .reduce((map, item) => {if(item.active) map[item._id.toString()] = {price: item.items.reduce((price, line) => price + (line.price * line.numberOfUnits), 0), offer: item.offer}; return map}, {});

    const invoices = (await k2.getInvoices(projects.map(project => project.invoice).filter(id => !!id))).reduce((out, invoice) => {
        if(!out[invoice.RID]) out[invoice.RID] = [];
        out[invoice.RID].push({
            currency: invoice.Mena.trim() === 'Kč' ? 'czk' : invoice.Mena.trim() === '$' ? 'usd' : 'eur',
            price: Math.round(100 * invoice.Cena * invoice.Kurz) / 100,
            dph: Math.round(100 * invoice.DPH * invoice.Kurz) / 100,
            paid: Math.round(100 * invoice.Zap * (invoice.Kurz2 ? invoice.Kurz2 : invoice.Kurz)) / 100
        });
        return out;
    }, {});

    projects.forEach(project => {
        if(project.budget) {
            if(project.budget.price.some(id => budgetItems[id.toString()] && budgetItems[id.toString()].offer)) {
                project.budget.offer = project.budget.price.reduce((sum, id) => budgetItems[id.toString()] ? budgetItems[id.toString()].offer ? sum + budgetItems[id.toString()].offer : sum + budgetItems[id.toString()].price : sum, null);
                if(project.budget.offer === 0) project.budget.offer = null;
            } else project.budget.offer = null;
            project.budget.price = project.budget.price.reduce((sum, id) => budgetItems[id.toString()] ? sum + budgetItems[id.toString()].price : sum, 0);
        }
        project.invoice = invoices[project.invoice] ? invoices[project.invoice] : [];
    });

    return projects;
};

// *********************************************************************************************************************
// BOOKING PROJECTS FINAL - SET CHECKED
// *********************************************************************************************************************
exports.checkProjectFinal = async projectId => {
    await BookingProject.findOneAndUpdate({_id: projectId}, {checked: moment()});
};

// *********************************************************************************************************************
// GET PROFIT
// *********************************************************************************************************************
exports.getProfit = async (from, to) => {
    const today = moment().startOf('day');

    return {data: [], error: '', notCountedOperators: [], strangeWorkLogs: [], averageTariff: 100};
};

// *********************************************************************************************************************
// HELPERS
// *********************************************************************************************************************
function onAirSet(onairs) {
    let result = {set: true, empty: false};
    const activeOnair = onairs.filter(onair => onair.state != 'deleted');
    if(activeOnair.length === 0) return {set: false, empty: true};
    activeOnair.forEach(onair => {
        if(result.set && (!onair.date || (!onair.name && activeOnair.length > 1))) result.set = false;
    });
    return result;
}
