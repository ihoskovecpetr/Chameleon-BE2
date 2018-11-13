'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const connectDb = require('./src/mongodb-connect');

const version = require('./package.json').version;
const logger = require('./src/logger');

const validateToken = require('./src/validateToken');

const apiRouterUser = require('./src/routers/api-router-user');
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

app.get('/api', validateToken, (req, res) => res.status(200).end('Chameleon RESTful API'));

app.use('/api/users', apiRouterUser);
app.use('/api/project', apiRouterProject);

// *********************************************************************************************************************
app.listen(PORT, HOST, (err) => {
    if (err) logger.error(err);
    else {
        connectDb();
        logger.info(`Server listening on port: ${PORT}`);
    }
});
