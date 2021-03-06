const mongoose = require('mongoose');
const moment = require('moment');
const logger = require('../logger');
const dataHelper = require('../../_common/lib/dataHelper');

//Collections
const Budget = require('../../_common/models/budget');
const BudgetClient = require('../../_common/models/budget-client');
const Pricelist = require('../../_common/models/pricelist');
const Template = require('../../_common/models/budget-template');
const PricelistUnit = require('../../_common/models/pricelist-unit');
const BookingWorkType = require('../../_common/models/booking-work-type');
const PricelistGroup = require('../../_common/models/pricelist-group');
const BookingProject = require('../../_common/models/booking-project');
const Project = require('../../_common/models/project');
const PricelistItem = require('../../_common/models/pricelist-item');
const BudgetCondition = require('../../_common/models/budget-condition');
const BudgetItem = require('../../_common/models/budget-item');
const PricelistSnapshot = require('../../_common/models/pricelist-snapshot');

//const BookingOplog = require('../../_common/models/booking-oplog');
const projectToBooking = require('../../_common/lib/projectToBooking');

// +++++  P R I C E L I S T S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// *********************************************************************************************************************
// get pricelists
// *********************************************************************************************************************
exports.getPricelists = async () => {
    const pricelists = await Pricelist.find({},{label: true, currency: true, language: true, client: true}).lean();
    return pricelists.map(pricelist => ({id: pricelist._id, label: pricelist.label, currency: pricelist.currency, language: pricelist.language, client: pricelist.client}));
};

// *********************************************************************************************************************
// get pricelist, no id => return general
// *********************************************************************************************************************
exports.getPricelist = async id => {
    const groups = await PricelistGroup.find({}, {__v:false}).lean();
    const items = await PricelistItem.find({}, {__v: false}).lean().populate('job');
    let clientPricelist = id ? await Pricelist.findOne({_id: id}).lean() : null;
    const units = await PricelistUnit.find({}, {__v: false}).lean();

    const pricelistCurrency = clientPricelist ? clientPricelist.currency : '';
    const pricelistLanguage = clientPricelist ? clientPricelist.language : '';
    const pricelistLabel = clientPricelist ? clientPricelist.label : '';
    const pricelistClient = clientPricelist ? clientPricelist.client : '';
    if(clientPricelist) clientPricelist = clientPricelist.pricelist.reduce((o, item) => {o[item.itemId.toString()] = item.price ; return o},{});

    const priceList = items.sort((a, b) => a.order - b.order).map(item => ({
        id: item._id,
        price: item.price,
        clientPrice: clientPricelist && typeof clientPricelist[item._id.toString()] !== 'undefined' ? clientPricelist[item._id.toString()] : undefined,
        group: item.group.toString(),
        label: item.label,
        unitId: item.unit.toString(),
        job: item.job && item.job.bookable && item.job.shortLabel ? item.job.shortLabel : undefined,
        jobId: item.job && item.job.bookable && item.job.shortLabel ? item.job._id : undefined
    }));
    const priceListGroups = groups.sort((a, b) => a.order - b.order).map(group => {
        const groupId = group._id.toString();
        return {
            id: groupId,
            label: group.label,
            color: group.color ? group.color : null,
            items: priceList.filter(item => item.group === groupId)
        }
    });
    const result = {pricelist: priceListGroups, units: units.sort((a,b) => a.order - b.order)};
    if(clientPricelist && pricelistCurrency) result.currency = pricelistCurrency;
    if(clientPricelist && pricelistLanguage) result.language = pricelistLanguage;
    if(clientPricelist && pricelistLabel) result.label = pricelistLabel;
    if(clientPricelist && pricelistClient) result.client = pricelistClient;
    return result;
};
// *********************************************************************************************************************
// create pricelist
// *********************************************************************************************************************
exports.createPricelist = async pricelist => {
    if(typeof pricelist.client !== 'undefined' && !mongoose.Types.ObjectId.isValid(pricelist.client)) {
        const newClientId = mongoose.Types.ObjectId();
        await BudgetClient.create({_id: newClientId, label: pricelist.client, kickBack: 0.0});
        pricelist.client = newClientId;
    }
    await Pricelist.create(pricelist);
};

