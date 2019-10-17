const Excel = require('exceljs');
const Color = require('color');
const moment = require('moment');

const Dates = require('../_common/lib/dateHelper');

const ROW_HEIGHT = 42;
const COLUMN_WIDTH = 27;

const TIME_HEADER_ROW = 1;
const FIRST_RESOURCE_ROW = TIME_HEADER_ROW + 2;
const GROUP_HEADER_COLUMN = 1;

const FONT_NAME = "Arial";
const GROUPS_FONT_SIZE = 10;
const CELL_FONT_SIZE = 8;

const EXTRA_BORDER_TYPE = 'medium';
const BORDER_TYPE = 'thin';

const BORDER = {
    top: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    bottom: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    left: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    right: {style:BORDER_TYPE, color: {argb:"FF000000"}}
};

const BORDER_TOP = {
    top: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}},
    bottom: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    left: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    right: {style:BORDER_TYPE, color: {argb:"FF000000"}}
};

const BORDER_BOTTOM = {
    top: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    bottom: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}},
    left: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    right: {style:BORDER_TYPE, color: {argb:"FF000000"}}
};

const BORDER_TOP_BOTTOM = {
    top: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}},
    bottom: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}},
    left: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    right: {style:BORDER_TYPE, color: {argb:"FF000000"}}
};

const BORDER_TOP_RIGHT = {
    top: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    bottom: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}},
    left: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    right: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}}
};

const BORDER_TOP_BOTTOM_RIGHT = {
    top: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    bottom: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}},
    left: {style:BORDER_TYPE, color: {argb:"FF000000"}},
    right: {style:EXTRA_BORDER_TYPE, color: {argb:"FF000000"}}
};

module.exports = async (path, data) => {
    const timestamp = moment(new Date(data.timestamp));

    const groups = data.data.groups;
    const resources = data.data.resources;
    const projects = data.data.projects;
    const events = data.data.events;

    const workbook = new Excel.Workbook();

    workbook.creator = "Booking data export";
    workbook.lastModifiedBy = "Booking data export";
    workbook.created = new Date();
    workbook.modified = new Date();

    const wsOperators = workbook.addWorksheet("Booking operators");
    const wsFacilities = workbook.addWorksheet("Booking facilities");

    // TIME HEADER
    let firstDate = null;
    let lastDate = null;

    const minFirstDate = moment().startOf('day').add(-7, 'days');

    for(const eventId in events) {
        if(events.hasOwnProperty(eventId)) {
            const first = moment(events[eventId].startDate,'YYYY-MM-DD');
            const last = moment(events[eventId].startDate,'YYYY-MM-DD').add(events[eventId].days.length - 1,"days");
            if(last.isBefore(minFirstDate)) {
                delete events[eventId];
            } else if(first.isBefore(minFirstDate)) {
                const offset = minFirstDate.diff(first,'days');
                events[eventId].startDate = minFirstDate.format('YYYY-MM-DD');
                events[eventId].days = events[eventId].days.slice(offset);
                firstDate = minFirstDate;
                if(lastDate == null || last.isAfter(lastDate)) lastDate = last;
            } else {
                if(firstDate == null || first.isBefore(firstDate)) firstDate = first;
                if(lastDate == null || last.isAfter(lastDate)) lastDate = last;
            }
        }
    }

    const numOfDays = lastDate.diff(firstDate,'days') + 1;
    // GROUP + RESOURCE HEADER
    const groupsOperators = [];
    const groupsFacilities = [];

    for(const groupId in groups) {
        if(groups.hasOwnProperty(groupId)) {
            const group = groups[groupId];
            group.id = groupId;
            for(let memberIndex = 0; memberIndex < group.members.length; memberIndex++) {
                if(resources[group.members[memberIndex]].deleted || resources[group.members[memberIndex]].disabled) {
                    group.members.splice(memberIndex,1);
                    memberIndex--;
                }
            }
            if(group.type === 'OPERATOR') {
                if(group.members.length > 0) groupsOperators.push(group);
            } else {
                if(group.members.length > 0) groupsFacilities.push(group);
            }
        }
    }

    groupsOperators.sort(function(a, b) { return a.order - b.order; });
    groupsFacilities.sort(function(a, b) { return a.order - b.order; });

    drawTopLeft(wsOperators, "OPERATORS", timestamp);
    drawTopLeft(wsFacilities, "FACILITIES", timestamp);

    drawGroupsHeader(wsOperators, groupsOperators, resources, events);
    drawGroupsHeader(wsFacilities, groupsFacilities, resources, events);

    drawTimeHeader(wsOperators, firstDate, numOfDays);
    drawTimeHeader(wsFacilities, firstDate, numOfDays);

    drawGrid(wsOperators, groupsOperators, firstDate, numOfDays, resources);
    drawGrid(wsFacilities, groupsFacilities, firstDate, numOfDays, resources);

    drawEvents(wsOperators, resources, projects, "OPERATOR", firstDate);
    drawEvents(wsFacilities, resources, projects, "FACILITY", firstDate);

    await workbook.xlsx.writeFile(path);
};

