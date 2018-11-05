'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const connectDb = require('./src/mongodb-connect');

const version = require('./package.json').version;
const logger = require('./src/logger');

const validateToken = require('./src/validateToken');

const apiRouterProject = require('./src/routers/api-router-project');

// *********************************************************************************************************************
const PORT = 3000;
const HOST = '0.0.0.0';
// *********************************************************************************************************************

logger.info("=========================================================================");
logger.info(`Chameleon RESTful Api version: ${version}, (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);
logger.info("=========================================================================");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/api/1/', validateToken, (req, res) => res.status(200).end('Chameleon RESTful API v.1'));

//app.use('/api/1/user', apiRouterUser);
app.use('/api/1/project', apiRouterProject);

// *********************************************************************************************************************
app.listen(PORT, HOST, (err) => {
    if (err) logger.error(err);
    else {
        connectDb();
        logger.info(`Server listening on port: ${PORT} -> ${process.env.HOST_PORT}`);
    }
});
