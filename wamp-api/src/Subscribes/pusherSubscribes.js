'use strict';

module.exports = {
    'pusher.ping': onPusherPing
};

const PUSHER_PING_INTERVAL = 5; //seconds - from pusher app !!!!
const PUSHER_PING_DELAY = PUSHER_PING_INTERVAL * 2; // seconds
const PUSHER_CLEANER_INTERVAL = PUSHER_PING_INTERVAL * 2; //seconds
const pusherClients = {};

setInterval(() => {
    const now = +new Date();
    Object.keys(pusherClients).forEach(client => {
        if(now - pusherClients[client].timestamp > PUSHER_PING_DELAY * 1000) {
            delete pusherClients[client];
        }
    });
}, PUSHER_CLEANER_INTERVAL * 1000);

function onPusherPing(args, kwargs, details) {
    if(details.publisher) {
        if (pusherClients[details.publisher]) {
            if(kwargs.user !== null) {
                pusherClients[details.publisher].user = kwargs.user;
                pusherClients[details.publisher].debug = kwargs.debug;
                pusherClients[details.publisher].multi = kwargs.multi;
                pusherClients[details.publisher].version = kwargs.version ? kwargs.version : '0.0.1';
                pusherClients[details.publisher].timestamp = +new Date();
            } else {
                delete pusherClients[details.publisher]
            }
        } else {
            if(kwargs.user != null) {
                pusherClients[details.publisher] = {
                    user: kwargs.user,
                    debug: kwargs.debug,
                    multi: kwargs.multi,
                    version: kwargs.version ? kwargs.version : '0.0.1',
                    timestamp: +new Date()
                };
            }
        }
    }
}