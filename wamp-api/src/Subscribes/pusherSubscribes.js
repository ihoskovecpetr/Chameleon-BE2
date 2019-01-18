'use strict';

const pusherClient = require('../lib/pusherClient');

module.exports = {
    'pusher.ping': onPusherPing
};

// *********************************************************************************************************************
// Pusher ping (store active client)
// *********************************************************************************************************************
function onPusherPing(args, kwargs, details) {
    pusherClient.clientPing(details.publisher, kwargs);
}