// *********************************************************************************************************************
// update pricelist, no id => return general
// *********************************************************************************************************************
exports.updatePricelist = async (id, pricelist) => {
    if(!id) {
        let order = 0;
        const groups = pricelist.pricelist.map(group => ({_id: group.id, label: group.label, color: group.color, order: order++}));
        order = 0;
        const items = pricelist.pricelist.reduce((items, group) => items.concat(group.items.map(item => {return {_id: item.id, group: group.id, label: item.label, unit: item.unitId, price: item.price, job: item.jobId ? item.jobId : null, order: order++ }})), []);
        for(const group of groups) await PricelistGroup.findOneAndUpdate({_id: group._id}, group, {upsert: true});
        for(const item of items) await PricelistItem.findOneAndUpdate({_id: item._id}, item, {upsert: true});
        const newGroups = await PricelistGroup.find({}, {_id:true}).lean();
        const newItems = await PricelistItem.find({}, {_id:true}).lean();

        const groupIds = groups.map(group => group._id);
        const itemIds = items.map(item => item._id);
        const groupsToDelete = newGroups.filter(group => groupIds.indexOf(group._id.toString()) < 0);
        const itemsToDelete = newItems.filter(item => itemIds.indexOf(item._id.toString()) < 0);
        for(const group of groupsToDelete) await PricelistGroup.findOneAndRemove({_id: group._id});
        for(const item of itemsToDelete) await PricelistItem.findOneAndRemove({_id: item._id});
    } else {
        if (typeof pricelist.client !== 'undefined' && !mongoose.Types.ObjectId.isValid(pricelist.client)) {
            const newClientId = mongoose.Types.ObjectId();
            await BudgetClient.create({_id: newClientId, label: pricelist.client, kickBack: 0.0});
            pricelist.client = newClientId;
        }
        await Pricelist.findOneAndUpdate({_id: id}, pricelist);
    }
};

// *********************************************************************************************************************
// delete pricelist
// *********************************************************************************************************************
exports.deletePricelist = async id => {
      await Pricelist.findOneAndRemove({_id: id});
};

// *********************************************************************************************************************
// create pricelist snapshot
// *********************************************************************************************************************
exports.createSnapshot = async options => { // options = {pricelistId} OR {language, currency}
    let pricelistId = options.pricelistId ? options.pricelistId : null;
    let currency = options.currency ? options.currency : null;
    let language = options.language ? options.language : null;
    let label = 'General Pricelist';
    let client = '';
    if(pricelistId || (currency && language)) {
        const pricelist = await exports.getPricelist(pricelistId);
        if(pricelistId) {
            currency = pricelist.currency;
            language = pricelist.language;
            label = pricelist.label;
            client = pricelist.client;
        }
        const units = pricelist.units.reduce((units, unit) => {units[unit._id] = unit.label; return units},{});
        const snapshot = {
            pricelistId: pricelistId,
            label: label,
            currency: currency,
            language: language,
            client: client,
            pricelist: pricelist.pricelist.map(group => {
                return {
                    label: group.label,
                    id: group.id,
                    items: group.items.map(item => {
                        const clientPrice = {czk: false, eur: false, usd: false};
                        if(item.clientPrice) clientPrice[currency] = true;
                        const price = item.price;
                        if(item.clientPrice) price[currency] = item.clientPrice;
                        return {
                            id: item.id,
                            label: item.label,
                            price: price,
                            unitId: item.unitId,
                            unit: units[item.unitId],
                            jobId: item.jobId,
                            clientPrice: clientPrice
                        }
                    })
                }
            })
        };
        return await PricelistSnapshot.create(snapshot);
    } else {
        throw `Can't create pricelist snapshot, missing input parameters (id or language + currency).`;
    }
};

// +++++  T E M P L A T E S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// *********************************************************************************************************************
// get templates
// *********************************************************************************************************************
exports.getTemplates = async () => {
    const templates = await Template.find({}, {label: true}).lean();
    return templates.map(template => ({id: template._id, label: template.label}));
};

// *********************************************************************************************************************
// get template
// *********************************************************************************************************************
exports.getTemplate = async (id, idsOnly) => {
    if(idsOnly) {
        const template = await Template.findOne({_id: id}, {items: true}).lean();
        return template.items;
    } else {
        const groups = await PricelistGroup.find({}, {label: true, color: true}).lean();
        const items = await PricelistItem.find({}, {label: true, group: true}).lean();
        const template = id !== 'new' ? await Template.findOne({_id: id}, {label: true, items: true}).lean() : null;
        return {
            groups: groups.map(group => ({id: group._id, label: group.label, color: group.color})),
            items: items.map(item => ({id: item._id, label: item.label, group: item.group})),
            template: template
        }
    }
};

