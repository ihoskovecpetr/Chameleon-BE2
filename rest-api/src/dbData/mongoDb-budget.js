'use strict';
const mongoose = require('mongoose');

//Collections
const Budget = require('../models/budget');
const BudgetClient = require('../models/budget-client');
const Pricelist = require('../models/pricelist');
const Template = require('../models/budget-template');
const PricelistUnit = require('../models/pricelist-unit');
const BookingWorkType = require('../models/booking-work-type');
const PricelistGroup = require('../models/pricelist-group');
const BookingProject = require('../models/booking-project');
const PricelistItem = require('../models/pricelist-item');
const BudgetCondition = require('../models/budget-condition');
const BudgetItem = require('../models/budget-item');
const PricelistSnapshot = require('../models/pricelist-snapshot');

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
    const items = await PricelistItem.find({}, {__v: false}).populate('job').lean();
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
// update pricelist, no id => return general
// *********************************************************************************************************************
exports.updatePricelist = async (id, pricelist) => {
    if(!id) {
        let order = 0;
        const groups = pricelist.pricelist.map(group => ({_id: group.id, label: group.label, color: group.color, order: order++}));
        order = 0;
        const items = pricelist.pricelist.reduce((items, group) => items.concat(group.items.map(item => {return {_id: item.id, group: item.group, label: item.label, unit: item.unitId, price: item.price, job: item.jobId ? item.jobId : null, order: order++ }})), []);
        for(const group of groups) await PricelistGroup.findOneAndUpdate({_id: group._id}, group, {upsert: true});
        for(const item of items) await PricelistItem.findOneAndUpdate({_id: item._id}, item, {upsert: true});
        const newGroups = await PricelistGroup.find({}, {_id:true}).lean();
        const newItems = await PricelistItem.find({}, {_id:true}).lean();

        const groupIds = groups.map(group => group._id);
        const itemIds = items.map(item => item._id);
        const groupsToDelete = newItems.filter(group => groupIds.indexOf(group._id.toString()) < 0);
        const itemsToDelete = newGroups.filter(item => itemIds.indexOf(item._id.toString()) < 0);

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
// get template by ID
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
// get budgets
// *********************************************************************************************************************
exports.getBudgets = async () => {
    const projects = await BookingProject.find({deleted: null, offtime: false, budget: {$ne: null}}).lean();
    const linkedBudgets = projects.map(project => project.budget ? project.budget.toString() : '');
    const budgets = await Budget.find({deleted: null}, {label: true, version: true, parts: true, contact: true, modified: true}, {sort: 'modified'}).lean();
    return budgets.map(budget => ({
        id: budget._id,
        label: `${budget.label}${budget.version ? ` - ${budget.version}` : ''}${budget.parts.length > 1 ? ` (${budget.parts.length})` : ''}`,
        contact: budget.contact.split('@')[0],
        linked: linkedBudgets.indexOf(budget._id.toString()) >= 0
    }));
};

// *********************************************************************************************************************
// create budgets
// *********************************************************************************************************************
exports.createBudget = async options => { // budget = {label, pricelistId, language, currency, template, project}
    const snapshot = await exports.createSnapshot(options);
    const template = [];
    const language = snapshot.language;
    const currency = snapshot.currency;
    const conditions = BudgetCondition.findOne({language: language}).lean();

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

    return await Budget.create({
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
};

// *********************************************************************************************************************
// get budget by id
// *********************************************************************************************************************
exports.getBudget = async id => {
    const budget = await Budget.findOne({_id: id}).populate('pricelist parts').lean();
    const colors = (await PricelistGroup.find({}, {color: true}).lean()).reduce((colors, group) => {colors[group._id.toString()] = group.color; return colors}, {});
    const project = BookingProject.findOne({budget: id, deleted: null, offtime: false}, {label: true, manager: true}).lean();
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
// get booking projects to pair with
// *********************************************************************************************************************
exports.getProjects = async include => {
    let query = {deleted: null, offtime: false, budget: null};
    if(include) query = {$or: [{_id: include}, query]};
    const projects = await BookingProject.find(query, {label: true, K2name: true, K2client: true}).lean();
    return projects.sort((a, b) => a.label.localeCompare(b.label));
};

// *********************************************************************************************************************
// get booking project (For create new from booking)
// *********************************************************************************************************************
exports.getProject = async id => {
    return await BookingProject.findOne({_id: id, deleted: null, offtime: false}, {label: true, K2name: true, K2client: true, budget: true}).lean();
};

// *********************************************************************************************************************
// update booking project - set budget id for new created budget already linked to project
// *********************************************************************************************************************
exports.updateProjectsBudget = async (projectId, budgetId) => {
    return await BookingProject.findOneAndUpdate({_id: projectId}, {budget: budgetId}, {new: true});
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
exports.getNormalizedProject = project => {
    return {
        id: project._id,
        project: {
            label: project.label,
            K2rid: project.K2rid,
            K2client: project.K2client,
            K2name: project.K2name,
            K2projectId: project.K2projectId,
            confirmed: project.confirmed,

            internal: project.internal,

            manager: project.manager,
            supervisor: project.supervisor,
            lead2D: project.lead2D,
            lead3D: project.lead3D,
            leadMP: project.leadMP,
            producer: project.producer,
            created: project.created,

            deleted: project.deleted,

            offtime: project.offtime,
            events: project.events,
            jobs: project.jobs,
            timing: project.timing,
            onair: project.onair,
            invoice: project.invoice,
            bookingNotes: project.bookingNotes,
            budget: project.budget,
            kickBack: project.kickBack
        }
    }
};