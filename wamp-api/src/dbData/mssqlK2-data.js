'use strict';

const sql = require('mssql');
const logger = require('../logger');
//const moment = require('moment');

let reportedError = null;
let connection = null;

const config = {
    user: process.env.K2_DB_USER,
    password: process.env.K2_DB_PASSWORD,
    server: `${process.env.K2_DB_HOST}\\${process.env.K2_DB_INSTANCE}`, // You can use 'localhost\\instance' to connect to named instance
    database: process.env.K2_DB_DATABASE,
    options: {
        encrypt: false
    }
};
exports = module.exports;

exports.getK2projects = async () => {
    const sqlQuery = "SELECT * FROM Dbo.K2ReklamaProjectList WHERE Str = 'R VFX' OR Str = 'R DI' ORDER BY TimeStamp DESC";
    return K2dataRequest(sqlQuery);
};

async function K2dataRequest(sqlQuery) {
    if(connection === null || !connection.connected) {
        try {
            if (connection && !connection.connected) logger.debug('K2 re-connecting');
            else logger.debug('K2 connecting');
            const conn = new sql.ConnectionPool(config);
            connection = await conn.connect();
            connection.on('error', err => {
                handleError(err, 'connection on error');
            });
            logger.debug('K2 connected');
        } catch(err) {
            handleError(err, 'connection error', true);
            return [];
        }
    }
    try {
        const data = await new sql.Request(connection).query(sqlQuery);
        if(reportedError) logger.info(`K2 connection OK.`);
        reportedError = null;
        return data.recordset;
    } catch(err) {
        handleError(err, 'request error', true);
        return [];
    }
}

sql.on('error', err => {
    handleError(err, 'sql on error');
});

function handleError(err, type, throwError) {
    if(!reportedError) {
        logger.warn(`K2 ${type}: ${err}`);
        reportedError = err.code;
    }
    //if(throwError) throw err;
}