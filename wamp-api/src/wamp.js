'use strict';
const autobahn = require('autobahn');
const logger = require('./logger');
const mongoose = require('mongoose');

const bookingRPC = require('./RPC/bookingRPC');
const bookingSubscribes = require('./Subscribes/bookingSubscribes');
const pusherRPC = require('./RPC/pusherRPC');
const pusherSubscribes = require('./Subscribes/pusherSubscribes');

let heartBeatTimer = null;

const CROSSBAR_URL = `ws://${process.env.CROSSBAR_IPV4}:3000/ws`;
const HEARTBEAT_INTERVAL = parseInt(process.env.WAMP_BOOKING_HEARTBEAT_INTERVAL_MS) || 10000;

let session = null;

const connection = new autobahn.Connection({
    url: CROSSBAR_URL,
    realm: 'chameleon',
    authmethods: ["wampcra"],
    authid: 'chameleon',
    onchallenge: onchallenge,

    max_retries: -1, // default 15, -1 means forever
    initial_retry_delay: 1, // default 1.5
    max_retry_delay: 10, // default 300
    retry_delay_growth: 1.1, // default 1.5

    autoping_interval: 3,
    autoping_timeout: 3,
    autoping_size: 4,
});

let wampWasConnectedBefore = false;
let reportedLost = false;

module.exports.open = () => connection.open();
module.exports.getSession = () => session;
module.exports.publish = (topic, args, kwargs, option) => {if(session) session.publish(topic, args, kwargs, option)};
module.exports.close = (reason, message) => connection.close(reason, message);

connection.onopen = s => {
    session = s;
    reportedLost = false;
    if(!wampWasConnectedBefore) {
        wampWasConnectedBefore = true;
        logger.info(`Connection to crossbar router opened. [${CROSSBAR_URL}]`);
    } else {
        logger.info(`Connection to crossbar router re-opened. [${CROSSBAR_URL}]`);
    }

    for(const procName of Object.keys(bookingRPC)) session.register(procName, bookingRPC[procName], {force_reregister: true}).then(undefined , error => logger.debug(`Registration ${procName} error: ${JSON.stringify(error)}`));
    for(const topic of Object.keys(bookingSubscribes)) session.subscribe(topic, bookingSubscribes[topic]);
    for(const procName of Object.keys(pusherRPC)) session.register(procName, pusherRPC[procName], {force_reregister: true}).then(undefined , error => logger.debug(`Registration ${procName} error: ${JSON.stringify(error)}`));
    for(const topic of Object.keys(pusherSubscribes)) session.subscribe(topic, pusherSubscribes[topic]);

    if(!heartBeatTimer) heartBeatTimer = setInterval(() => {
        session.publish('heart_beat', [], {time: +new Date(), interval: HEARTBEAT_INTERVAL, healthy: mongoose.connection.readyState === 1});
    }, HEARTBEAT_INTERVAL);
};

connection.onclose = reason => {
    session = null;

    if(heartBeatTimer) clearInterval(heartBeatTimer);
    heartBeatTimer = null;

    if(!reportedLost && wampWasConnectedBefore) {
        if(reason === 'closed') logger.info('Connection to crossbar closed.');
        else logger.warn('Connection to crossbar closed: ' + reason);
        if(reason === 'lost') reportedLost = true;
    }
};

function onchallenge(session, method, extra) {
    if (method === "wampcra") {
        const key =  autobahn.auth_cra.derive_key(process.env.CROSSBAR_SECRET_CHAMELEON, extra.salt, extra.iterations, extra.keylen);
        return autobahn.auth_cra.sign(key, extra.challenge);
    }
}

