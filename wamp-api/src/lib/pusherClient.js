'use strict';

const PUSHER_PING_INTERVAL = 5; //seconds - from pusher app !!!!
const PUSHER_PING_DELAY = PUSHER_PING_INTERVAL * 2; // seconds
const PUSHER_CLEANER_INTERVAL = PUSHER_PING_INTERVAL * 2; //seconds
const pusherClient = {};

module.exports = {
    clientPing: clientPing,
    getClients: getClients
};

setInterval(() => {
    const now = +new Date();
    Object.keys(pusherClient).forEach(client => {
        if(now - pusherClient[client].timestamp > PUSHER_PING_DELAY * 1000) {
            delete pusherClient[client];
        }
    });
}, PUSHER_CLEANER_INTERVAL * 1000);

function clientPing(id, data) {
    if(id) {
        if (pusherClient[id]) {
            if(data.user !== null) {
                pusherClient[id].user = data.user;
                pusherClient[id].debug = data.debug;
                pusherClient[id].multi = data.multi;
                pusherClient[id].version = data.version ? data.version : '0.0.1';
                pusherClient[id].timestamp = +new Date();
            } else {
                delete pusherClient[id]
            }
        } else {
            if(data.user !== null) {
                pusherClient[id] = {
                    user: data.user,
                    debug: data.debug,
                    multi: data.multi,
                    version: data.version ? data.version : '0.0.1',
                    timestamp: +new Date()
                };
            }
        }
    }
}

function getClients() {
    return pusherClient;
}