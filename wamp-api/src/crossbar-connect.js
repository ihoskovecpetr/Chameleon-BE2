'use strict';
const autobahn = require('autobahn');
const logger = require('./logger');
const dbBooking = require('./dbData/mongoDb-booking');
const dbPusher = require('./dbData/mongoDb-pusher');

const CROSSBAR_URL = `ws://${process.env.CROSSBAR_IPV4}:3000/ws`;

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
        session.register('get_info_booking', dbBooking.getInfo);
        session.register('get_info_pusher', dbPusher.getInfo);

        session.subscribe('get_info_booking_async', async () => {
            const data = await dbBooking.getInfo();
            session.publish('sent_info_booking', [`${data} - async`]);
        });

        session.subscribe('get_info_pusher_async', async () => {
            const data = await dbPusher.getInfo();
            session.publish('sent_info_pusher', [`${data} - async`]);
        });

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