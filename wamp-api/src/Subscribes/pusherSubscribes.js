'use strict';

const logger = require('../logger');
const db = require('../dbData/mongoDb-pusher');

const pusherClient = require('../lib/pusherClient');

module.exports = {
    'pusher.ping': onPusherPing,
    'updatePusherData': updatePusherData,
    'budgetChanged': budgetChanged
};

// *********************************************************************************************************************
// Pusher ping (store active client)
// *********************************************************************************************************************
function onPusherPing(args, kwargs, details) {
    pusherClient.clientPing(details.publisher, kwargs);
}

function updatePusherData(args, kwargs) {
    logger.debug(`updatePusherData [${Object.keys(kwargs)}]`);
    //TODO
}

function budgetChanged(args, kwargs, details) {
    logger.debug(`budgetChanged notify main-producer`);
    logger.debug(JSON.stringify(kwargs));
    //TODO

    //projectLinkedOrUnlinkedWithBudget
    //function projectBudgetOfferChanged(previous, current, saveAs) { //from budget and wamp...
}