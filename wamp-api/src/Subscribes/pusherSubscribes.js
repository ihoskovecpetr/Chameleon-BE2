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
    logger.debug(`projectsBudgetChanged`); //TODO check
    if(kwargs.previous && kwargs.previous.budget && kwargs.previous.budget === '000000000000000000000000') kwargs.previous = null;
    if(kwargs.current && kwargs.current.budget && kwargs.current.budget === '000000000000000000000000') kwargs.current = null;
    const previous = kwargs.previous ? {project: {id: kwargs.previous.id, label: kwargs.previous.label}, budget: kwargs.previous.budget.id, price: await db.getBudgetPrice(kwargs.previous.budget)} : null;
    const current = kwargs.current ? {project: {id: kwargs.current.id, label: kwargs.current.label}, budget: kwargs.current.budget.id, price: await db.getBudgetPrice(kwargs.current.budget)} : null;
    await notifyOfferChanged([], {previous: previous, current: current, fromProject: true});
}

async function notifyOfferChanged(args, kwargs) { //MODIFIED ABOVE OR FROM BUDGET REST API {????} What we need !!!!! ???????
    logger.debug(`notifyOfferChanged`);
    //logger.debug(JSON.stringify(kwargs));
    //TODO !!!!!!!!!!!!!!! FROM BOOKING op - project-add, project-update, project-remove => link, unlink, update
    //if price=null && budget !== null obtain price first - it comes from booking project change - otherwise comes from budget
    //function projectBudgetOfferChanged(previous, current, saveAs) { //from budget and wamp...
    //create message and send it
    //previous, current, saveAs) original fce
    //kwargs = {previous: {project: {id, label}, budget: {id, price: {...}}}, current: {project: {id, label}, budget: {id, price: {...}}}}
    const message = {
        type: 'TODAY',
        label: `Budget`,
        message: '',
        target: {role: 'booking:main-producer'},
        deadline: moment().startOf('day'),
        details: ''
    };
/*
    switch(kwargs.op) { //todo just if() ??????? remove OP?
        case "budget-remove":
            if(kwargs.previous) {
                message.message = `Project '${kwargs.previous.project.label}' was unlinked from budget with offer.`;
                message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)}`;
            }
            break;
        case "budget-copy":
        case "budget-update":
            if(kwargs.previous && kwargs.current && kwargs.previous.project.id === kwargs.current.project.id) { //offer changed?
                if(Math.abs((kwargs.previous.price.percent - kwargs.current.price.percent) >= 1)) { //offer changed! diff >= 1%
                    message.message = `Project '${kwargs.previous.project.label}'. Offer has been changed`;
                    message.detail = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)} -> ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)} -> ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)} -> ${percentString(kwargs.current.price.percent)}`;
                }
            } else { // linked, unlinked or both
                if(kwargs.previous) {
                    message.message = `Project '${kwargs.previous.project.label}' was unlinked from budget with offer.`;
                    message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)}`;
                }
                if(kwargs.current) {
                    message.message = `Project '${kwargs.current.project.label}' was linked to budget with offer.`;
                    message.details = `Budget: ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}\nOffer: ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}\nDiscount: ${percentString(kwargs.current.price.percent)}`;
                }
            }
            break;
    }
*/
    if(kwargs.previous && kwargs.current && kwargs.previous.project.id === kwargs.current.project.id) { //offer changed?
        //todo from project budget diff => link, unlink, from budget and diff => saveAs (copy)
        if(Math.abs((kwargs.previous.price.percent - kwargs.current.price.percent) >= 1)) { //offer changed! diff >= 1%
            message.message = `Project '${kwargs.previous.project.label}'. Offer has been changed`;
            message.detail = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)} -> ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)} -> ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)} -> ${percentString(kwargs.current.price.percent)}`;
        }
    } else { // linked, unlinked or both
        if(kwargs.previous) {
            message.message = `Project '${kwargs.previous.project.label}' was unlinked from budget with offer.`;
            message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)}`;
        }
        if(kwargs.current) {
            message.message = `Project '${kwargs.current.project.label}' was linked to budget with offer.`;
            message.details = `Budget: ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}\nOffer: ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}\nDiscount: ${percentString(kwargs.current.price.percent)}`;
        }
    }
    /*
    if(previous.project.id === current.project.id && (previous.budget.id === current.budget.id || saveAs)) {
        if(previous.project.id !== null && previous.budget.id !== null && Math.abs(previous.budget.price.percent - current.budget.price.percent) >= 1) {
            message.message = `Project '${previous.project.label}'. Offer has been changed.`;
            message.details = `Budget: ${priceString(previous.budget.price.price, previous.budget.price.currency)} -> ${priceString(current.budget.price.price, current.budget.price.currency)}\nOffer: ${offerString(previous.budget.price.offer, previous.budget.price.currency)} -> ${offerString(current.budget.price.offer, current.budget.price.currency)}\nDiscount: ${percentString(previous.budget.price.percent)} -> ${percentString(current.budget.price.percent)}`;
            sendMessage = true;
            //if(isNaN(current.budget.price.price)) {
            //logger.warn(`Offer has been changed message:\n${message.message}\n${message.details}\nPrevious:\n${JSON.stringify(previous, null, 2)}\nCurrent:\n${JSON.stringify(current, null, 2)}`);
            //}
        }
    } else if(previous.project.id === current.project.id) {
        if(previous.budget.id !== null && previous.budget.price && previous.budget.price.offer) {
            message.message = `Project '${previous.project.label}' was unlinked from budget with offer.`;
            sendMessage = true;
        }
        if(current.budget.id !== null && current.budget.price && current.budget.price.offer) {
            message.message = `Project '${current.project.label}' was linked to budget with offer.`;
            message.details = `Budget: ${priceString(current.budget.price.price, current.budget.price.currency)}\nOffer: ${offerString(current.budget.price.offer, current.budget.price.currency)}\nDiscount: ${percentString(current.budget.price.percent)}`;
            sendMessage = true;
        }
    } else if((previous.budget.id === current.budget.id || saveAs) && (previous.project.id || current.project.id)) {
        if(previous.project.id !== null && previous.budget.price && previous.budget.price.offer) {
            message.message = `Project '${previous.project.label}' was unlinked from budget with offer.`;
            sendMessage = true;
        }
        if(current.project.id !== null && current.budget.price.offer) {
            message.message = `${sendMessage ? `${message.message}\n` : ''}Project '${current.project.label}' was linked to budget with offer.`;
            message.details = `Budget: ${priceString(current.budget.price.price, current.budget.price.currency)}\nOffer: ${offerString(current.budget.price.offer, current.budget.price.currency)}\nDiscount: ${percentString(current.budget.price.percent)}`;
            sendMessage = true;
        }
    }
    */
    if(message.message) {
        logger.debug(JSON.stringify(message));
        /*db.addMessage(message)
            .then(newMessages => {
                if(newMessages && newMessages.length > 0) {
                    newMessages.forEach(message => {
                        if (message.target) session.publish(message.target + '.message', [], message);
                    });
                    //email.sendPusherMessage(message);
                }
            })
         */
    }
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