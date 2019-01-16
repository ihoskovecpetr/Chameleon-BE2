'use strict';

const db = require('../dbData/mongoDb-pusher');

module.exports = {
    'get_info_pusher': db.getInfo,
    'get_info_pusher2': db.getInfo
};