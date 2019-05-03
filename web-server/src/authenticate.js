'use strict';

const ActiveDirectory = require('activedirectory');
const jwt = require('jsonwebtoken');

const configAd = {
    host: process.env.AUTH_AD_HOST,
    ssl: process.env.AUTH_AD_SSL && (process.env.AUTH_AD_SSL === 'true' || process.env.AUTH_AD_SSL === 'TRUE'),
    baseDn: process.env.AUTH_AD_BASE_DN,
    username: process.env.AD_USER,
    password: process.env.AD_PASSWORD
};

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;
const EXPIRATION_MIN_DURATION = 2 * 3600000; //2hours

module.exports = async function(user, password) {
    if(!user || !password) return {error: 'Username or password not provided.'};
    let userName = '';
    try {
        userName = await adAuthenticate(user, password);
    } catch (e) {
        return {error: `Authentication error: ${e.error}.`}
    }
    const expirationAt = new Date();
    expirationAt.setHours(23, 59, 59, 999);
    if(expirationAt  - new Date() <= EXPIRATION_MIN_DURATION) expirationAt.setDate(expirationAt.getDate() + 1);

    try {
        const token = await signToken({user: user, userName: userName, exp: Math.round(expirationAt.getTime() / 1000)}, AUTH_TOKEN_SECRET);
        return {token: token, userName: userName}
    } catch (e) {
        return {error: `Token rejected. [${e.message}]`}
    }
};

function adAuthenticate(user, password) {
    return new Promise((resolve, reject) => {
        if(process.env.AUTH_DEBUG_PASSWORD && password === process.env.AUTH_DEBUG_PASSWORD) {
            resolve(getUserName(user));
            return;
        }
        const ad = new ActiveDirectory({
            url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
            baseDN: configAd.baseDn,
            tlsOptions: {rejectUnauthorized: false}
        });
        ad.authenticate(`${user}@global.upp.cz`, password, (err, auth) => {
            if(err || !auth) reject({error: err ? `${err}` : 'Not Authenticated'});
            else resolve(getUserName(user));
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
    const ad = new ActiveDirectory({
        url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
        baseDN: configAd.baseDn,
        tlsOptions: {rejectUnauthorized: false},
        username: `${configAd.username}`,
        password: `${configAd.password}`
    });
    try {
        ad.findUser({}, userName, (err, user) => {
            if (err) return generateUserName(userName);
            else return user.displayName || `${user.givenName} ${user.sn}` || generateUserName(userName)
        })
    } catch (e) {
        return userName;
    }
}

function generateUserName(uid) {
    if (!uid) return '';
    uid = uid.trim();
    const index = uid.indexOf('.');
    if (index > 1) {
        return `${uid[0].toUpperCase()}${uid.substr(1, index - 1)} ${uid[index + 1].toUpperCase()}${uid.substr(index + 2)}`;
    } else {
        return `${uid[0].toUpperCase()}${uid.substr(1)}`;
    }
}
