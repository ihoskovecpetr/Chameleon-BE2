'use strict';
exports = module.exports;

const PUBLIC_HOLIDAYS = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'];  //MM-DD

exports.dateString = date => {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    return `${date.getFullYear()}-${date.getMonth() >= 9 ? date.getMonth() + 1 : `0${date.getMonth() + 1}`}-${date.getDate() >= 10 ? date.getDate() : `0${date.getDate()}`}`;
};

exports.isWorkingDay = date => {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    return !isWeekend(date) && !isHoliday(date);
};

exports.isFreeDay = date => {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    return isWeekend(date) || isHoliday(date);
};

exports.isWeekend = date => {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    return isWeekend(date);
};

exports.isHoliday = date => {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    return isHoliday(date);
};

exports.isFutureEventDay = (startDate, index, countToday) => {
    const date = addDay(startDate, index);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if(countToday) return date >= today;
    else return date > today;
};

// *=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*

function getEasterForYear(year) { //SUNDAY
    const a = (year / 100 | 0) * 1483 - (year / 400 | 0) * 2225 + 2613;
    const b = ((year % 19 * 3510 + (a / 25 | 0) * 319) / 330 | 0) % 29;
    const c = 148 - b - ((year * 5 / 4 | 0) + a - b) % 7;
    return new Date(year,  (c / 31 | 0) - 1, c % 31 + 1, 0);
}

function getEasterFridayForYear(year) {
    const easter = getEasterForYear(year);
    addDay(easter, -2);
    return easter;
}

function getEasterMondayForYear(year) {
    const easter = getEasterForYear(year);
    addDay(easter, 1);
    return easter;
}

function addDay(date, numOfDays) {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    const ms = date.getMilliseconds();
    date.setDate(date.getDate() + Number(numOfDays));
    date.setHours(h, m, s, ms);
    return date;
}

function isWeekend(date) {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    const dayOfWeek = date.getDay();
    return dayOfWeek === 6 || dayOfWeek === 0;
}

function isHoliday(date) {
    if(typeof date === 'string') {
        date = new Date(date);
        date.setHours(0, 0, 0, 0);
    }
    const easterFridayString = exports.dateString(getEasterFridayForYear(date.getFullYear()));
    const easterMondayString = exports.dateString(getEasterMondayForYear(date.getFullYear()));
    const dString = exports.dateString(date);
    const dateStringShort = dString.substring(5);
    return dString === easterFridayString || dString === easterMondayString || PUBLIC_HOLIDAYS.indexOf(dateStringShort) >= 0;
}