// *********************************************************************************************************************
// create template
// *********************************************************************************************************************
exports.createTemplate = async template => {
    return await Template.create(template);
};

// *********************************************************************************************************************
// update template
// *********************************************************************************************************************
exports.updateTemplate = async (id, template) => {
    await Template.findOneAndUpdate({_id: id}, template);
};

// *********************************************************************************************************************
// remove template
// *********************************************************************************************************************
exports.removeTemplate = async id => {
    await Template.findOneAndRemove({_id: id});
};

// +++++  B U D G E T S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// *********************************************************************************************************************
// get budgets //TODO xBPx
// *********************************************************************************************************************
exports.getBudgets = async () => {
    const bookingProjects = await BookingProject.find({mergedToProject: null, deleted: null, rnd: false, offtime: false, budget: {$ne: null}}, 'budget').lean();
    const projects = (await Project.find({deleted: null, booking: true, bookingBudget: {$ne: null}}, 'bookingType bookingBudget')).map(project => projectToBooking(project, true)).filter(project => !project.offtime && !project.rnd);
    const linkedBudgets = bookingProjects.concat(projects).map(project => project.budget ? project.budget.toString() : '');
    const budgets = await Budget.find({deleted: null}, {label: true, version: true, parts: true, contact: true, modified: true}, {sort: 'modified'}).lean();
    return budgets.map(budget => ({
        id: budget._id,
        label: `${budget.label}${budget.version ? ` - ${budget.version}` : ''}${budget.parts.length > 1 ? ` (${budget.parts.length})` : ''}`,
        contact: budget.contact.split('@')[0],
        linked: linkedBudgets.indexOf(budget._id.toString()) >= 0
    }));
};

// *********************************************************************************************************************
// get budget //TODO xBPx
// *********************************************************************************************************************
exports.getBudget = async id => {
    const budget = await Budget.findOne({_id: id}).lean().populate('pricelist parts');
    const colors = (await PricelistGroup.find({}, {color: true}).lean()).reduce((colors, group) => {colors[group._id.toString()] = group.color; return colors}, {});
    const project = await BookingProject.findOne({mergedToProject: null, budget: id, deleted: null, offtime: false}, {label: true, manager: true}).lean() || projectToBooking(await Project.findOne({'bookingBudget': id, deleted: null, bookingType: {$in: ['CONFIRMED', 'UNCONFIRMED', 'INTERNAL']}}, {name: true, team: true}).lean(), true);
    const v2 = !!budget.pricelist.v2;
    return {
        id: budget._id,
        label: budget.label,
        project: project
            ?
            {
                _id: project._id,
                label: project.label,
                manager: project.manager
            }
            : null,
        version: budget.version,
        language: budget.language,
        currency: budget.currency,
        pricelist: {
            id: budget.pricelist.pricelistId,
            label: budget.pricelist.label,
            items: budget.pricelist.pricelist.reduce((items, group) => items.concat(group.items.map(item => {
                return {
                    group: group.id,
                    label: item.label,
                    unit: item.unit,
                    price: item.price,
                    jobId: item.jobId,
                    unitId: item.unitId,
                    clientPrice : item.clientPrice,
                    id: item.id,
                    _id: item._id
                }
            })), []),
            groups: budget.pricelist.pricelist.reduce((groups, group, index) => {
                groups[group.id] = {label: group.label, index: index};
                return groups;
            }, {}),
            colors: colors
        },
        parts: budget.parts,
        client: budget.client,
        contact:budget.contact,
        date: budget.date,
        state: budget.state,
        created: budget.created,
        modified: budget.modified,
        conditions: budget.conditions,
        projectLabel: budget.projectLabel,
        colorOutput: budget.colorOutput,
        singleOutput: budget.singleOutput,
        multiTotal: budget.multiTotal,
        v2: v2
    }
};

