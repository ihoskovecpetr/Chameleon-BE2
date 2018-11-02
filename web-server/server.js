'use strict';

const express = require('express');
const version = require('./package.json').version;
const logger = require('./src/logger');

// *********************************************************************************************************************
const PORT = 3000;
const HOST = '0.0.0.0';
// *********************************************************************************************************************

logger.info("=========================================================================");
logger.info(`Chameleon Web Server version: ${version}, NODE_ENV: ${process.env.NODE_ENV}`);
logger.info("=========================================================================");



const app = express();





app.get('/', (req, res) => {
    res.send('Hello world\n');
});

// *********************************************************************************************************************
app.listen(PORT, HOST, (err) => {
    if (err) logger.error(err);
    else logger.info('Server listening on port:' + PORT);
});