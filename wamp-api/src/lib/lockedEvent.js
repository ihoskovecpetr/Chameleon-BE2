'use strict';

const wamp = require('../wamp');

let lockedEvents = [];
const LOCK_VALID_TIME = 1000;

setInterval(checkLockedEvents, LOCK_VALID_TIME + 500);

module.exports = {
    lockEvent: lockEvent,
    releaseEvent: releaseEvent,
    getLockedEvents: getLockedEvents
};

function lockEvent(id, publisher) {
    const index = lockedEvents.findIndex(event => event.id === id);
    if(index < 0) {
        lockedEvents.push({timestamp: +new Date, id: id});
        wamp.publish('lockedEventsChanged', lockedEvents.map(item => item.id), {}, {exclude : [publisher]});
    } else {
        lockedEvents[index].timestamp = +new Date;
    }
}

function releaseEvent(id, publisher) {
    const index = lockedEvents.findIndex(event => event.id === id);
    if(index >= 0) {
        lockedEvents.splice(index, 1);
        wamp.publish('lockedEventsChanged', lockedEvents.map(item => item.id), {}, {exclude : [publisher]});
    }
}

function getLockedEvents() {
    return lockedEvents.map(event => event.id);
}

function checkLockedEvents() {
    if(lockedEvents.length === 0) return;
    const timeStamp = +new Date;
    const length = lockedEvents.length;
    lockedEvents = lockedEvents.filter(item => (timeStamp - item.timestamp) <= LOCK_VALID_TIME);
    if(lockedEvents.length < length) session.publish('lockedEventsChanged', lockedEvents.map(item => item.id));
}