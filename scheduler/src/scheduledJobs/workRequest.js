'use strict';

const logger = require('../logger');
const wamp = require('../wamp');
const db = require('../dbData/mongoDbData');
const moment = require('moment');

const STAGE_STEP_DELAY_MIN = 15;

module.exports = async () => {
    logger.debug('Work Request Job Fired');
    try {
        const requests = await db.getOpenWorkRequests(STAGE_STEP_DELAY_MIN);
        const leads = await Promise.all(requests.map(request => request.stage === 3 ? null : db.getTodayUserLeads(request.user.id)));
        const messages = requests.map((request, index) => {
            let newStage = request.stage + 1;
            let requestLeads = [];
            if(newStage === 2) {
                requestLeads = leads[index].stage2;
                if(requestLeads.length === 0) newStage = 3;
            }
            if(newStage === 3) {
                requestLeads = leads[index].stage3;
            }
            requests[index].newStage = newStage;
            if(newStage === 4) {
                return {
                    type: 'NOW',
                    label: `Await Work - No work available.`,
                    message: `No body has work on the project for you, ask for internal project to you can work on.`,
                    target: request.user.id,
                    deadline: moment()
                }
            } else {
                return {
                    type: 'WORK_REQUEST',
                    label: 'Await Work',
                    origin: request.user.id,
                    message: `${request.user.name} is awaiting work.`,
                    target: requestLeads,
                    deadline: moment()
                }
            }
        });
        const newMessages = await Promise.all(messages.map(db.addMessage));
        let newMessagesToPusher = [];
        newMessages.forEach(messageArray => {
            messageArray.forEach((message, index) => {
                if(index === 0) requests[index].messageId = message.id;
                newMessagesToPusher.push(message);
            });
        });
        await Promise.all(requests.map(request => db.addWorkRequestMessageAndStage(request.id, request.newStage === 4 ? null : request.messageId, request.newStage)));
        newMessagesToPusher.forEach(message => {
            if (message.id && message.target) wamp.publish(message.target + '.message', [], message);
            logger.debug(`WORK REQUEST MESSAGE RESENT TO: ${message.target}`)
            //email.sendPusherMessage(message);
        });
    } catch (error) {
        logger.error(`WorkRequestJob:${error}`);
    }
};