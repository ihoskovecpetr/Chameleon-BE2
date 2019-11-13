'use strict';

const express = require('express');
const router = express.Router();
const moment = require('moment');
const mongoose = require('mongoose');
const crypto = require('crypto');
const db = require('../dbData/mongoDb-availability');
const wamp = require('../wamp');

module.exports = router;

const logger = require('../logger');

const secret = process.env.AVAILABILITY_API_SECRET;
const allowedIp = process.env.AVAILABILITY_API_IP ? process.env.AVAILABILITY_API_IP.split(',').map(ip => ip.trim()) : null;

// *********************************************************************************************************************
// CREATE AVB EVENT
// *********************************************************************************************************************
router.post('/event/:id', authorizeApiAccess(), async (req, res, next) => {
    let event = null;
    try {
        const id = mongoose.Types.ObjectId();
        const avbId = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const startDate =  req.body.startDate ? moment(req.body.startDate).format('YYYY-MM-DD') : null;
        if(avbId && startDate && req.body.numOfDays && req.body.numOfDays > 0 && req.body.uid) {
            const user = await db.getUserBySsoIdOrNull(req.body.uid);
            if(user && user.resource) {
                const duration = user.fullTime ? user.fullTime * 60  : 10 * 60;
                const days = [];
                for(let i = 0; i < req.body.numOfDays; i++) days.push({
                    start: 480,
                    duration: duration,
                    float: true
                });
                event = {
                    project: '000000000000000000000000',
                    offtime: true,
                    confirmedAsProject: false,
                    isShooting: false,
                    efficiency: 100,
                    job: null,
                    facility: null,
                    virtualOperator: null,
                    avbEvent: avbId,
                    label: req.body.label ? req.body.label : null,
                    startDate: startDate,
                    days: days,
                    confirmed: !req.body.requested,
                    operator: user.resource,
                    notes: req.body.notes ? req.body.notes : "",
                    archived: false
                };
                await db.addEvent(id, event);
                wamp.publish('addEvent', [], {id: id, event: event});
                //await db.logOp('addEvent', '333333333333333333333333', {id: id, event: event}, null);
                res.status(200).end();
            } else {
                //const error = new Error(`Add Event (availability) - no resource or user, uid: ${req.body.uid}, avbId: ${avbId}`);
                //error.statusCode = 400;
                //next(error);
                logger.debug(`Add Event (availability) - no resource or user, uid: ${req.body.uid}, avbId: ${avbId}`);
                res.status(404).end();
            }
        } else {
            const error = new Error(`Add Event (availability) - no or valid data provided`);
            error.statusCode = 400;
            next(error);
        }
    } catch(error) {
        //await db.logOp('addEvent', '333333333333333333333333', {id: id, event: event}, error);
        next(error);
    }
});

