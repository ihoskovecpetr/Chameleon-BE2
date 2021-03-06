'use strict';

const sql = require('mssql');
const logger = require('./logger');
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

exports.getK2project = async projectId => {
    const sqlQuery = "SELECT * FROM Dbo.K2ReklamaProjectList WHERE RID = " + projectId;
    return K2dataRequest(sqlQuery);
};

exports.getK2workLog = async (projectId, works) => {
    const worksString = works.map(work => `Kod = '${work}'`).join(' OR ');
    //const sqlQuery = "SELECT ReservationDate, ProdejRID, EX_Popis, Mnoz, Prij, Jmno, Abbr, RID, Kod, Zkr FROM Dbo.K2WorkAll WHERE RID = " + projectId + " AND ( Abbr = 'hod' OR Abbr = 'min' ) AND ( Kod = 'OV' OR Kod = 'SV' OR Kod = '2D' OR Kod = '3D' OR Kod = 'MP' OR Kod = 'BL' OR Kod = 'FL' OR Kod = 'IT')";
    const sqlQuery = "SELECT ReservationDate, ProdejRID, EX_Popis, Mnoz, Prij, Jmno, Abbr, RID, Kod, Zkr FROM Dbo.K2WorkAll WHERE RID = " + projectId + " AND ( Abbr = 'hod' OR Abbr = 'min' ) AND ( " + worksString + " )";
    //if(projectId === '154713311936718') logger.debug(sqlQuery);
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
/*
(async () => {
    const config = {
        user: 'sql_reklama_booking',
        password: 'gnkbmlkrls+7',
        server: `srv-sql01.global.upp.cz\\K2`,
        database: 'Reklama_booking',
        options: {
            encrypt: false
        }
    };
    const sqlQuery = `SELECT TOP 100 ReservationDate, Kod, Zkr, Naz, Prij, Jmno  FROM Dbo.K2WorkAll ORDER BY ReservationDate DESC`;
    try {
        const conn = new sql.ConnectionPool(config);
        connection = await conn.connect();
        connection.on('error', err => {
            console.log(err);
        });
    } catch(err) {
        console.log(err);
    }
    console.log('Connected.....');
    try {
        const data = await new sql.Request(connection).query(sqlQuery);
        if(data) console.log(data.recordset.map(record => {
            if(record.Zkr.toLowerCase().indexOf('remote') >= 0)console.log('--- REMOTE ----')
            return `${(new Date(record.ReservationDate)).toLocaleDateString()} :: ${record.Kod.trim()} :: ${record.Zkr} : ${record.Naz} # ${record.Jmno} ${record.Prij}`
        }).join('\n'));
    } catch(err) {
        console.log(err);
    }

})();
*/