// *********************************************************************************************************************
// create budget
// *********************************************************************************************************************
exports.createBudget = async options => { // budget = {label, pricelistId, language, currency, template}
    const snapshot = await exports.createSnapshot(options);
    const template = [];
    const language = snapshot.language;
    const currency = snapshot.currency;
    const conditions = await BudgetCondition.findOne({language: language}).lean();

    if(options.template) {
        const units = (await PricelistUnit.find({}, {timeRatio: true}).lean()).reduce((units, unit) => {units[unit._id] = unit; return units}, {});
        const groupMap = snapshot.pricelist.reduce((map, group) => {
            map[group.id] = group;
            return map
        }, {});
        const itemMap = snapshot.pricelist.reduce((map, group) => {
            group.items.forEach(item => {
                map[item.id] = item;
            });
            return map;
        }, {});
        const templateData = await Template.findOne({_id: options.template}).lean();

        templateData.items.forEach(item => {
            if(groupMap[item]) {
                template.push({
                    isGroup: true,
                    label: groupMap[item].label[language],
                    id: groupMap[item].id
                });
            } else if(itemMap[item]) {
                template.push({
                    label: itemMap[item].label[language],
                    price: itemMap[item].price[currency],
                    fixed: !!itemMap[item].price[currency],
                    clientPrice: itemMap[item].clientPrice[currency],
                    unit: itemMap[item].unit[language],
                    unitId: itemMap[item].unitId,
                    job: itemMap[item].jobId,
                    unitDuration: units[itemMap[item].unitId] ? units[itemMap[item].unitId].timeRatio : 0,
                    id: itemMap[item].id,
                    subtotal: false,
                    color: ''
                })
            }
        });
    }
    const part = await BudgetItem.create({
        active: true,
        output: true,
        budget: null,
        label: '',
        items: template
    });
    const budget =  await Budget.create({
        label: options.label,
        language: language,
        currency: currency,
        pricelist: snapshot._id,
        parts: [part._id],
        conditions: conditions ? conditions.conditions : '',
        contact: options.contact,
        colorOutput: false,
        singleOutput: false,
        multiTotal: false,
        client: snapshot.client
    });
    const project = options.project ? await exports.updateProjectsBudget(options.project, budget._id) : null;
    return {newProject: project, oldProject: null, newBudget: budget._id, oldBudget: null, newPrice: null, oldPrice: null};
};

// *********************************************************************************************************************
// create as copy budget //TODO xBPx
// *********************************************************************************************************************
exports.createBudgetAsCopy = async (id, budget) => {
    const newPrice = getBudgetPrices(budget);
    const oldBudget = await Budget.findOne({_id: id}).populate('parts');
    const oldPrice = getBudgetPrices(oldBudget);
    const newId =  mongoose.Types.ObjectId();
    oldBudget._id = newId;
    oldBudget.isNew = true;
    oldBudget.parts = [];
    await oldBudget.save();
    const parts = [...budget.parts];
    budget.parts = budget.parts.map(part => part._id);
    await Budget.findOneAndUpdate({_id: newId}, budget);
    for(const part of parts) await BudgetItem.create(part, {setDefaultsOnInsert: true});
    //const newProject = await BookingProject.findOne({_id: budget.project}, '_id').lean() || ;
    //const newProjectId = newProject ? budget.project : null;
    //const project = newProjectId ? await exports.updateProjectsBudget(newProjectId, newId, true) : null;
    const project = await exports.updateProjectsBudget(budget.project, newId, true);
    return {oldProject: project, newProject: project, newPrice: newPrice, oldPrice: oldPrice, newBudget: newId, oldBudget: id};
};

