'use strict';
exports = module.exports;

exports.dateString = date => {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    return `${date.getFullYear()}-${date.getMonth() >= 9 ? date.getMonth() + 1 : `0${date.getMonth() + 1}`}-${date.getDate() >= 10 ? date.getDate() : `0${date.getDate()}`}`;
};