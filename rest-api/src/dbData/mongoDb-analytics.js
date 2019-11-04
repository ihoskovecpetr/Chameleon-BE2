'use strict';
const mongoose = require('mongoose');
const moment = require('moment');
const k2 = require('../k2-mssql');
//const logger = require('../logger');
const crypto = require('crypto');
const ALGORITHM = 'aes128';
//const SALT = 'ana1yt1c5_tariff_s41t';

//Collections
const User = require('../../_common/models/user');
const BookingProject = require('../../_common/models/booking-project');
const Project = require('../../_common/models/project');
const BookingWorkType = require('../../_common/models/booking-work-type');
const Budget = require('../../_common/models/budget');
const BudgetItem = require('../../_common/models/budget-item');
const AnalyticsOverhead = require('../../_common/models/analytics-overhead');
const BookingResource = require('../../_common/models/booking-resource');

const projectToBooking = require('../../_common/lib/projectToBooking');

require('../../_common/models/booking-event');


// *********************************************************************************************************************
// MANAGERS AND SUPERVISORS UTILIZATION //TODO xBPx
// *********************************************************************************************************************
exports.getManagersAndSupervisorsUtilization = async (from, to) => {
    const today = moment().startOf('day');
    const users = await User.find({},{role: true, name: true}).lean();
    const bookingProjects = await BookingProject.find({mergedToProject: null, deleted: null, internal: {$ne: true}, offtime: {$ne: true}, rnd: {$ne: true}}, {manager:true, supervisor:true, events:true, _id:false, label:true}).lean().populate('events');
    const projects = (await Project.find({booking: true, deleted: null}, 'bookingType events name team bookingType').lean().populate('events')).map(project => projectToBooking(project, true)).filter(project => !project.internal && !project.offtime && !project.rnd);
    const usersPrepared = users.reduce((out, user) => {
        if(user.role.indexOf('booking:manager') >= 0) {
            out.managers[user._id] = {name: user.name, projects: 0, projectsList: [], hours: 0, remains: 0};
        }
        if(user.role.indexOf('booking:supervisor') >= 0) {
            out.supervisors[user._id] = {name: user.name, projects: 0, projectsList: [], hours: 0, remains: 0};
        }
        return out;
    }, {managers: {}, supervisors: {}});
    const result = projects.concat(bookingProjects).reduce((out, project) => {
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
                if(out.managers[project.manager]) {
                    out.managers[project.manager].projects += 1;
                    out.managers[project.manager].projectsList.push({label: project.label, hours: projectMinutes.duration / 60, remains: projectMinutes.remains / 60});
                    out.managers[project.manager].hours += projectMinutes.duration / 60;
                    out.managers[project.manager].remains += projectMinutes.remains / 60;
                }
            }
            if(project.supervisor) {
                if(out.supervisors[project.supervisor]) {
                    out.supervisors[project.supervisor].projects += 1;
                    out.supervisors[project.supervisor].projectsList.push({label: project.label, hours: projectMinutes.duration / 60, remains: projectMinutes.remains / 60});
                    out.supervisors[project.supervisor].hours += projectMinutes.duration / 60;
                    out.supervisors[project.supervisor].remains += projectMinutes.remains / 60;
                }
            }
        }
        return out;
    }, usersPrepared);

    return {managers: Object.keys(result.managers).map(manager => result.managers[manager]), supervisors: Object.keys(result.supervisors).map(supervisor => result.supervisors[supervisor])}
};