// *********************************************************************************************************************
// update budget //TODO xBPx
// *********************************************************************************************************************
exports.updateBudget = async (id, budget) => {
    const newPrice = getBudgetPrices(budget);
    const oldPrice = getBudgetPrices(await Budget.findOne({_id: id}).lean().populate('parts'));
    const parts = [...budget.parts];
    budget.parts = budget.parts.map(part => part._id);
    const oldBudget = await Budget.findOneAndUpdate({_id: id}, budget);
    for(const part of parts) await BudgetItem.update({_id: part._id}, part, {upsert: true, setDefaultsOnInsert: true});

    const partIds = parts.map(part => part._id);
    const toDelete = oldBudget.parts.filter(partId => partIds.indexOf(partId.toString()) < 0);
    for(const partId of toDelete) await BudgetItem.findByIdAndRemove(partId);

    const oldProject = await BookingProject.findOne({budget: id, mergedToProject: null}, '_id').lean() || await Project.findOne({'bookingBudget': id}, '_id').lean();
    const newProject = await BookingProject.findOne({_id: budget.project}, '_id').lean() || await Project.findOne({_id: budget.project}, '_id').lean();

    const oldProjectId = oldProject ? oldProject._id.toString() : null;
    const newProjectId = newProject ? newProject._id.toString() : null;

    const result = {oldProject: null, newProject: null, newPrice: newPrice, oldPrice: oldPrice, oldBudget: id, newBudget: id};
    if(oldProjectId !== newProjectId) {
        if(newProjectId) result.newProject = await exports.updateProjectsBudget(newProjectId, id, true);
        if(oldProjectId) result.oldProject = await exports.updateProjectsBudget(oldProjectId, null, true);
    } else {
        if(newProjectId) result.newProject = await exports.updateProjectsBudget(newProjectId, id, true);
        result.oldProject = result.newProject;
    }
    return result;
};

// *********************************************************************************************************************
// remove budget  //TODO xBPx
// *********************************************************************************************************************
exports.removeBudget = async id => {
    const budget = await Budget.findOneAndUpdate({_id: id}, {deleted: moment()}).populate('parts');
    let project = await BookingProject.findOne({mergedToProject: null, budget: id}, {_id: true}).lean() || Project.findOne({'bookingBudget': id}, {_id: true}).lean();
    if(project) project = await exports.updateProjectsBudget(project._id, null, true);
    return {oldProject: project, newProject: null, oldPrice: getBudgetPrices(budget), newPrice: null, oldBudget: id, newBudget: null}
};

// +++++  O T H E R S  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// *********************************************************************************************************************
// get units
// *********************************************************************************************************************
exports.getUnits = async () => {
    const units = await PricelistUnit.find({}, {__v: false}).lean();
    return units.sort((a, b) => a.order - b.order);
};

// *********************************************************************************************************************
// update units
// *********************************************************************************************************************
exports.updateUnits = async units => {
    const oldUnits = await PricelistUnit.find({}, {_id:true});
    const unitIds = units.map(unit => unit._id);
    const toRemove = oldUnits.filter(unit => unitIds.indexOf(unit._id.toString()) < 0);
    for(const unit of units) await PricelistUnit.findOneAndUpdate({_id: unit._id}, unit, {upsert: true});
    for(const unit of toRemove) await PricelistUnit.findOneAndRemove({_id: unit._id});
};

// *********************************************************************************************************************
// get work type (jobs)
// *********************************************************************************************************************
exports.getWorkTypes = async () => {
    return await BookingWorkType.find({bookable: true}, {shortLabel: true, type: true}).lean();
};

// *********************************************************************************************************************
// get all clients
// *********************************************************************************************************************
exports.getClients = async () => {
    const clients = await BudgetClient.find({},{label: true, kickBack: true}).lean();
    return clients.map(client => ({_id: client._id, label: client.label, kickBack: client.kickBack})).sort((a,b) => a.label.localeCompare(b.label));
};

// *********************************************************************************************************************
// get booking projects to pair with  //TODO xBPx
// *********************************************************************************************************************
exports.getProjects = async include => {
    let queryBookingProject = {deleted: null, offtime: false, budget: null,  mergedToProject: null};
    let queryProject = {deleted: null, bookingBudget: null};
    if(include) {
        queryBookingProject = {$or: [{_id: include}, queryBookingProject]};
        queryProject = {$or: [{_id: include}, queryProject]};
    }
    const bookingProjects = await BookingProject.find(queryBookingProject, {label: true, K2name: true, K2client: true}).lean();
    const projects = (await Project.find(queryProject, {name: true, K2: true}).lean()).map(project => ({_id: project._id, label: project.name, K2name: project.K2 ? project.K2.name : null, K2client: project.K2 ? project.K2.client : null, version: 2}));
    return bookingProjects.concat(projects).sort((a, b) => a.label.localeCompare(b.label));
};

// *********************************************************************************************************************
// get booking project (For create new from booking)  //TODO xBPx
// *********************************************************************************************************************
exports.getProject = async id => {
    return await BookingProject.findOne({_id: id, deleted: null, offtime: false, rnd: false}, {label: true, K2name: true, K2client: true, budget: true}).lean() || projectToBooking(await Project.findOne({_id: id, deleted: null, bookingType: {$in: ['CONFIRMED', 'UNCONFIRMED', 'INTERNAL']}}, 'name K2 bookingBudget').lean(), true);
};

