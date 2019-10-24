'use strict';
const autobahn = require('autobahn');
const logger = require('./logger');

const CROSSBAR_URL = `ws://${process.env.CROSSBAR_IPV4}:3000/ws`;

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

    on_user_error: (error, customErrorMessage) => {
        logger.warn(`Autobahn user error: ${error} || ${customErrorMessage}`);
    },
    on_internal_error: (error, customErrorMessage) => {
        logger.warn(`Autobahn internal error: ${error} || ${customErrorMessage}`);
    }
});

let wampWasConnectedBefore = false;
let reportedLost = false;

module.exports.open = () => connection.open();
module.exports.getSession = () => session;
module.exports.publish = (topic, args, kwargs, option) => {
    logger.debug(`Wamp publish. Topic: ${topic}, session: ${!!session}`);
    if(session) session.publish(topic, args, kwargs, option);
};

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
};

connection.onclose = (reason, details) => {
    session = null;
    if(!reportedLost && wampWasConnectedBefore) {
        if(reason === 'closed') logger.info('Connection to crossbar closed.');
        else logger.warn('Connection to crossbar closed: ' + reason);
        if(reason === 'lost') reportedLost = true;
    }
};

function onchallenge(session, method, extra) {
    if (method === "wampcra") {
        const key = autobahn.auth_cra.derive_key(process.env.CROSSBAR_SECRET_CHAMELEON, extra.salt, extra.iterations, extra.keylen);
        return autobahn.auth_cra.sign(key, extra.challenge);
    }
}

// *********************************************************************************************************************
// PUBLISH
// *********************************************************************************************************************
module.exports.notifyAboutUpdatedProject = project => { //called from budget
    if(session && project) session.publish('updateProject', [], project);
};


module.exports.publish = (topic, args, kwargs, option) => {
    if(session) session.publish(topic, args, kwargs, option);
};
/*
module.exports.notifyAboutCreatedProject = project => { // not used so far
    if(session && project) session.publish('addProject', [], project);
};
*/
module.exports.projectBudgetOfferChanged = data => {
    if(session && data) {
        const previous = data.oldProject && data.oldProject.id && data.oldBudget && data.oldBudget && data.oldPrice && data.oldPrice.offer ? {project: {id: data.oldProject.id, label: data.oldProject.project.label}, budget: data.oldBudget, price: data.oldPrice} : null;
        const current = data.newProject && data.newProject.id && data.newBudget && data.newBudget && data.newPrice && data.newPrice.offer ? {project: {id: data.newProject.id, label: data.newProject.project.label}, budget: data.newBudget, price: data.newPrice} : null;
        if(previous || current) session.publish('notifyOfferChanged', [], {previous: previous, current: current, op: data.op});
    }
};
//**********************************************************************************************************************
module.exports.addBookingProject = data => {
    if(session) {
        session.publish('addProject', [], data);

    }
};

module.exports.updateBookingProject = data => {
    if(session) {
        session.publish('updateProject', [], data);
    }
};

module.exports.removeBookingProject = data => {
    if(session) {
        session.publish('removeProject', [], data);
    }
};

