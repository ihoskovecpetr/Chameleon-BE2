'use strict';

const logger = require('../logger');
const moment = require('moment');
const db = require('../dbData/mongoDb-pusher');

const pusherClient = require('../lib/pusherClient');

module.exports = {
    'pusher.ping': onPusherPing,
    'updatePusherData': updatePusherData,
    'projectsBudgetChanged': projectsBudgetChanged,
    'notifyOfferChanged': notifyOfferChanged
};

// *********************************************************************************************************************
// Pusher ping (store active client)
// *********************************************************************************************************************
function onPusherPing(args, kwargs, details) {
    pusherClient.clientPing(details.publisher, kwargs);
}

async function updatePusherData(args, kwargs) {
    logger.debug(`updatePusherData [${Object.keys(kwargs)}]`);
    //logger.debug(JSON.stringify(kwargs));
    const PUSHER_BOOKING_TIME_SPAN = db.getPusherBookingTimeSpan();
    const today = moment().startOf('day');// startDate on event is without TZ !!!!
    const nextDay = today.clone().add(PUSHER_BOOKING_TIME_SPAN, 'day');
    try {
        if(kwargs.resource) {
            if((kwargs.resource.current && kwargs.resource.current.type === 'OPERATOR' && (kwargs.resource.current.virtual || kwargs.resource.current.freelancer)) || (kwargs.resource.previous && kwargs.resource.previous.type === 'OPERATOR' && (kwargs.resource.previous.virtual || kwargsresource.previous.freelancer))) {
                const labelCurrent = kwargs.resource.current ? kwargs.resource.current.label : null;
                const labelPrevious = kwargs.resource.previous ? kwargs.resource.previous.label : null;
                const freelancerCurrent = kwargs.resource.current && (kwargs.resource.current.virtual || kwargs.resource.current.freelancer);
                const freelancerPrevious = kwargs.resource.previous && (kwargs.resource.previous.virtual || kwargs.resource.previous.freelancer);
                const confirmedCurrent = freelancerCurrent ? kwargs.resource.current.confirmed.map(confirmation => {
                    const from = moment(confirmation.from, 'YYYY-MM-DD').startOf('day');
                    const to = moment(confirmation.to, 'YYYY-MM-DD').startOf('day');
                    if(today.diff(to, 'days') > 0) return null;
                    else if(today.diff(from, 'days') > 0) return {from: today.clone(), to: to};
                    else return {from: from, to: to};
                }).filter(confirmation => confirmation !== null) : [];
                const confirmedPrevious = freelancerPrevious ? kwargs.resource.previous.confirmed.map(confirmation => {
                    const from = moment(confirmation.from, 'YYYY-MM-DD').startOf('day');
                    const to = moment(confirmation.to, 'YYYY-MM-DD').startOf('day');
                    if(today.diff(to, 'days') > 0) return null;
                    else if(today.diff(from, 'days') > 0) return {from: today.clone(), to: to};
                    else return {from: from, to: to};
                }).filter(confirmation => confirmation !== null) : [];

                const labelChanged = labelCurrent !== labelPrevious;
                const freelancerChanged = freelancerCurrent !== freelancerPrevious;
                const confirmedChanged = confirmedCurrent.length !== confirmedPrevious.length || confirmedCurrent.reduce((changed, confirmation, index) => {
                    if(!changed) {
                        if(confirmation.from.diff(confirmedPrevious[index].from, 'days') !== 0) return true;
                        else if(confirmation.to.diff(confirmedPrevious[index].to, 'days') !== 0) return true;
                        else return false;
                    } else return true;
                }, false);
                if(labelChanged || freelancerChanged || confirmedChanged) {
                    let notifyUsers = await db.getManagerSsoIdForResourceOfNotInternalProjects(kwargs.resource.id, today);
                    if(confirmedCurrent.length > 0 || confirmedPrevious.length > 0) {
                        const hr = await db.getHrNotifyManagers();
                        notifyUsers = notifyUsers.concat(hr).filter((id, index, self) => index === self.indexOf(id));
                    }
                    notifyPusherUsers(notifyUsers, 'freelancersupdate');
                }
            }
        }
        if(kwargs.joinSplitEvent) {
            //should not have impact on freelancers!!!
        }
        if(kwargs.event) {
            let currentIn = false;
            let previousIn = false;

            let currentInFuture = false;
            let previousInFuture = false;

            if (kwargs.event.current) {
                const currentEventStart = moment(kwargs.event.current.startDate, 'YYYY-MM-DD').startOf('day');
                const currentEventEnd = currentEventStart.clone().add(kwargs.event.current.days.length, 'day').startOf('day');
                currentIn = currentEventStart.isSameOrBefore(nextDay, 'day') && currentEventEnd.isAfter(today, 'day');
                currentInFuture = !kwargs.event.current.offtime && !kwargs.event.current.external && currentEventEnd.isAfter(today, 'day');
            }
            if (kwargs.event.previous) {
                const previousEventStart = moment(kwargs.event.previous.startDate, 'YYYY-MM-DD').startOf('day');
                const previousEventEnd = previousEventStart.clone().add(kwargs.event.previous.days.length, 'day').startOf('day');
                previousIn = previousEventStart.isSameOrBefore(nextDay, 'day') && previousEventEnd.isAfter(today, 'day');
                previousInFuture = !kwargs.event.previous.offtime && !kwargs.event.previous.external && previousEventEnd.isAfter(today, 'day');
            }
            if (currentIn || previousIn || currentInFuture || previousInFuture) {
                let projectIds = [];
                let operatorIds = [];

                if(kwargs.event.current && kwargs.event.current.project) projectIds.push(kwargs.event.current.project.toString());
                if(kwargs.event.current && kwargs.event.current.operator) operatorIds.push(kwargs.event.current.operator.toString());

                if(kwargs.event.previous && kwargs.event.previous.project) projectIds.push(kwargs.event.previous.project.toString());
                if(kwargs.event.previous && kwargs.event.previous.operator) operatorIds.push(kwargs.event.previous.operator.toString());

                projectIds = projectIds.filter((id, index, self) => index === self.indexOf(id));
                operatorIds = operatorIds.filter((id, index, self) => index === self.indexOf(id));

                if (currentIn || previousIn) {
                    let notifyUsersEvent = await db.getUsersForProjectId(projectIds);
                    let operators = await db.getSsoIdForResourceId(operatorIds);
                    notifyUsersEvent = notifyUsersEvent.concat(operators);
                    notifyUsersEvent = notifyUsersEvent.filter((id, index, self) => index === self.indexOf(id));
                    notifyPusherUsers(notifyUsersEvent, ['workupdate', 'bookingupdate', 'tasksupdate']);
                }
                if((currentInFuture || previousInFuture) && await db.isAnyOperatorFreelancer(operatorIds)) {
                    let eventStartCurrent = kwargs.event.current ? moment(kwargs.event.current.startDate, 'YYYY-MM-DD').startOf('day') : null;
                    if(eventStartCurrent !== null && eventStartCurrent.diff(today, 'days') < 0) eventStartCurrent = today.clone();
                    let eventStartPrevious = kwargs.event.previous ? moment(kwargs.event.previous.startDate, 'YYYY-MM-DD').startOf('day') : null;
                    if(eventStartPrevious !== null && eventStartPrevious.diff(today, 'days') < 0) eventStartPrevious = today.clone();
                    const eventStartChanged = !kwargs.event.current || !kwargs.event.previous || eventStartCurrent.diff(eventStartPrevious, 'days') !== 0;
                    const eventEndCurrent = kwargs.event.current ? moment(kwargs.event.current.startDate, 'YYYY-MM-DD').startOf('day').add(kwargs.event.current.days.length, 'days') : null;
                    const eventEndPrevious = kwargs.event.previous ? moment(kwargs.event.previous.startDate, 'YYYY-MM-DD').startOf('day').add(kwargs.event.previous.days.length, 'days') : null;
                    const eventEndChanged = !kwargs.event.current || !kwargs.event.previous || eventEndCurrent.diff(eventEndPrevious) !== 0;
                    const eventActiveDaysChanged = !kwargs.event.current || !kwargs.event.previous || kwargs.event.current.days.filter((day, i) => moment(kwargs.event.current.startDate, 'YYYY-MM-DD').add(i, 'day').diff(today, 'days') >= 0 && day.duration > 0).length !== kwargs.event.previous.days.filter((day, i) => moment(kwargs.event.previous.startDate, 'YYYY-MM-DD').add(i, 'day').diff(today, 'days') >= 0 &&  day.duration > 0).length;
                    const projectChanged = !kwargs.event.current || !kwargs.event.previous || kwargs.event.current.project != kwargs.event.previous.project;
                    const operatorChanged = !kwargs.event.current || !kwargs.event.previous || kwargs.event.current.operator != kwargs.event.previous.operator;
                    if(eventStartChanged || eventEndChanged || eventActiveDaysChanged || projectChanged || operatorChanged) {
                        const managers = await db.getManagerSsoIdOfNotInternalProjects(projectIds);
                        const hr = await db.getHrNotifyManagers();
                        const toNotify = managers.concat(hr).filter((id, index, self) => index === self.indexOf(id));
                        notifyPusherUsers(toNotify, 'freelancersupdate');
                    }
                }
            }
        }
        if(kwargs.project) {
            const managerCurrent = kwargs.project.current && kwargs.project.current.manager ? kwargs.project.current.manager.toString() : null;
            const supervisorCurrent = kwargs.project.current && kwargs.project.current.supervisor ? kwargs.project.current.supervisor.toString() : null;
            const lead2DCurrent = kwargs.project.current && kwargs.project.current.lead2D ? kwargs.project.current.lead2D.toString() : null;
            const lead3DCurrent = kwargs.project.current && kwargs.project.current.lead3D ? kwargs.project.current.lead3D.toString() : null;
            const leadMPCurrent = kwargs.project.current && kwargs.project.current.leadMP ? kwargs.project.current.leadMP.toString() : null;
            const producerCurrent = kwargs.project.current && kwargs.project.current.producer ? kwargs.project.current.producer.toString() : null;

            const managerPrevious = kwargs.project.previous && kwargs.project.previous.manager ? kwargs.project.previous.manager.toString() : null;
            const supervisorPrevious = kwargs.project.previous && kwargs.project.previous.supervisor ? kwargs.project.previous.supervisor.toString() : null;
            const lead2DPrevious = kwargs.project.previous && kwargs.project.previous.lead2D ? kwargs.project.previous.lead2D.toString() : null;
            const lead3DPrevious = kwargs.project.previous && kwargs.project.previous.lead3D ? kwargs.project.previous.lead3D.toString() : null;
            const leadMPPrevious = kwargs.project.previous && kwargs.project.previous.leadMP ? kwargs.project.previous.leadMP.toString() : null;
            const producerPrevious = kwargs.project.previous && kwargs.project.previous.producer ? kwargs.project.previous.producer.toString() : null;

            const confirmedCurrent = kwargs.project.current ? kwargs.project.current.confirmed : null;
            const confirmedPrevious = kwargs.project.previous ? kwargs.project.previous.confirmed : null;

            const internalCurrent = kwargs.project.current ? kwargs.project.current.internal : null;
            const internalPrevious = kwargs.project.previous ? kwargs.project.previous.internal : null;

            const timingCurrent = kwargs.project.current && kwargs.project.current.timing ? kwargs.project.current.timing.filter(timing => timingFilter(timing, today, nextDay)) : [];
            const timingPrevious = kwargs.project.previous && kwargs.project.previous.timing ? kwargs.project.previous.timing.filter(timing => timingFilter(timing, today, nextDay)) : [];

            const labelCurrent = kwargs.project.current && kwargs.project.current.label ? kwargs.project.current.label : null;
            const labelPrevious = kwargs.project.previous && kwargs.project.previous.label ? kwargs.project.previous.label : null;

            if(labelCurrent !== labelPrevious || internalCurrent !== internalPrevious || managerCurrent !== managerPrevious) {
                if(await db.hasProjectBookedFreelancer(kwargs.project.id, today)) {
                    let usersToNotify = await db.getSsoIdsForUsers([managerCurrent, managerPrevious].filter(manager => manager !== null).filter((manager, index, self) => self.indexOf(manager) === index));
                    if (internalCurrent !== internalPrevious) {
                        const hr = await db.getHrNotifyManagers();
                        usersToNotify = usersToNotify.concat(hr);
                    }
                    if (usersToNotify && usersToNotify.length > 0) {
                        notifyPusherUsers(usersToNotify, 'freelancersupdate');
                    }
                }
            }

            let timingHasBeenChanged = false;
            let projectUsersHasBeenChanged = false;
            let projectLabelOrConfirmationOrInternalHasBeenChanged = false;

            if(timingCurrent.length === timingPrevious.length) {
                for(let i = 0; i < timingCurrent.length; i++) {
                    if(!timingHasBeenChanged) timingHasBeenChanged = timingCurrent[i].category !== timingPrevious[i].category || timingCurrent[i].type !== timingPrevious[i].type || timingCurrent[i].text !== timingPrevious[i].text || !moment(timingCurrent[i].date, 'YYYY-MM-DD').isSame(moment(timingPrevious[i].date, 'YYYY-MM-DD'), 'day')
                }
            } else timingHasBeenChanged = true;

            if (labelCurrent !== labelPrevious || confirmedCurrent !== confirmedPrevious || internalCurrent !== internalPrevious) projectLabelOrConfirmationOrInternalHasBeenChanged = true;
            if (managerCurrent !== managerPrevious) projectUsersHasBeenChanged = true;
            if (supervisorCurrent !== supervisorPrevious) projectUsersHasBeenChanged = true;
            if (lead2DCurrent !== lead2DPrevious) projectUsersHasBeenChanged = true;
            if (lead3DCurrent !== lead3DPrevious) projectUsersHasBeenChanged = true;
            if (leadMPCurrent !== leadMPPrevious) projectUsersHasBeenChanged = true;
            if (producerCurrent !== producerPrevious) projectUsersHasBeenChanged = true;

            if (projectUsersHasBeenChanged || projectLabelOrConfirmationOrInternalHasBeenChanged || timingHasBeenChanged) {
                const notifyProjectUsersId = [];
                if(timingHasBeenChanged || projectLabelOrConfirmationOrInternalHasBeenChanged) notifyProjectUsersId.push(managerCurrent, supervisorCurrent, lead2DCurrent, lead3DCurrent, leadMPCurrent, producerCurrent, managerPrevious, supervisorPrevious, lead2DPrevious, lead3DPrevious, leadMPPrevious, producerPrevious);
                if(managerCurrent !== managerPrevious) notifyProjectUsersId.push(managerCurrent, managerPrevious);
                if(supervisorCurrent !== supervisorPrevious) notifyProjectUsersId.push(supervisorCurrent, supervisorPrevious);
                if(lead2DCurrent !== lead2DPrevious) notifyProjectUsersId.push(lead2DCurrent, lead2DPrevious);
                if(lead3DCurrent !== lead3DPrevious) notifyProjectUsersId.push(lead3DCurrent, lead3DPrevious);
                if(leadMPCurrent !== leadMPPrevious) notifyProjectUsersId.push(leadMPCurrent, leadMPPrevious);
                if(producerCurrent !== producerPrevious) notifyProjectUsersId.push(producerCurrent, producerPrevious);

                const tasks = await db.getTasks(kwargs.project.id);
                tasks.forEach(task => {
                    if (task.target) notifyProjectUsersId.push(task.target.toString());
                });
                let usersToNotify = await db.getSsoIdsForUsers(notifyProjectUsersId.filter((id, index, self) => !!id && index === self.indexOf(id)));

                if(projectLabelOrConfirmationOrInternalHasBeenChanged || projectUsersHasBeenChanged) {
                    const events = await db.getEventsForProject(kwargs.project.id);
                    const operators = events.filter(event => { //filter project events for region today+, map to operator ids, remove null and duplicated
                        const eventStart = moment(event.startDate, 'YYYY-MM-DD').startOf('day');
                        const eventEnd = eventStart.clone().add(event.days.length, 'day').startOf('day');
                        return eventStart.isSameOrBefore(nextDay, 'day') && eventEnd.isAfter(today, 'day');
                    }).map(event => event.operator ? event.operator.toString() : null).filter((id, index, self) => !!id && index === self.indexOf(id));
                    const operatorsIds = await db.getSsoIdForResourceId(operators);
                    usersToNotify = usersToNotify.concat(operatorsIds).filter((id, index, self) => !!id && index === self.indexOf(id));
                }
                notifyPusherUsers(usersToNotify, ['workupdate', 'bookingupdate', 'tasksupdate']);
            }
        }
    } catch(e) {
        logger.warn('updatePusherData error: ' + e)
    }
}

