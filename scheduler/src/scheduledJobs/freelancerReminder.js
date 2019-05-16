'use strict';

const logger = require('../logger');
const wamp = require('../wamp');
const db = require('../dbData/mongoDbData');
const dateHelper = require('../lib/dateHelper');
const moment = require('moment');

module.exports = async () => {
    logger.debug('Freelancer Reminder Job Fired');
    try {
        if(dateHelper.isWorkingDay(new Date())) {
            const users = await db.getManagersWithFreelancers();
            const messages = [];
            if(users && users.managers.length > 0) {
                messages.push({
                    type: 'REMINDER',
                    label: `REMINDER - Not Confirmed Freelancers.`,
                    details: 'freelancer-unconfirmed',
                    target: users.managers,
                    deadline: moment()
                })
            }
            if(users && users.hr.length > 0) {
                messages.push({
                    type: 'REMINDER',
                    label: `REMINDER - Confirmed Freelancers without Task.`,
                    details: 'freelancer-confirmed',
                    target: users.hr,
                    deadline: moment()
                })
            }
            if(messages.length > 0) {
                const newMessages = await Promise.all(messages.map(db.addMessage));
                const newMessagesToPusher = [];
                newMessages.forEach(messageArray => {
                    messageArray.forEach((message, index) => {
                        newMessagesToPusher.push(message);
                    });
                });
                newMessagesToPusher.forEach(message => {
                    if (message.id && message.target) wamp.publish(message.target + '.message', [], message);
                    //email.sendPusherMessage(message);
                });
            }
        }
    } catch (error) {
        logger.error(`FreelancerReminderJob:${error}`);
    }
};
