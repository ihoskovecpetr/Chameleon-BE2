'use strict';

const ActiveDirectory = require('activedirectory');
const jwt = require('jsonwebtoken');
const db = require('./dbData');
const logger = require('./logger');

const configAd = {
    host: process.env.AUTH_AD_HOST,
    ssl: process.env.AUTH_AD_SSL && (process.env.AUTH_AD_SSL === 'true' || process.env.AUTH_AD_SSL === 'TRUE'),
    baseDn: process.env.AUTH_AD_BASE_DN,
    username: process.env.AD_USER,
    password: process.env.AD_PASSWORD
};

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;
const EXPIRATION_MIN_DURATION = 2 * 3600000; //2hours
const PUSHER_ACCESS = 'pusher:app';

module.exports = async function(user, password, pusher) {
    if(!user || !password) return {error: 'Username or password not provided.'};
    let userName = '';
    let userData = {access: [], role: []};
    try {
        await adAuthenticate(user, password);
        userName = await getUserName(user);
        userData = await db.getUserRoleAccess(user);
    } catch (e) {
        return {error: `Authentication error: ${e.error}.`}
    }
    if(pusher) {
        if(userData.access.indexOf(PUSHER_ACCESS) >= 0) return {id: user, name: userName, role: userData.role};
        else return {error: `User access forbidden.`};
    }
    const expirationAt = new Date();
    expirationAt.setHours(23, 59, 59, 999);
    if(expirationAt  - new Date() <= EXPIRATION_MIN_DURATION) expirationAt.setDate(expirationAt.getDate() + 1);

    try {
        const token = await signToken({user: user, userName: userName, access: userData.access, role: userData.role, exp: Math.round(expirationAt.getTime() / 1000)}, AUTH_TOKEN_SECRET);
        return {token: token, userName: userName}
    } catch (e) {
        return {error: `Token rejected. [${e.message}]`}
    }
};

function adAuthenticate(user, password) {
    return new Promise((resolve, reject) => {
        if(process.env.AUTH_DEBUG_PASSWORD && password === process.env.AUTH_DEBUG_PASSWORD) {
            return resolve();
        }
        const ad = new ActiveDirectory({
            url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
            baseDN: configAd.baseDn,
            tlsOptions: {rejectUnauthorized: false}
        });
        ad.authenticate(`${user}@global.upp.cz`, password, (err, auth) => {
            if(err || !auth) reject({error: err ? `${err}` : 'Not Authenticated'});
            else resolve();
        })
    });
}

function signToken(payload, secret) {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, secret, (err, token) => {
            if(err) reject(err);
            else resolve(token);
        });
    });
}

function getUserName(userName) {
    return new Promise((resolve) => {
        const ad = new ActiveDirectory({
            url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
            baseDN: configAd.baseDn,
            tlsOptions: {rejectUnauthorized: false},
            username: `${configAd.username}`,
            password: `${configAd.password}`
        });
        ad.findUser({}, userName, (err, user) => {
            if (err) resolve(generateUserName(userName));
            else resolve(user.displayName || `${user.givenName} ${user.sn}` || generateUserName(userName));
        })
    });
}

function getUser() {

}

function generateUserName(uid) {
    if (!uid) return '';
    uid = uid.trim();
    const index = uid.indexOf('.');
    if (index > 1) {
        return `${uid[0].toUpperCase()}${uid.substr(1, index - 1)} ${uid[index + 1].toUpperCase()}${uid.substr(index + 2)}*`;
    } else {
        return `${uid[0].toUpperCase()}${uid.substr(1)}*`;
    }
}
/*
function adAuthenticateTest(user, password) {
    const ad = new ActiveDirectory({
        url: `ldaps://Srv-UPP01.global.upp.cz:636`,
        baseDN: 'dc=global,dc=upp,dc=cz',
        tlsOptions: {rejectUnauthorized: false}
    });
    ad.authenticate(`${user}@upp.cz`, password, (err, auth) => {
        if(err || !auth) console.log({error: err ? `${JSON.stringify(err)}` : 'Not Authenticated'});
        else console.log('ok');
    })
}
adAuthenticateTest('miroslav.kozel', '')
 */