//**********************************************************************************************************************
function drawTopLeft(ws, type, date) {
    const timestamp = date.format('DD.MM.YYYY - HH:mm');
    ws.mergeCells(column(GROUP_HEADER_COLUMN) + TIME_HEADER_ROW + ":" + column(GROUP_HEADER_COLUMN + 1) + (TIME_HEADER_ROW + 1));
    const topLeftCell = ws.getCell(column(GROUP_HEADER_COLUMN) + TIME_HEADER_ROW);
    topLeftCell.alignment = {vertical: "middle", horizontal: "center", wrapText: true };
    topLeftCell.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: "FF000000"}};
    topLeftCell.fill = {type: "pattern", pattern:"solid", fgColor:{argb: "FF999999"}};
    topLeftCell.border = BORDER_TOP_BOTTOM_RIGHT;
    topLeftCell.value = "BOOKING from: " + timestamp + String.fromCharCode(10) + type + String.fromCharCode(10) + '(* unconfirmed, ~ internal)';

}
//----------------------------------------------------------------------------------------------------------------------
function drawGroupsHeader(ws, group, resources, events) {
    let groupRow = 0;
    ws.getColumn(GROUP_HEADER_COLUMN).width = 5;
    ws.getColumn(GROUP_HEADER_COLUMN + 1).width = 36;

    for(let i = 0; i < group.length; i++) {
        const groupHeader = ws.getCell(column(GROUP_HEADER_COLUMN) + (FIRST_RESOURCE_ROW + groupRow));
        groupHeader.value = group[i].label;
        groupHeader.alignment = {vertical: "middle", horizontal: "center", textRotation: 90};
        groupHeader.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: "FF000000"}};
        groupHeader.fill = {type: "pattern", pattern:"solid", fgColor:{argb:"FFBBBBBB"}};
        if(i === group.length - 1) groupHeader.border = BORDER_TOP_BOTTOM_RIGHT;
        else groupHeader.border = BORDER_TOP_RIGHT;

        let extraRows = 0;
        for(let j= 0; j < group[i].members.length; j++) {
            resources[group[i].members[j]].row = groupRow + j + extraRows;
            resources[group[i].members[j]].id = group[i].members[j];

            setResourceEvents(events, resources[group[i].members[j]]);

            const groupResource = ws.getCell(column(GROUP_HEADER_COLUMN + 1) + (FIRST_RESOURCE_ROW + groupRow + j + extraRows));
            const resourceColor = resources[group[i].members[j]].color;
            const backgroundColor = "FF" + resourceColor.substring(1).toUpperCase();
            const foregroundColor = Color(resourceColor).isDark() ? "FFFFFFFF" : "FF000000";
            groupResource.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: foregroundColor}};
            groupResource.alignment = {vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
            const pairLabel = resources[group[i].members[j]].pair != null ? String.fromCharCode(10) + '[' + resources[resources[group[i].members[j]].pair ].label + ']' : '';
            groupResource.value = resources[group[i].members[j]].label + pairLabel;

            if(j === group[i].members.length - 1) groupResource.border = BORDER_TOP_BOTTOM_RIGHT;
            else groupResource.border = BORDER_TOP_RIGHT;

            groupResource.fill = {type: "pattern", pattern:"solid", fgColor: {argb: backgroundColor}};
            for(let k = 0; k < resources[group[i].members[j]].rows; k++) ws.getRow(FIRST_RESOURCE_ROW + groupRow + extraRows + j + k).height = ROW_HEIGHT;
            if(resources[group[i].members[j]].rows > 1) {
                ws.mergeCells(column(GROUP_HEADER_COLUMN + 1) + (FIRST_RESOURCE_ROW + groupRow + j + extraRows) + ':' + column(GROUP_HEADER_COLUMN + 1) + (FIRST_RESOURCE_ROW + groupRow + j + extraRows + resources[group[i].members[j]].rows - 1));
            }
            extraRows = extraRows + resources[group[i].members[j]].rows - 1;
        }
        ws.mergeCells(column(GROUP_HEADER_COLUMN) + (FIRST_RESOURCE_ROW + groupRow) + ':' + column(GROUP_HEADER_COLUMN) + (FIRST_RESOURCE_ROW + groupRow + extraRows + group[i].members.length - 1));
        groupRow += group[i].members.length + extraRows;
    }
}
//----------------------------------------------------------------------------------------------------------------------
function drawTimeHeader(ws, firstDate, numOfDays) {
    let firstGroupSize = 8 - firstDate.isoWeekday();
    if(firstGroupSize === 7) firstGroupSize = 0;
    const lastGroupSize = (numOfDays - firstGroupSize) % 7;
    let weekCell;
    if(firstGroupSize > 0) {
        ws.mergeCells(column(GROUP_HEADER_COLUMN + 2) + TIME_HEADER_ROW + ":" + column(GROUP_HEADER_COLUMN + 2 + firstGroupSize - 1) + TIME_HEADER_ROW);
        weekCell = ws.getCell(column(GROUP_HEADER_COLUMN + 2) + (TIME_HEADER_ROW));
        weekCell.alignment = {vertical: "middle", horizontal: "left", indent: 1};
        weekCell.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: "FF000000"}};
        weekCell.fill = {type: "pattern", pattern:"solid", fgColor:{argb: "FFBBBBBB"}};
        weekCell.border = BORDER;
        weekCell.value = getTimeGroupLabel(firstDate, firstGroupSize);
    }
    for(let i = 0; i < numOfDays; i++) {
        const day = firstDate.clone().add(i,'days');
        if(i >= firstGroupSize && i < numOfDays - firstGroupSize - lastGroupSize && (i - firstGroupSize) % 7 === 0) {
            ws.mergeCells(column(GROUP_HEADER_COLUMN + 2 + i) + TIME_HEADER_ROW + ":" + column(GROUP_HEADER_COLUMN + 2 + 6 + i) + TIME_HEADER_ROW);
            weekCell = ws.getCell(column(GROUP_HEADER_COLUMN + 2 + i) + (TIME_HEADER_ROW));
            weekCell.alignment = {vertical: "middle", horizontal: "left", indent: 1};
            weekCell.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: "FF000000"}};
            weekCell.fill = {type: "pattern", pattern:"solid", fgColor:{argb: "FFBBBBBB"}};
            weekCell.border = BORDER;
            weekCell.value = getTimeGroupLabel(day, 7);
        }
        const dateCell = ws.getCell(column(GROUP_HEADER_COLUMN + 2 + i) + (TIME_HEADER_ROW + 1));
        dateCell.value = day.format('ddd, D.M.');
        dateCell.alignment = {vertical: "middle", horizontal: "center"};
        dateCell.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: "FF000000"}};
        let dateColor = "FFD2D2D2";

        if(Dates.isWeekend(day.toDate())) dateColor = "FFEAF9EA"; // SATURDAY and SUNDAY
        else if(Dates.isHoliday(day.toDate())) dateColor = "FFEAEAF9"; // HOLIDAY

        dateCell.fill = {type: "pattern", pattern:"solid", fgColor:{argb: dateColor}};
        dateCell.border = BORDER;
        ws.getColumn(GROUP_HEADER_COLUMN + 2 + i).width = COLUMN_WIDTH;
    }
    if(lastGroupSize > 0) {
        const d = firstDate.clone().add(numOfDays - lastGroupSize, "days");
        ws.mergeCells(column(GROUP_HEADER_COLUMN + 2 + numOfDays - lastGroupSize) + TIME_HEADER_ROW + ":" + column(GROUP_HEADER_COLUMN + 2 + numOfDays - 1) + TIME_HEADER_ROW);
        weekCell = ws.getCell(column(GROUP_HEADER_COLUMN + 2 + numOfDays - lastGroupSize) + (TIME_HEADER_ROW));
        weekCell.alignment = {vertical: "middle", horizontal: "left", indent: 1};
        weekCell.font = {name: FONT_NAME, size: GROUPS_FONT_SIZE, color: {argb: "FF000000"}};
        weekCell.fill = {type: "pattern", pattern:"solid", fgColor:{argb: "FFBBBBBB"}};
        weekCell.border = BORDER;
        weekCell.value = getTimeGroupLabel(d, lastGroupSize);
    }
    ws.getRow(TIME_HEADER_ROW).height = 25;
    ws.getRow(TIME_HEADER_ROW + 1).height = 25;
}
//----------------------------------------------------------------------------------------------------------------------
function drawGrid(ws, group, firstDate, numOfDays, resources) {
    let groupRow = 0;
    for(let i = 0; i < group.length; i++) {
        let extraRows = 0;
        for(let j= 0; j < group[i].members.length; j++) {
            const resource = resources[group[i].members[j]];
            for(let k = 0; k < resource.rows; k++) {
                for (let d = 0; d < numOfDays; d++) {
                    const day = moment(firstDate).clone().add(d, 'days');
                    const cell = ws.getCell(column(GROUP_HEADER_COLUMN + 2 + d) + (TIME_HEADER_ROW + 2 + groupRow + extraRows + k + j));
                    cell.alignment = {vertical: "middle", horizontal: "center", wrapText: true};
                    cell.font = {name: FONT_NAME, size: CELL_FONT_SIZE, color: {argb: "FF000000"}};
                    let cellColor = "FFFFFFFF";

                    if(Dates.isWeekend(day.toDate())) cellColor = "FFF2FFF2";
                    else if(Dates.isHoliday(day.toDate())) cellColor = "FFF2F2FF";
                    else if(resource.availability && resource.availability[day.isoWeekday()] && resource.availability[day.isoWeekday()] !== 'full') cellColor = "FFE8E8E8";
                    cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: cellColor}};
                    if(k === resource.rows - 1) {
                        if(k === 0 ) cell.border = BORDER_TOP_BOTTOM;
                        else cell.border = BORDER_BOTTOM;
                    } else if(k === 0 ) cell.border = BORDER_TOP;
                    else cell.border = BORDER;
                    cell.value = '';
                }
            }
            extraRows = extraRows + resources[group[i].members[j]].rows - 1;
        }
        groupRow += group[i].members.length + extraRows;
    }
}
//----------------------------------------------------------------------------------------------------------------------

