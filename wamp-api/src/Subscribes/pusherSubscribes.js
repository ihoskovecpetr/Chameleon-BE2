'use strict';

const logger = require('../logger');
const moment = require('moment');
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
    //logger.debug(JSON.stringify(kwargs));
}

async function projectsBudgetChanged(args, kwargs) { //From project changes
    logger.debug(`projectsBudgetChanged`);
    const previous = kwargs.previous && kwargs.previous.budget && kwargs.previous.budget !== '000000000000000000000000' ? {project: {id: kwargs.previous.id, label: kwargs.previous.label}, budget: kwargs.previous.budget, price: await db.getBudgetPrice(kwargs.previous.budget)} : null;
    const current = kwargs.current   && kwargs.current.budget  && kwargs.current.budget  !== '000000000000000000000000' ? {project: {id: kwargs.current.id,  label: kwargs.current.label},  budget: kwargs.current.budget,  price: await db.getBudgetPrice(kwargs.current.budget)}  : null;
    await notifyOfferChanged([], {previous: previous, current: current});
}

async function notifyOfferChanged(args, kwargs) { //Called from above projectBudgetChanged() OR from Budget rest-api
    logger.debug(`notifyOfferChanged`);
    const message = {
        type: 'TODAY',
        label: `Budget`,
        message: '',
        target: {role: 'booking:main-producer'},
        deadline: moment().startOf('day'),
        details: ''
    };

    if(kwargs.previous && kwargs.current && (kwargs.previous.project.id === kwargs.current.project.id)) { //offer changed?
        if(Math.abs((kwargs.previous.price.percent - kwargs.current.price.percent)) >= 1) { //offer changed! diff >= 1%
            message.message = `Project '${kwargs.previous.project.label}'. Offer has been changed`;
            message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}${kwargs.previous.price.price !== kwargs.current.price.price || kwargs.previous.price.currency !== kwargs.current.price.currency ? ` -> ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}` : ''}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}${kwargs.previous.price.offer !== kwargs.current.price.offer || kwargs.previous.price.currency !== kwargs.current.price.currency ? ` -> ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}` : ''}\nDiscount: ${percentString(kwargs.previous.price.percent)} -> ${percentString(kwargs.current.price.percent)}`;
        }
    } else { // linked, unlinked or both
        if(kwargs.previous && kwargs.previous.price && kwargs.previous.price.offer) {
            message.message = `Project '${kwargs.previous.project.label}' was unlinked from budget with offer.`;
            message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)}`;
        }
        if(kwargs.current && kwargs.current.price && kwargs.current.price.offer) {
            message.message = `Project '${kwargs.current.project.label}' was linked to budget with offer.`;
            message.details = `Budget: ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}\nOffer: ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}\nDiscount: ${percentString(kwargs.current.price.percent)}`;
        }
    }

    if(message.message) {
        //logger.debug(`\n${message.message}\n${message.details}`);
        db.addMessage(message)
            .then(newMessages => {
                if(newMessages && newMessages.length > 0) {
                    newMessages.forEach(message => {
                        if (message.target) session.publish(message.target + '.message', [], message);
                    });
                    //email.sendPusherMessage(message);
                }
            })
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