// *********************************************************************************************************************
// DELETE AVB EVENT
// *********************************************************************************************************************
router.delete('/event/:id', authorizeApiAccess(), async (req, res, next) => {
    let event = null;
    try {
        const avbId = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(avbId) {
            event = await db.removeAvbEvent(avbId);
            if(event) {
                const id = event._id;
                event = event.toObject();
                event.startDate = moment(event.startDate).format('YYYY-MM-DD');
                delete event._id;
                delete event.__v;
                const result = {
                    id: id,
                    event: event
                };
                wamp.publish('removeEvent', [], result);
                //await db.logOp('removeEvent', '333333333333333333333333', result, null);
                res.status(200).end();
            } else {
                //const error = new Error(`Remove Event (availability) - avb event ${avbId}  not found`);
                //error.statusCode = 400;
                //next(error);
                logger.debug(`Remove Event (availability) - avb event ${avbId} not found`); //TODO USER ??????
                res.status(404).end();
            }
        } else {
            const error = new Error(`Remove Event (availability) - no or invalid avb-id was provided [${req.params.id}]`);
            error.statusCode = 400;
            next(error);
        }
    } catch(error) {
        //await db.logOp('removeEvent', '333333333333333333333333', {id: id, event: event}, error);
        next(error);
    }
});
// *********************************************************************************************************************
// UPDATE AVB EVENT
// *********************************************************************************************************************
router.put('/event/:id', authorizeApiAccess(), async (req, res, next) => {
    let event = null;
    try {
        const avbId = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(avbId) {
            const eventUpdate = {};
            if(typeof req.body.label !== 'undefined') eventUpdate.label = req.body.label ? req.body.label : null;
            if(typeof req.body.startDate !== 'undefined') eventUpdate.startDate = moment(req.body.startDate).format('YYYY-MM-DD');
            if(typeof req.body.notes !== 'undefined') eventUpdate.notes = req.body.notes ? req.body.notes : "";
            if(typeof req.body.requested !== 'undefined') eventUpdate.confirmed = !req.body.requested;
            if(typeof req.body.numOfDays !== 'undefined' && req.body.numOfDays > 0) {
                eventUpdate.days = [];
                for(let i = 0; i < req.body.numOfDays; i++) eventUpdate.days.push({
                    start: 480,
                    duration: 600,
                    float: true
                })
            }
            const data = await db.updateAvbEvent(avbId, eventUpdate);
            if(data && data.event && data.oldEvent) {
                data.id = data.event._id;
                data.oldEvent.startDate = moment(data.oldEvent.startDate).format('YYYY-MM-DD');
                data.event.startDate = moment(data.event.startDate).format('YYYY-MM-DD');
                delete data.oldEvent._id;
                delete data.oldEvent.__v;
                delete data.event._id;
                delete data.event.__v;
                wamp.publish('updateEvent', [], data);
                //db.logOp('updateEvent', '333333333333333333333333', data, null);
                res.status(200).end();
            } else {
                //const error = new Error(`Update Event (availability) - avb event ${avbId} not found`);
                //error.statusCode = 404;
                //next(error);
                logger.debug(`Update Event (availability) - avb event ${avbId} not found`); //TODO USER ??????
                res.status(404).end();
            }
        } else {
            const error = new Error(`Update Event (availability) - no or invalid avb-id was provided [${req.params.id}]`);
            error.statusCode = 400;
            next(error);
        }
    } catch(error) {
        //await db.logOp('updateEvent', '333333333333333333333333', {id: id, event: event}, error);
        next(error);
    }
});
//**********************************************************************************************************************
// API ACCESS AUTHORIZATION
//**********************************************************************************************************************
function authorizeApiAccess() {
    return function(req, res, next) {
        const requestIp = (req.header('x-real-ip') || req.header('x-forwarded-for') || req.connection.remoteAddress).split(",")[0];
        const requestPhrase = req.header('x-availability-phrase');
        const requestToken = req.header('x-availability-token');
        //logger.debug(`Authorize AVB Api, request IP: ${requestIp}, request Phrase: ${requestPhrase}, request Token: ${requestToken}`);
        //logger.debug(`x-real-ip: ${req.header('x-real-ip')}`);
        //logger.debug(`x-forwarded-for: ${req.header('x-forwarded-for')}`);
        if(requestPhrase && requestToken) {
            const localToken = crypto.createHmac("md5", secret).update(requestPhrase).digest('hex');
            if(requestToken === localToken) {
                if (requestIp && allowedIp && Array.isArray(allowedIp) && allowedIp.length > 0) {
                    //logger.debug(`allowedIp: ${allowedIp}`);
                    if(allowedIp.indexOf(requestIp) >= 0) {
                        next();
                        return;
                    }
                } else {
                    next();
                    return;
                }
            }
        }
        logger.warn(`AuthorizeApiAccess (AVB) - Unauthorized.`);
        logger.debug(`Authorize AVB Api, request IP: ${requestIp}, request Phrase: ${requestPhrase}, request Token: ${requestToken}`);
        logger.debug(`x-real-ip: ${req.header('x-real-ip')}`);
        logger.debug(`x-forwarded-for: ${req.header('x-forwarded-for')}`);
        res.status(401).end();
    };
}
/*
const TEST_PHRASE = '123456789';
const TEST_SECRET = 'avb#b00k1ng#Ap1';

console.log(crypto.createHmac("md5", TEST_SECRET).update(TEST_PHRASE).digest('hex'));
*/