function drawEvents(ws, resources, projects, type, firstDate) {
    for(const resourceId in resources) {
        if(resources.hasOwnProperty(resourceId) && resources[resourceId].type === type) {
            const resource = resources[resourceId];
            if(resource.deleted || resource.disabled) continue;
            for(let eventIndex = 0; eventIndex <  resource.events.length; eventIndex++) {
                const event = resource.events[eventIndex];
                const rowOffset = getRowOffsetForEvent(ws, event, firstDate, resource);
                for (let day = 0; day < event.days.length; day++) {
                    if(event.days[day].duration > 0) {
                        const col = moment(event.startDate, 'YYYY-MM-DD').add(day, 'days').diff(firstDate, 'days') + GROUP_HEADER_COLUMN + 2;
                        const row = resource.row + TIME_HEADER_ROW + 2 + rowOffset;
                        const cell = ws.getCell(column(col) + row);

                        const pairColor = type === 'OPERATOR' ? event.facility != null ? resources[event.facility].color : resources[event.operator].color : event.operator != null ? resources[event.operator].color : resources[event.facility].color;
                        const textColor = Color(pairColor).isDark() ? "FFFFFFFF" : "FF000000";
                        const cellColor = "FF" + pairColor.substring(1).toUpperCase();
                        cell.font.color = {argb: textColor};

                        let eventLabel = '';
                        let timeLine = '';
                        let pairLabel = '';

                        if(event.offtime) {
                            eventLabel = '- TIME OFF -';
                            if(event.label) eventLabel = '- ' + event.label + ' -';
                            cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: 'FFE0E0E0'}};
                            cell.font.color = {argb: 'FF404040'};
                        } else if(event.external) {
                            eventLabel = '| EXTERNAL |';
                            if(event.label) eventLabel = '| ' + event.label.split('$$$')[0] + ' |';
                            cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: 'FFE0E0E0'}};
                            cell.font.color = {argb: 'FF404040'};
                        } else {
                            eventLabel = projects[event.project].label;

                            const confirmed = event.confirmedAsProject ? projects[event.project].confirmed : event.confirmed;
                            const internal = projects[event.project].internal;
                            if(internal) {
                                eventLabel = '~ ' + eventLabel;
                                const reservedColor = 'FF' + Color(pairColor).mix(Color("white"), 0.8).hex().substring(1);
                                cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: reservedColor}};
                                cell.font.color = {argb: 'FF000000'};
                            } else if(confirmed) {
                                cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: cellColor}};
                            } else {
                                eventLabel = '* ' + eventLabel;
                                const reservedColor = 'FF' + Color(pairColor).mix(Color("white"), 0.4).hex().substring(1);
                                cell.fill = {type: "pattern", pattern: "solid", fgColor: {argb: reservedColor}};
                                cell.font.color = {argb: 'FF000000'};
                            }
                            pairLabel = type === 'OPERATOR' ? event.facility != null ? resources[event.facility].label : '' : event.operator != null ? resources[event.operator].label : '';
                            if(event.isShooting) pairLabel = pairLabel === '' ? 'shooting' : ' / shooting';
                            if (pairLabel !== '') pairLabel = String.fromCharCode(10) + '[' + pairLabel + ']';
                        }
                        if(event.days[day].float) {
                            const timeDuration = Math.round(100 * event.days[day].duration / 60) / 100;
                            timeLine = String.fromCharCode(10) + timeDuration + ' hour' + (timeDuration > 1 ? 's' : '');
                        } else {
                            timeLine = String.fromCharCode(10) + min2time(event.days[day].start) + ' - ' + min2time(event.days[day].start + event.days[day].duration);
                        }
                        cell.value = eventLabel + pairLabel + timeLine;
                    }
                }
            }
        }
    }
}
//**********************************************************************************************************************
function column(nNum) {
    let n = nNum - 1;
    let result = letter(n % 26);
    n = Math.floor(n / 26) -1 ;
    if(n >= 0) {
        result = letter(n % 26) + result;
    }
    n = Math.floor(n / 26) -1;
    if(n >= 0) {
        result = letter(n % 26) + result;
    }
    return result;
}
//----------------------------------------------------------------------------------------------------------------------
function letter(nNum) {
    const a = "A".charCodeAt(0);
    return String.fromCharCode(a + nNum);
}
//----------------------------------------------------------------------------------------------------------------------
function setResourceEvents(events, resource) {
    const result = [];
    for(const eventId in events) {
        if(events.hasOwnProperty(eventId)) {
            if(events[eventId].operator + '' === resource.id.toString() || events[eventId].facility + '' === resource.id.toString() ) {
                result.push(events[eventId]);
            }
        }
    }
    result.sort(function(a, b){ return moment(a.startDate,'YYYY-MM-DD').diff(moment(b.startDate, 'YYYY-MM-DD'),'days'); });
    const days = {};
    for(let k = 0; k < result.length; k++) {
        for(let m =  0; m < result[k].days.length; m++) {
            if(result[k].days[m].duration > 0) {
                const dateString = moment(result[k].startDate, 'YYYY-MM-DD').add(m, 'days').format('YYYY-MM-DD');
                if (!days[dateString]) days[dateString] = 1;
                else days[dateString] += 1;
            }
        }
    }
    let maxRows = 1;
    for(const o in days) {
        if(days.hasOwnProperty(o)) {
            if(days[o] > maxRows) maxRows = days[o];
        }
    }
    resource.rows = maxRows;
    resource.events = result;
    resource.days = days;
}
//----------------------------------------------------------------------------------------------------------------------
function getTimeGroupLabel(dIn, groupSize) {
    if(groupSize <= 1) return '';
    const dOut = dIn.clone().add(groupSize - 1,'days');
    const label =  'Week ' + dIn.format('WW, MMMM YYYY');
    if(dIn.year() === dOut.year()) return label;
    else if(groupSize >= 3) return label + ' / ' + dOut.format('MMMM YYYY');
    else return label;
}
//----------------------------------------------------------------------------------------------------------------------
function min2time(minutes) {
    let h = Math.floor(minutes / 60);
    let m = minutes - (h * 60);
    h = h < 10 ? '0' + h : '' + h;
    m = m < 10 ? '0' + m : '' + m;
    return h + ':' + m;
}
//----------------------------------------------------------------------------------------------------------------------
function getRowOffsetForEvent(ws, event, firstDate, resource) {
    const zeroRow = resource.row + TIME_HEADER_ROW + 2;
    let rowOffset = 0;
    let free = true;
    do {
        free = true;
        for (let day = 0; day < event.days.length; day++) {
            const col = moment(event.startDate, 'YYYY-MM-DD').add(day, 'days').diff(firstDate, 'days') + GROUP_HEADER_COLUMN + 2;
            const cell = ws.getCell(column(col) + (zeroRow + rowOffset));
            if (cell.value !== '') {
                free = false;
                break;
            }
        }
    } while(!free && rowOffset++ < resource.rows);
    return rowOffset;
}
//----------------------------------------------------------------------------------------------------------------------