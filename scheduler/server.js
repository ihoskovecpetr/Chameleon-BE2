'use strict';

const connectDb = require('./src/mongodb-connect');
const wamp = require('./src/wamp');
const mongoose = require('mongoose');
const schedule = require('node-schedule');

const version = require('./package.json').version;
const logger = require('./src/logger');

const k2Job = require('./src/scheduledJobs/k2');
const pusherJob = require('./src/scheduledJobs/pusher');
const maintenanceJob = require('./src/scheduledJobs/maintenance');

logger.info(`Chameleon Scheduler version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);

wamp.open();
connectDb();

const scheduledJobs = {
    "maintenance": {timing: process.env.SCHEDULER_TIMING_MAINTENANCE, job: maintenanceJob},
    "k2": {timing: process.env.SCHEDULER_TIMING_K2, job: k2Job},
    "pusher": {timing: process.env.SCHEDULER_TIMING_PUSHER, job: pusherJob, args: [false, true]}
};

for(const job of Object.keys(scheduledJobs)) {
    if(scheduledJobs[job].timing) {
        scheduledJobs.timer = schedule.scheduleJob(scheduledJobs[job].timing, () => scheduledJobs[job].job.apply(this, scheduledJobs[job].args));
        logger.debug(`Scheduling job '${job}' - timing ${scheduledJobs[job].timing}`);
    } else {
        logger.info(`Scheduled job '${job}' have not set timing - DISABLED.`);
    }
}

// *********************************************************************************************************************
// gracefully shutdown
// *********************************************************************************************************************
const signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

Object.keys(signals).forEach(signal => {
    process.on(signal, async () => {
        logger.info(`Received Signal ${signal}, shutting down.`);
        // WAMP
        await wamp.close();
        logger.info(`WAMP disconnected.`);
        // Mongo DB
        logger.info('Disconnecting MongoDb...');
        await mongoose.connection.close();
        logger.info(`MongoDb disconnected.`);
        // Shutdown
        process.exit(128 + signals[signal]);
    });
});