// *********************************************************************************************************************
// MANAGERS AND SUPERVISORS EFFICIENCY //TODO xBPx
// *********************************************************************************************************************
exports.getManagersAndSupervisorsEfficiency = async (from, to) => {
    const today = moment().startOf('day');
    const users = await User.find({},{role: true, name: true}).lean();
    const bookingProjects = await BookingProject.find({mergedToProject: null, deleted: null, internal: {$ne: true}, offtime: {$ne: true}, rnd: {$ne: true}},{manager: true, supervisor: true, events: true, jobs: true, _id:false}).lean().populate('events');
    const projects = (await Project.find({booking: true, deleted: null}, 'events bookingType work team bookingType').lean().populate('events')).map(project => projectToBooking(project, true)).filter(project => !project.internal && !project.rnd && !project.offtime);
    const usersPrepared = users.reduce((out, user) => {
        if(user.role.indexOf('booking:manager') >= 0) {
            out.managers[user._id] = {name: user.name, budget:0, spent:0, remains: 0};
        }
        if(user.role.indexOf('booking:supervisor') >= 0) {
            out.supervisors[user._id] = {name: user.name, budget: 0, spent: 0, remains: 0};
        }
        return out;
    }, {managers: {}, supervisors: {}});

    const result = bookingProjects.concat(projects).reduce((out, project) => {
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
                if (out.managers[project.manager]) {
                    out.managers[project.manager].budget += durations.planned / 60;
                    out.managers[project.manager].spent += durations.done / 60;
                    out.managers[project.manager].remains += remains / 60;
                }
            }

            if (project.supervisor) {
                if (out.supervisors[project.supervisor]) {
                    out.supervisors[project.supervisor].budget += durations.planned / 60;
                    out.supervisors[project.supervisor].spent += durations.done / 60;
                    out.supervisors[project.supervisor].remains += remains / 60;
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
// BOOKING NOTIFICATIONS //TODO xBPx
// *********************************************************************************************************************
exports.getNotifications = async () => {
    const bookingProjects = await BookingProject.find({mergedToProject: null, confirmed: true, manager: {$ne: null}, events: {$gt: []}, deleted: null, internal: {$ne: true}, offtime: {$ne: true}, rnd: {$ne: true}},{events:true, timing:true, label:true, jobs:true, manager:true, K2rid:true, _id:false, onair: true, budget: true}).lean().populate('events');
    const projects = (await Project.find({booking: true, events: {$gt: []}}, 'events timing name work team K2 onair budget bookingType').lean().populate('events')).map(project => projectToBooking(project, true)).filter(project => !project.internal && !project.offtime && !project.rnd && project.events.length > 0 && project.manager);
    const managersMap = (await User.find({_id: {$in: bookingProjects.concat(projects).map(project => project.manager)}}, 'name').lean()).reduce((out, user) => {out[user._id] = {name: user.name}; return out;}, {});
    return bookingProjects.concat(projects).map(project => ({
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
        manager: managersMap[project.manager] ? managersMap[project.manager].name : 'Unknown Manager',
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
// BOOKING PROJECTS STATUS //TODO xBPx
// *********************************************************************************************************************
exports.getProjects = async (from, to, underBooked) => {
    const workTypeMap = (await BookingWorkType.find().lean()).reduce((o, workType) => {o[workType._id.toString()] = workType.label; return o}, {});
    const bookingProjects = await BookingProject.find({mergedToProject: null, deleted: null, internal: {$ne: true}, offtime: {$ne: true}, rnd: {$ne: true}}, {events: true, jobs: true, label: true, manager: true, _id: false}).lean().populate('events');
    const projects = (await Project.find({booking: true, deleted: null}, 'events work name team bookingType').lean().populate('events')).map(project => projectToBooking(project, true)).filter(project => !project.internal && !project.offtime && !project.rnd);
    const usersMap = (await User.find({},{name: true}).lean()).reduce((out, u) => {out[u._id] = u.name; return out}, {});
    const today = moment().startOf('day');
    return bookingProjects.concat(projects).reduce((out, project) => {
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
                    manager: project.manager && usersMap[project.manager] ? usersMap[project.manager] : 'No manager',
                    jobs: jobs
                });
            }
        }
        return out;
    },[]);
};

// *********************************************************************************************************************
// BOOKING PROJECTS FINAL //TODO xBPx
// *********************************************************************************************************************
exports.getProjectsFinal = async () => {
    const LAST_DATE_AGE_DAYS = 30;
    const LAST_DATE_CUT_OFF_DATE = '2017-05-31';
    const SMALL_PROJECT_HOURS = 30;

    const workTypesMap = (await BookingWorkType.find().lean()).filter(workType => workType.bookable).reduce((o, workType) => {o[workType._id.toString()] = workType.shortLabel; return o}, {});
    const bookingProjectsData = await BookingProject.find({mergedToProject: null, deleted: null, internal: {$ne: true}, offtime: {$ne: true}, rnd: {$ne: true}, confirmed: true, checked: null}, {manager: true, supervisor: true, events: true, label: true, K2rid: true, budget: true, jobs: true }).lean().populate('events');
    const projectsData = (await Project.find({booking: true, deleted: null, paymentChecked: null}, 'events team name K2 budget work bookingType').lean().populate('events')).map(project => projectToBooking(project, true)).filter(project => !project.internal && !project.offtime && !project.rnd && project.confirmed);
    const budgetsMap = (await Budget.find({_id: {$in: bookingProjectsData.concat(projectsData).filter(project => project.budget).map(project => project.budget)}}, 'offer parts currency').lean()).reduce((o, budget) => {o[budget._id] = budget; return o}, {});
    const usersMap = (await User.find({},{name: true}).lean()).reduce((out, u) => {out[u._id] = u.name; return out}, {});
    const projects = bookingProjectsData.concat(projectsData)
        .map(project => ({
            id: project._id,
            label: project.label,
            manager: project.manager && usersMap[project.manager] ? usersMap[project.manager] : '',
            supervisor: project.supervisor && usersMap[project.supervisor] ? usersMap[project.supervisor] : '',
            budget: project.budget && budgetsMap[project.budget] ?  {offer: budgetsMap[project.budget].offer, price: budgetsMap[project.budget].parts, currency: budgetsMap[project.budget].currency} : null,
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
// BOOKING PROJECTS FINAL - SET CHECKED //TODO xBPx
// *********************************************************************************************************************
exports.checkProjectFinal = async projectId => {
    await BookingProject.findOneAndUpdate({_id: projectId}, {checked: moment()}) || await Project.findOneAndUpdate({_id: projectId}, {paymentChecked: moment()});
};

// *********************************************************************************************************************
// GET PROFIT //TODO xBPx *********
// *********************************************************************************************************************
exports.getProfit = async (from, to) => {
    const today = moment().startOf('day');
    const jobs = await BookingWorkType.find().lean();
    const overhead = await AnalyticsOverhead.findOne({},{fix:true, percent:true, _id:false}).lean();
    const bookingProjects = await BookingProject.find({mergedToProject: null, deleted: null, internal: {$ne: true}, offtime: {$ne: true}, rnd: {$ne: true}, confirmed: true}, {events: true, jobs: true, K2rid:true, _id: false}).lean().populate('events');
    const projects = (await Project.find({booking: true, deleted: null}, 'events bookingType work K2').lean().populate('events')).map(project => projectToBooking(project, true)).filter(project => !project.internal && !project.offtime && !project.rnd && project.confirmed);
    const operatorTariffs = (await BookingResource.find({type: 'OPERATOR', tariff :{$ne: null}}, {tariff:true, K2id: true }).lean()).map(operator => {return {id: operator._id, K2id: operator.K2id, tariff: getTariffNumber(operator.tariff, operator._id.toString())}});
    const jobTariffs= jobs.reduce((o, job) => {o[job._id] = job.tariff; return o;}, {});
    const operatorTariffsById = operatorTariffs.reduce((o, operator) => {o[operator.id] = operator.tariff; return o;}, {});
    const operatorTariffsByK2Id = operatorTariffs.reduce((o, operator) => {o[operator.K2id] = operator.tariff; return o;}, {});
    const averageOperatorTariff = operatorTariffs.filter(operator => operator.tariff > 0).reduce((o, operator, i, arr) => {
        if(i >= arr.length -1) o = Math.round((o + operator.tariff) / arr.length);
        else o += operator.tariff;
        return o;
    },0);

    const K2projectIds = bookingProjects.concat(projects).reduce((o, project) => {if(project.K2rid) o.push(project.K2rid); return o;},[]);

    const monthsPrepared = {};
    for (let m = from.clone(); m.isBefore(to); m.add(1, 'month')) {
        monthsPrepared[m.format('YYYYMM')] = {
            revenue: jobs.reduce((o, job) => {o[job._id] = 0; return o;}, {}),
            costs: 0
        };
    }

    const resultByMonths = bookingProjects.concat(projects).reduce((out, project) => {
        const projectTotals = jobs.reduce((o, job) => {o[job._id] = 0; return o;}, {});
        const projectTotalsInRange = jobs.reduce((o, job) => {o[job._id] = {}; return o;}, {});
        const remains = {};

        let projectInRange = false;
        let projectStartDay = null;
        let projectEndDay = null;

        project.events.forEach(event => {
            const eventStart = moment(event.startDate).startOf('day');
            const eventEnd = eventStart.clone().add(event.days.length,'days');
            if(!projectStartDay || eventStart.isBefore(projectStartDay)) projectStartDay = eventStart.clone().startOf('day');
            if(!projectEndDay || eventEnd.isAfter(projectEndDay)) projectEndDay = eventEnd.clone().startOf('day');
            for(let dayIndex = 0; dayIndex < event.days.length; dayIndex++) {
                const day = eventStart.clone().add(dayIndex, 'days');
                if(!day.isBefore(from) && !day.isAfter(to)) {
                    projectInRange = true;
                    if(event.job !== null && (event.confirmedAsProject || event.confirmed)) {
                        const monthString = day.format('YYYYMM');
                        if (projectTotalsInRange[event.job][monthString]) projectTotalsInRange[event.job][monthString] += event.days[dayIndex].duration;
                        else projectTotalsInRange[event.job][monthString] = event.days[dayIndex].duration;
                        if(event.operator && day.isAfter(today)) {
                            if(!remains[event.operator]) remains[event.operator] = {};
                            if(remains[event.operator][monthString]) remains[event.operator][monthString] += event.days[dayIndex].duration;
                            else remains[event.operator][monthString] = event.days[dayIndex].duration;
                        }
                    }
                }
                if(event.job !== null) projectTotals[event.job] += event.days[dayIndex].duration;
            }
        });

        if(projectInRange) {
            const projectBudgets = project.jobs.reduce((o, job) => {o[job.job] = job.plannedDuration; return o;},{});
            for(let jobId in projectTotals) {
                if(projectTotals.hasOwnProperty(jobId)) {
                    const total = projectTotals[jobId];
                    if(total > 0) {
                        for (let monthId in projectTotalsInRange[jobId]) {
                            if (projectTotalsInRange[jobId].hasOwnProperty(monthId)) {
                                if (out[monthId] && projectBudgets[jobId]) {
                                    out[monthId].revenue[jobId] += projectBudgets[jobId] * ( projectTotalsInRange[jobId][monthId] / total);
                                }
                            }
                        }
                    } else if(projectBudgets[jobId] > 0) {
                        const projectLength = projectEndDay.diff(projectStartDay,'days');
                        for(let monthId2 in out) {
                            if(out.hasOwnProperty(monthId2)) {
                                let startOffset = projectStartDay.diff(moment(monthId2,'YYYYMM'),'days');
                                let endOffset = moment(monthId2,'YYYYMM').add(1,'month').startOf('month').diff(projectEndDay,'days');
                                if(startOffset < 1) startOffset = 0;
                                if(endOffset < 1) endOffset = 0;
                                const monthLength = moment(monthId2,'YYYYMM').add(1,'month').startOf('month').diff(moment(monthId2,'YYYYMM').startOf('month'),'days');
                                if(monthLength - startOffset - endOffset > 0) {
                                    out[monthId2].revenue[jobId] += projectBudgets[jobId] * ((monthLength - startOffset - endOffset) / projectLength);
                                }
                            }
                        }
                    }
                }
            }

            for(let operatorId in remains) {
                if(remains.hasOwnProperty(operatorId)) {
                    for(let monthId3 in remains[operatorId]) {
                        if(remains[operatorId].hasOwnProperty(monthId3)) {
                            if(out[monthId3] && operatorTariffsById[operatorId]) {
                                out[monthId3].costs += operatorTariffsById[operatorId] * remains[operatorId][monthId3] / 60;
                            }
                        }
                    }
                }
            }

        }
        return out;
    }, monthsPrepared);

    const K2costs = await getCosts(from, to, K2projectIds, operatorTariffsByK2Id, averageOperatorTariff);
    const result = [];
    for(let monthId in resultByMonths) {
        if(resultByMonths.hasOwnProperty(monthId)) {
            let revenue = 0;
            for(let jobId in resultByMonths[monthId].revenue) {
                if(resultByMonths[monthId].revenue.hasOwnProperty(jobId)) {
                    revenue += resultByMonths[monthId].revenue[jobId] * jobTariffs[jobId] / 60;
                }
            }
            const costs = resultByMonths[monthId].costs + (K2costs[monthId] ? K2costs[monthId] : 0);
            result.push({
                month: monthId,
                revenue: Math.round(revenue),
                costs: Math.round(overhead.fix + (costs * (1 + overhead.percent / 100 )))
            });
        }
    }
    return {data: result, error: K2costs.error, notCountedOperators: K2costs.notCountedOperators, strangeWorkLogs: K2costs.strangeWorkLogs, averageTariff: averageOperatorTariff};
};
// *********************************************************************************************************************
// GET / UPDATE ANALYTICS OVERHEAD
// *********************************************************************************************************************
exports.getAnalyticsOverhead = async () => {
    return await AnalyticsOverhead.findOne({}, {__v: false, _id: false}).lean();
};

exports.updateAnalyticsOverhead = async data => {
    const overhead = await AnalyticsOverhead.findOne();
    if(typeof data.percent !== 'undefined') overhead.percent = data.percent;
    if(typeof data.fix !== 'undefined') overhead.fix = data.fix;
    await overhead.save();
};

// *********************************************************************************************************************
// GET / UPDATE WORK TARIFFS
// *********************************************************************************************************************
exports.getWorkTariffs = async () => {
    const workTypes = await BookingWorkType.find({},{__v: false, K2ids: false}).lean();
    return workTypes.map(workType => ({id: workType._id, label: workType.label, tariff: workType.tariff}));
};

exports.updateWorkTariffs = async data => {
    for(const workType of data) await BookingWorkType.findOneAndUpdate({_id: workType.id}, {tariff: workType.tariff});
};

// *********************************************************************************************************************
// GET / UPdATE OPERATOR TARIFFS
// *********************************************************************************************************************
exports.getOperatorTariffs = async () => {
    const operators = await BookingResource.find({type: 'OPERATOR', disabled: {$ne: true}, deleted: {$ne: true}, virtual: {$ne: true}, freelancer: {$ne: true}}, {guarantee: true, tariff:true, label: true, job: true }).lean().populate('job');
    return operators.map(operator => ({
        id: operator._id,
        label: operator.label,
        guarantee: operator.guarantee ? operator.guarantee : 0,
        tariff: operator.tariff ? getTariffNumber(operator.tariff, operator._id.toString()) : 0,
        job: operator.job ? operator.job.label : ""
    }));
};

exports.updateOperatorTariffs = async data => {
    for(const operator of data) await BookingResource.findOneAndUpdate({_id: operator.id}, {
        tariff: operator.tariff ? setTariffString(operator.tariff, operator.id) : operator.tariff,
        guarantee: operator.guarantee
    });
};

// *********************************************************************************************************************

// +----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+-
// HELPERS
// +----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+-
function onAirSet(onairs) {
    let result = {set: true, empty: false};
    const activeOnair = onairs.filter(onair => onair.state != 'deleted');
    if(activeOnair.length === 0) return {set: false, empty: true};
    activeOnair.forEach(onair => {
        if(result.set && (!onair.date || (!onair.name && activeOnair.length > 1))) result.set = false;
    });
    return result;
}

async function getCosts(from, to, K2projectIds, operatorsTariffs, averageTariff) {
    const data = await k2.getK2workLogs(from, to, K2projectIds);
    const notCountedOperators = {};
    const strangeWorkLogs = [];
    const result = data.reduce((o, workLog) => {
        const monthId = moment(workLog.ReservationDate).format('YYYYMM');
        const operatorId = workLog.Jmno.trim().toLowerCase() + "." + workLog.Prij.trim().toLowerCase();
        const tariff = operatorsTariffs[operatorId];
        const hours = workLog.Abbr.trim() == 'hod' ? (Math.round(10 * workLog.Mnoz) / 10) : workLog.Abbr.trim() == 'min' ? (Math.round(workLog.Mnoz / 6) / 10) : 0;
        if(hours > 24) strangeWorkLogs.push({firstName: workLog.Jmno, lastName: workLog.Prij, hours: hours, date: workLog.ReservationDate});
        if(tariff) {
            if (o[monthId]) o[monthId] += tariff * hours;
            else o[monthId] = tariff * hours;
        } else {
            if (o[monthId]) o[monthId] += averageTariff * hours;
            else o[monthId] = averageTariff * hours;
            if(!notCountedOperators[operatorId]) notCountedOperators[operatorId] = {firstName: workLog.Jmno, lastName: workLog.Prij, hours: hours};
            else notCountedOperators[operatorId].hours += hours;
        }
        return o;
    }, {});

    if(Object.keys(notCountedOperators).length > 0) result.notCountedOperators = notCountedOperators;
    if(strangeWorkLogs.length > 0) result.strangeWorkLogs = strangeWorkLogs;

    return result;
}

function getTariffNumber(value, id) {
    if(!value) return 0;
    let tariff = 0;
    try {
        const decipher = crypto.createDecipher(ALGORITHM, id);
        //const key = crypto.scryptSync(id, SALT, 16);
        //const iv = Buffer.alloc(16, 0);
        //const decipher = crypto.createDecipheriv(ALGORITHM, id, iv);
        tariff = parseInt(decipher.update(value, 'hex', 'utf8') + decipher.final('utf8'));
    } catch(e) {}
    return tariff;
}

function setTariffString(value, id) {
    if(typeof value === 'undefined' || value === null) return null;
    let valueString = null;
    try {
        const cipher = crypto.createCipher(ALGORITHM, id);
        valueString = cipher.update(String(value), 'utf8', 'hex') + cipher.final('hex');
    } catch(e) {}
    return valueString;
}
