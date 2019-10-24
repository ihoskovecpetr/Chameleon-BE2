'use strict';

const projectToBooking = require('../_common/lib/projectToBooking');
//const logger = require('./logger');

module.exports = function(updateData, bookingData)  {
    if(updateData.booking === undefined && updateData.bookingId === undefined) { //just test if regular update
        const bookingUpdate = projectToBooking(updateData, true);
        if(bookingUpdate.budget !== undefined) {
            const bookingBudget = bookingData && bookingData.budget ? bookingData.budget : null;
            const projectBudget = bookingUpdate && bookingUpdate.budget ? bookingUpdate.budget : null;
            if (bookingBudget === projectBudget) delete bookingUpdate.budget;
        }
        for(const key in bookingUpdate) if(bookingUpdate[key] === undefined) delete bookingUpdate[key];
        if(Object.keys(bookingUpdate).length > 0) return 'update';
    } else if(updateData.bookingId === undefined) { // booking flag changed without linked booking data -> just add or remove project to booking
        return updateData.booking ? 'add' : 'remove';
    } else if(updateData.bookingId) { // must be - remove link is not possible
        return updateData.booking ? 'exchange' : 'remove';
    }
};