// *********************************************************************************************************************
// update booking project - set budget id for new created budget already linked to project  //TODO xBPx
// *********************************************************************************************************************
exports.updateProjectsBudget = async (projectId, budgetId, updateMinutes) => {
    let changed = false;
    const project = await BookingProject.findOne({_id: projectId}) || await Project.findOne({_id: projectId});
    if(project) {
        if(project.projectId) { //from project, projectId doesn't exists in bookingProject
            if(project.bookingBudget != budgetId) {
                project.bookingBudget = budgetId;
                changed = true;
            }
        } else { // from bookingProject
            if(project.budget != budgetId) {
                project.budget = budgetId;
                changed = true;
            }
        }
        if(updateMinutes) {
            if(budgetId) {
                const budgetMinutes = await getBudgetMinutes(budgetId); //{kickBack, jobs}
                changed = updatePlannedMinutes(budgetMinutes, project) || changed;
            } else {
                changed = resetPlannedMinutes(project) || changed;
            }
        }
        if(changed) {
            const updatedProject = await project.save();
            return exports.getNormalizedProject(updatedProject.projectId ? projectToBooking(updatedProject) : updatedProject);
        } else return exports.getNormalizedProject(project.projectId ? projectToBooking(project) : project);
    } else return null;
};

// *********************************************************************************************************************
// get budget conditions
// *********************************************************************************************************************
exports.getConditions = async () => {
    const conditions = await BudgetCondition.find({},{__v: false}).lean();
    return conditions.reduce((out, condition) => {
        out[condition.language] = condition.conditions;
        return out;
    }, {});
};

// *********************************************************************************************************************
// get normalized project for wamp (booking)
// *********************************************************************************************************************
exports.getNormalizedProject = source => {
    const project = dataHelper.normalizeDocument(source);
    const id = project._id.toString();
    delete project._id;
    return {id: id, project: project};
};

// *********************************************************************************************************************
// helpers
// *********************************************************************************************************************
//TODO xBPx
function resetPlannedMinutes(project) {
    if(project) {
        let changed = false;
        if(project.projectId) { //project
            project.work.forEach((work, index) => {
                if (work.plannedDuration !== 0) {
                    project.work[index].plannedDuration = 0;
                    changed = true;
                }
            });
            project.work = project.work.filter(work => work.plannedDuration > 0 || work.doneDuration > 0); // remove 0-0 job
        } else { //booking project
            project.jobs.forEach((job, index) => {
                if (job.plannedDuration !== 0) {
                    project.jobs[index].plannedDuration = 0;
                    changed = true;
                }
            });
            project.jobs = project.jobs.filter(job => job.plannedDuration > 0 || job.doneDuration > 0); // remove 0-0 job
        }
        if(project.kickBack) {
            project.kickBack = false;
            changed = true;
        }
        return changed;
    } else return false;
}
//TODO xBPx
function updatePlannedMinutes(budgetMinutes, project) {
    if(budgetMinutes && project) {
        let changed = false;
        if(project.projectId) { // from project
            project.work.forEach((work, index) => {
                if(budgetMinutes.jobs[work.type.toString()]) {
                    if(work.plannedDuration !== budgetMinutes.jobs[work.type.toString()]) {
                        project.work[index].plannedDuration = budgetMinutes.jobs[work.type.toString()];
                        changed = true;
                    }
                    budgetMinutes.jobs[work.type.toString()] = -1; //indicate it is used
                } else if(work.plannedDuration !== 0) {
                    project.work[index].plannedDuration = 0;
                    changed = true;
                }
            });
            project.work = project.work.filter(work => work.plannedDuration > 0 || work.doneDuration > 0); // remove 0-0 job
        } else { // from bookingProject
            project.jobs.forEach((job, index) => {
                if(budgetMinutes.jobs[job.job.toString()]) {
                    if(job.plannedDuration !== budgetMinutes.jobs[job.job.toString()]) {
                        project.jobs[index].plannedDuration = budgetMinutes.jobs[job.job.toString()];
                        changed = true;
                    }
                    budgetMinutes.jobs[job.job.toString()] = -1; //indicate it is used
                } else if(job.plannedDuration !== 0) {
                    project.jobs[index].plannedDuration = 0;
                    changed = true;
                }
            });
            project.jobs = project.jobs.filter(job => job.plannedDuration > 0 || job.doneDuration > 0); // remove 0-0 job
        }
        Object.keys(budgetMinutes.jobs).filter(jobId => budgetMinutes.jobs[jobId.toString()] >= 0).forEach(jobId => { //at first filter out used (-1)
            changed = true;
            if(project.projectId) { // project
                project.work.push({doneDuration: 0, type: jobId.toString(), plannedDuration: budgetMinutes.jobs[jobId.toString()]})
            } else { // booking project
                project.jobs.push({doneDuration: 0, job: jobId.toString(), plannedDuration: budgetMinutes.jobs[jobId].toString()})
            }
        });
        if(project.kickBack !== budgetMinutes.kickBack) {
            project.kickBack = budgetMinutes.kickBack;
            changed = true;
        }
        return changed;
    } else return false;
}

