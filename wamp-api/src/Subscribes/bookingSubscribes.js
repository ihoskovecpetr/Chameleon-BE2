'use strict';

const lockedEvent = require('../lib/lockedEvent');

module.exports = {
    'lockEvent': lockEvent,
    'releaseEvent': releaseEvent
};

function lockEvent(args, kwargs, details) {
    lockedEvent.lockEvent(args[0], details.publisher);
}

function releaseEvent(args, kwargs, details) {
    lockedEvent.releaseEvent(args[0], details.publisher);
}

