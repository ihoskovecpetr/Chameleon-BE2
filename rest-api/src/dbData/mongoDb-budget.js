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

const BudgetPart = require('../models/budget-item');
const PricelistSnapshot = require('../models/pricelist-snapshot');

// *******************************************************************************************
// get pricelists
// *******************************************************************************************
exports.getPricelists = async () => {
    const pricelists = await Pricelist.find({},{label: true, currency: true, language: true, client: true}).lean();
    return pricelists.map(pricelist => ({id: pricelist._id, label: pricelist.label, currency: pricelist.currency, language: pricelist.language, client: pricelist.client}));
};

// *******************************************************************************************
// get pricelist, no id => return general
// *******************************************************************************************
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

// *******************************************************************************************
// get units
// *******************************************************************************************
exports.getUnits = async () => {
    const units = await PricelistUnit.find({}, {__v: false}).lean();
    return units.sort((a, b) => a.order - b.order);
};

// *******************************************************************************************
// get work type (jobs)
// *******************************************************************************************
exports.getWorkTypes = async () => {
    return await BookingWorkType.find({bookable: true}, {shortLabel: true, type: true}).lean();
};

// *******************************************************************************************
// get budgets
// *******************************************************************************************
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

// *******************************************************************************************
// get budget by id
// *******************************************************************************************
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

// *******************************************************************************************
// get all clients
// *******************************************************************************************
exports.getClients = async () => {
    const clients = await BudgetClient.find({},{label: true, kickBack: true}).lean();
    return clients.map(client => ({_id: client._id, label: client.label, kickBack: client.kickBack})).sort((a,b) => a.label.localeCompare(b.label));
};

// *******************************************************************************************
// get templates
// *******************************************************************************************
exports.getTemplates = async () => {
    const templates = await Template.find({}, {label: true}).lean();
    return templates.map(template => ({id: template._id, label: template.label}));
};

// *******************************************************************************************
// get booking projects to pair with
// *******************************************************************************************
exports.getProjects = async include => {
    let query = {deleted: null, offtime: false, budget: null};
    if(include) query = {$or: [{_id: include}, query]};
    const projects = await BookingProject.find(query, {label: true, K2name: true, K2client: true}).lean();
    return projects.sort((a, b) => a.label.localeCompare(b.label));
};