function getBudgetPrices(budget) {
    const parts =  budget.parts.map(part => {
        return {
            offer: part.offer,
            price: part.items.reduce((price, item) => price + ((item.numberOfUnits ? item.numberOfUnits : 0) * (item.price ? item.price : 0)), 0),
            currency: budget.currency,
            active: part.active
        }
    }).filter(item => item.active);
    const hasOffer = parts.some(part => part.offer);
    const result = parts.reduce((total, item) => {
        total.offer = hasOffer ? item.offer ? total.offer + item.offer : total.offer + item.price : null;
        total.price += item.price;
        total.currency = item.currency;
        return total;
    }, {offer: 0, price: 0, currency: '', percent: null});
    result.percent = result.price > 0 && result.offer ? Math.round(1000 * (result.price - result.offer) / result.price) / 10 : 0;
    if(result.offer === 0) result.offer = null;
    return result;
}

async function getBudgetMinutes(budgetId, isBudget) {
    let result = {kickBack: false, jobs: {}};
    const budget = isBudget ? budgetId : await Budget.findOne({_id: budgetId}, {parts: true, client: true}).lean().populate('parts');
    if(budget) {
        budget.parts.filter(part => part.active).forEach(part => {
            part.items.forEach(item => {
                if(!item.isGroup && item.job && item.numberOfUnits > 0 && item.unitDuration > 0) {
                    if (!result.jobs[item.job.toString()]) result.jobs[item.job.toString()] = 0;
                    let minutes = item.numberOfUnits * item.unitDuration;
                    if(item.generalPrice && item.generalPrice > 0 && item.generalPrice > item.price) {
                        minutes = Math.round(minutes * (item.price / item.generalPrice));
                        result.kickBack = true;
                    }
                    result.jobs[item.job.toString()] += minutes;
                }
            })
        });
        if(budget.client && mongoose.Types.ObjectId.isValid(budget.client)) {
            const kickBack = await BudgetClient.findOne({_id: budget.client}, {kickBack: true}).lean();
            if(kickBack) {
                result.kickBack = result.kickBack || !!kickBack.kickBack;
                if (kickBack.kickBack) {
                    Object.keys(result.jobs).forEach(jobKey => {
                        result.jobs[jobKey] = Math.round(result.jobs[jobKey] * (1 - kickBack.kickBack));
                    })
                }
            }
        }
    }
    return result;
}

exports.getBudgetForProject = async id => {
    if(!id) return null;
    if(id.toString() === '000000000000000000000000') return {_id: '000000000000000000000000', label: '', version: '', price: null, minutes: null};
    const budget = await Budget.findOne({_id: id}).lean().populate('parts');
    if(!budget) return id;
    const budgetPrices = getBudgetPrices(budget);
    const budgetMinutes = await getBudgetMinutes(budget, true);
    return {_id: id, label: budget.label, version: budget.version, price: budgetPrices, minutes: budgetMinutes};
};

exports.getBudgetHoursMap = async id => {
    if(!id) return null;
    const budget = await Budget.findOne({_id: id}).lean().populate('parts');
    if(!budget) return [];
    const hours =  await getBudgetMinutes(budget, true);
    if(hours && hours.jobs) {
        return hours.jobs;
    } else return {};
};


