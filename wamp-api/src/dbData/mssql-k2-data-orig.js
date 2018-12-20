const sql = require('mssql');
const moment = require('moment');
const logger = require('./logger');

const k2config = require('../../config.json').k2;


let reportedError = null;
let connection = null;

module.exports = {
    getK2projects: getK2projects,
    getK2project: getK2project,
    getK2workLog: getK2workLog,
    getK2workLogs: getK2workLogs,
    getInvoices: getInvoices
};

const config = {
    user: k2config.user,
    password: k2config.password,
    server: k2config.host, // You can use 'localhost\\instance' to connect to named instance
    database: k2config.database,
    options: {
        encrypt: false
    }
};

// *******************************************************************************************
// GET DATA
// *******************************************************************************************
function getK2projects() {
    const sqlQuery = "SELECT * FROM Dbo.K2ReklamaProjectList WHERE Str = 'R VFX' OR Str = 'R DI' ORDER BY TimeStamp DESC";
    return K2dataRequest(sqlQuery);
}

function getK2project(projectId) {
    const sqlQuery = "SELECT * FROM Dbo.K2ReklamaProjectList WHERE RID = " + projectId;
    return K2dataRequest(sqlQuery);
}

function getK2workLog(projectId) {
    const sqlQuery = "SELECT ReservationDate, ProdejRID, EX_Popis, Mnoz, Prij, Jmno, Abbr, RID, Kod, Zkr FROM Dbo.K2WorkAll WHERE RID = " + projectId + " AND ( Abbr = 'hod' OR Abbr = 'min' ) AND ( Kod = 'OV' OR Kod = 'SV' OR Kod = '2D' OR Kod = '3D' OR Kod = 'MP' OR Kod = 'BL' OR Kod = 'FL' OR Kod = 'IT')";
    return K2dataRequest(sqlQuery);
}

//analytics
function getK2workLogs(from, to, projectIds) {
    const sqlQuery = "SELECT ReservationDate, Mnoz, Prij, Jmno, Abbr FROM Dbo.K2WorkAll WHERE RID IN (" + projectIds + ") AND ( Abbr = 'hod' OR Abbr = 'min' ) AND ( Kod = 'OV' OR Kod = 'SV' OR Kod = '2D' OR Kod = '3D' OR Kod = 'MP' OR Kod = 'BL' OR Kod = 'FL' OR Kod = 'IT') AND (ReservationDate BETWEEN '" + moment(from).format('YYYY-MM-DD') + "' AND '" + moment(to).format('YYYY-MM-DD') + "')";
    return K2dataRequest(sqlQuery);
}

// invoices
function getInvoices(projectIds) {
    if(!Array.isArray(projectIds)) projectIds = [projectIds];
    const sqlQuery = "SELECT RID, Mena, Cena, DPH, Zap, Kurz, Kurz2, Dvyst, Dspla FROM Dbo.K2ReklamaFaktvyda WHERE RID IN (" + projectIds + ")";
    return K2dataRequest(sqlQuery);
}

async function _K2dataRequest(sqlQuery) {
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        const result = await pool.request().query(sqlQuery);
        sql.close();
        if (reportedError) logger.info(`K2 connection restored`);
        reportedError = null;
        return result.recordset;
    } catch(err) {
        if(reportedError !== err.code) {
            logger.warn(`K2 request error: ${err}`);
            reportedError = err.code;
        }
        throw err.code;
    }
}


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


