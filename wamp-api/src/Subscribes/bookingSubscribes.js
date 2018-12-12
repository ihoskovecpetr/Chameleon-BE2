'use strict';

const db = require('../dbData/mongoDb-booking');
const wamp = require('../wamp');

module.exports = {
    'lockEvent': lockEvent,
    'releaseEvent': releaseEvent
};

let lockedEvents = [];

//TODO checkLocked timer + heartbeat timer => to special module

function lockEvent(args, kwargs, details) {
    const index = getIndexOfLockedEvent(args[0]);
    if(index < 0) {
        lockedEvents.push({timestamp: +new Date, id: args[0]});
        wamp.publish('lockedEventsChanged', lockedEvents.map(item => item.id), {}, {exclude : [details.publisher]});
    } else {
        lockedEvents[index].timestamp = +new Date;
    }
}

function releaseEvent(args, kwargs, details) {
    const index = getIndexOfLockedEvent(args[0]);
    if(index >= 0) {
        lockedEvents.splice(index, 1);
        wamp.publish('lockedEventsChanged', lockedEvents.map(item => item.id), {}, {exclude : [details.publisher]});
    }
}

function getIndexOfLockedEvent(id) {
    if(lockedEvents.length === 0) return -1;
    for(let i = 0; i < lockedEvents.length; i++) {
        if(lockedEvents[i].id == id) return i;
    }
    return -1;
}

function checkLockedEvents() {
    if(lockedEvents.length === 0) return;
    const timeStamp = +new Date;
    const length = lockedEvents.length;
    lockedEvents = lockedEvents.filter(item => (timeStamp - item.timestamp) <= LOCK_VALID_TIME);
    if(lockedEvents.length < length) wamp.publish('lockedEventsChanged', lockedEvents.map(item => item.id));
}

