'use strict';

const logger = require('../logger');
const db = require('../dbData/mongoDb-pusher');

const pusherClient = require('../lib/pusherClient');

module.exports = {
    'pusher.ping': onPusherPing,
    'updatePusherData': updatePusherData,
    'projectsBudgetChanged': projectsBudgetChanged,
    'notifyOfferChanged': notifyOfferChanged
};

// *********************************************************************************************************************
// Pusher ping (store active client)
// *********************************************************************************************************************
function onPusherPing(args, kwargs, details) {
    pusherClient.clientPing(details.publisher, kwargs);
}

function updatePusherData(args, kwargs) {
    logger.debug(`updatePusherData [${Object.keys(kwargs)}]`);
    //TODO !!!!!!!!!!!!!!!!
}

async function projectsBudgetChanged(args, kwargs) { //FROM PROJECT CHANGES => PROJECT ID IS THE SAME, LABEL CAN CHANGE AND BUDGET CAN CHANGE
    logger.debug(`projectsBudgetChanged`);
    if(kwargs.previous && kwargs.previous.budget && kwargs.previous.budget === '000000000000000000000000') kwargs.previous.budget = null;
    if(kwargs.current && kwargs.current.budget && kwargs.current.budget === '000000000000000000000000') kwargs.current.budget = null;
    //NORMALIZE FOR notifyOfferChanged
    // from {oldProject, newProject, oldPrice, newPrice, oldBudget, newBudget, op}
    // to {?????} + prices
    const previous = kwargs.previous ? {project: {id: kwargs.previous.id, label: kwargs.previous.label}, budget: {id: kwargs.previous.budget, price: await db.getBudgetPrice(kwargs.previous.budget)}} : null;
    const current = kwargs.current ? {project: {id: kwargs.current.id, label: kwargs.current.label}, budget: {id: kwargs.current.budget, price: await db.getBudgetPrice(kwargs.current.budget)}} : null;
    await notifyOfferChanged([], {previous: previous, current: current});
}

async function notifyOfferChanged(args, kwargs) { //MODIFIED ABOVE OR FROM BUDGET REST API {????} What we need !!!!! ???????
    logger.debug(`notifyOfferChanged`);
    logger.debug(JSON.stringify(kwargs));
    //TODO !!!!!!!!!!!!!!!
    //if price=null && budget !== null obtain price first - it comes from booking project change - otherwise comes from budget
    //function projectBudgetOfferChanged(previous, current, saveAs) { //from budget and wamp...
    //create message and send it
    let sendMessage = false;
    const message = {
        type: 'TODAY',
        label: `Budget`,
        message: '',
        target: {role: 'booking:main-producer'},
        deadline: moment().startOf('day'),
        details: ''
    };
}

function percentString(amount) {
    if(!amount) amount = '0';
    return `${amount}%`;
}

function priceString(amount, unit) {
    return `${numberFormat(amount)} ${unit.toUpperCase()}`;
}

function offerString(amount, unit) {
    if(amount) {
        amount = numberFormat(amount);
        return `${amount} ${unit.toUpperCase()}`;
    } else {
        return 'no offer';
    }
}

function numberFormat(value) {
    const rx= /(\d+)(\d{3})/;
    return String(value).replace(/\d+/, w => {
        while(rx.test(w)){
            w = w.replace(rx, '$1 $2');
        }
        return w;
    });
}