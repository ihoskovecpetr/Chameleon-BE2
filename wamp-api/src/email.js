const email = require('emailjs');
const logger = require('./logger');
require('mongoose');
const moment = require('moment');
const dataHelper = require('../_common/lib/dataHelper');
const User = require('../_common/models/user');

const mailServer = email.server.connect({
    user:     process.env['MAIL_USER'],
    password: process.env['MAIL_PASSWORD'],
    host:     process.env['MAIL_SERVER']
});

const DEBUG_EMAIL = process.env['PUSHER_MESSAGE_DEBUG_EMAIL'];

module.exports = {
    sendPusherMessage: sendPusherMessage
};

async function sendPusherMessage(message) {
    const users = await getUsers();
    const origin = message.origin && users[message.origin] && users[message.origin].email ? {email: users[message.origin].email, name: users[message.origin].name} : null;
    const targets = message.target.filter(target => users[target] && users[target].email).map(target => {return {email: users[target].email, name: users[target].name}});
    const targetsList = message.target.reduce((list, user, index) => `${list}${index > 0 ? ', ': ''}${users[user].name}`, '');
    const originName = message.origin && users[message.origin] && users[message.origin].name ? users[message.origin].name : 'Unknown User';
    let messageType = '';
    switch(message.type) {
        case 'NOW':
            messageType = `Read now (${moment().format('DD/MM HH:mm')})`;
            break;
        case 'TODAY':
            messageType = `Read today (${moment().format('DD/MM')})`;
            break;
        case 'NORMAL':
            messageType = `Read till (${moment(message.deadline).format('DD/MM')})`;
            break;
    }
    const debugTo = DEBUG_EMAIL ? `<${DEBUG_EMAIL}>` : null;
    if(origin) {
        const originTo = `${origin.name} <${origin.email}>`;
        sendEmail({
            from: `Pusher <noreply@upp.cz>`,
            to: debugTo ? debugTo : originTo,
            subject: `Message you sent via Pusher`,
            text: `You sent a message via Pusher:\n\n${message.message}\n\nTo following user${message.target.length > 1 ? 's':''}: ${targetsList}\n\nMessage type: ${messageType}${debugTo ? `\n\nDebug email, original recipients: ${originTo}` : ''}`
        });
    }
    if(targets.length > 0) {
        const targetTo = targets.reduce((to, target, index) => `${to}${index > 0 ? ', ' : ''}${target.name} <${target.email}>`, '');
        sendEmail({
            from: `Pusher on behalf of ${originName} ${origin ? origin.email : '<noreply@upp.cz>'}`,
            to: debugTo ? debugTo : targetTo,
            subject: `Pusher message sent by ${originName}`,
            text: `${originName} sent you a message via Pusher:\n\n${message.message}\n\nMessage type: ${messageType}${debugTo ? `\n\nDebug email, original recipients: ${targetTo}` : ''}`
        });
    }
}

function sendEmail(options) {
    mailServer.send(options, err => {
        if(err) logger.warn(`Error during email send: ${err}`);
    });
    //logger.debug(JSON.stringify(options));
}

async function getUsers() {
    const users = await User.find({}, {__v: false}).lean();
    return dataHelper.getObjectOfNormalizedDocs(users);
}

