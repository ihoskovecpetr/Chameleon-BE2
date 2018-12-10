'use strict';
const autobahn = require('autobahn');
const logger = require('./logger');

const CROSSBAR_URL = `ws://${process.env.CROSSBAR_IPV4}:${process.env.CROSSBAR_PORT}/ws`;

let wampWasConnectedBefore = false;
let reportedLost = false;

module.exports = async () => {
    const connection = new autobahn.Connection({
        url: CROSSBAR_URL,
        realm: 'chameleon',
        authmethods: ["wampcra"],
        authid: 'chameleon',
        onchallenge: onchallenge,
        max_retries: -1, // default 15, -1 means forever
        initial_retry_delay: 1, // default 1.5
        max_retry_delay: 10, // default 300
        retry_delay_growth: 1.1 // default 1.5
    });

    connection.open();

    connection.onopen = session => {
        //session.register();
        //session.subscribe();
        reportedLost = false;
        if(!wampWasConnectedBefore) {
            wampWasConnectedBefore = true;
            logger.info(`Connection to crossbar router opened. [${CROSSBAR_URL}]`);
        } else {
            logger.info(`Connection to crossbar router re-opened. [${CROSSBAR_URL}]`);
        }
    };

    connection.onclose = (reason, details) => {
        if(!reportedLost && wampWasConnectedBefore) {
            logger.warn('Connection to crossbar closed: ' + reason);
            if(reason === 'lost') reportedLost = true;
        }
    };
};

function onchallenge(session, method, extra) {
    if (method === "wampcra") {
        const key =  autobahn.auth_cra.derive_key(process.env.CROSSBAR_SECRET_CHAMELEON, extra.salt, extra.iterations, extra.keylen);
        return autobahn.auth_cra.sign(key, extra.challenge);
    }
}