async function projectsBudgetChanged(args, kwargs) { //From project changes
    logger.debug(`projectsBudgetChanged`);
    const previous = kwargs.previous && kwargs.previous.budget && kwargs.previous.budget !== '000000000000000000000000' ? {project: {id: kwargs.previous.id, label: kwargs.previous.label}, budget: kwargs.previous.budget, price: await db.getBudgetPrice(kwargs.previous.budget)} : null;
    const current = kwargs.current   && kwargs.current.budget  && kwargs.current.budget  !== '000000000000000000000000' ? {project: {id: kwargs.current.id,  label: kwargs.current.label},  budget: kwargs.current.budget,  price: await db.getBudgetPrice(kwargs.current.budget)}  : null;
    await notifyOfferChanged([], {previous: previous, current: current});
}

async function notifyOfferChanged(args, kwargs) { //Called from above projectBudgetChanged() OR from Budget rest-api
    logger.debug(`notifyOfferChanged`);
    const message = {
        type: 'TODAY',
        label: `Budget`,
        message: '',
        target: {role: 'booking:main-producer'},
        deadline: moment().startOf('day'),
        details: ''
    };

    if(kwargs.previous && kwargs.current && (kwargs.previous.project.id === kwargs.current.project.id)) { //offer changed?
        if(Math.abs((kwargs.previous.price.percent - kwargs.current.price.percent)) >= 1) { //offer changed! diff >= 1%
            message.message = `Project '${kwargs.previous.project.label}'. Offer has been changed`;
            message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}${kwargs.previous.price.price !== kwargs.current.price.price || kwargs.previous.price.currency !== kwargs.current.price.currency ? ` -> ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}` : ''}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}${kwargs.previous.price.offer !== kwargs.current.price.offer || kwargs.previous.price.currency !== kwargs.current.price.currency ? ` -> ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}` : ''}\nDiscount: ${percentString(kwargs.previous.price.percent)} -> ${percentString(kwargs.current.price.percent)}`;
        }
    } else { // linked, unlinked or both
        if(kwargs.previous && kwargs.previous.price && kwargs.previous.price.offer) {
            message.message = `Project '${kwargs.previous.project.label}' was unlinked from budget with offer.`;
            message.details = `Budget: ${priceString(kwargs.previous.price.price, kwargs.previous.price.currency)}\nOffer: ${offerString(kwargs.previous.price.offer, kwargs.previous.price.currency)}\nDiscount: ${percentString(kwargs.previous.price.percent)}`;
        }
        if(kwargs.current && kwargs.current.price && kwargs.current.price.offer) {
            message.message = `Project '${kwargs.current.project.label}' was linked to budget with offer.`;
            message.details = `Budget: ${priceString(kwargs.current.price.price, kwargs.current.price.currency)}\nOffer: ${offerString(kwargs.current.price.offer, kwargs.current.price.currency)}\nDiscount: ${percentString(kwargs.current.price.percent)}`;
        }
    }

    if(message.message) {
        //logger.debug(`\n${message.message}\n${message.details}`);
        db.addMessage(message)
            .then(newMessages => {
                if(newMessages && newMessages.length > 0) {
                    newMessages.forEach(message => {
                        if (message.target) session.publish(message.target + '.message', [], message);
                    });
                    //email.sendPusherMessage(message);
                }
            })
    }
}

function notifyPusherUsers(users, topics) {
    try {
        if (!users || !topics || (Array.isArray(users) && users.length === 0) || (Array.isArray(topics) && topics.length === 0)) return;
        if (!Array.isArray(users)) users = [users];
        if (!Array.isArray(topics)) topics = [topics];
        users = users.filter((user, index, self) => index === self.indexOf(user));
        const updatedUsers = [];
        const pusherClients = pusherClient.getClients();
        Object.keys(pusherClients).forEach(client => {
            if (users.indexOf(pusherClients[client].user) >= 0 && updatedUsers.indexOf(pusherClients[client].user) < 0) {
                updatedUsers.push(pusherClients[client].user);
            }
        });
        logger.debug(`notifyPusherUsers "${topics.join(', ')}" to users: ${users.join(', ')}`);
        if (updatedUsers.length > 0) {
            updatedUsers.forEach(user => {
                topics.forEach(topic => {
                    session.publish(`${user}.${topic}`);
                    logger.debug(`wamp publish - ${user}.${topic}`);
                });
            });
        }

    } catch(e) {logger.warn(`notifyPusherUsers "${topics.join(', ')}" to users: ${users.join(', ')}. Error: ${e}`)}
}


function percentString(amount) {
    if(!amount) amount = '0';
    return `${amount}%`;
}

function priceString(amount, unit) {
    return `${numberFormat(amount)} ${unit.toUpperCase()}`;
}

function offerString(amount, unit) {
    if(amount) {
        amount = numberFormat(amount);
        return `${amount} ${unit.toUpperCase()}`;
    } else {
        return 'no offer';
    }
}

function numberFormat(value) {
    const rx= /(\d+)(\d{3})/;
    return String(value).replace(/\d+/, w => {
        while(rx.test(w)){
            w = w.replace(rx, '$1 $2');
        }
        return w;
    });
}

function timingFilter(timing, today, nextDay) {
    const timingDate = moment(timing.date, 'YYYY-MM-DD');
    return timingDate.isSameOrAfter(today, 'day') && timingDate.isSameOrBefore(nextDay, 'day');
}