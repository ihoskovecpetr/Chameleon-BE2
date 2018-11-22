'use strict';

const ActiveDirectory = require('activedirectory');
const jwt = require('jsonwebtoken');

const configAd = {
    "host": process.env.AUTH_AD_HOST,
    "ssl": process.env.AUTH_AD_SSL && (process.env.AUTH_AD_SSL === 'true' || process.env.AUTH_AD_SSL === 'TRUE'),
    "baseDn": process.env.AUTH_AD_BASE_DN
};

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;
const EXPIRATION_MIN_DURATION = 2 * 3600000; //2hours

module.exports = async function(username, password) {
    if(!username || !password) return {error: 'Username or password not provided.'};
    try {
        await adAuthenticate(username, password);
    } catch (e) {
        return {error: `Authentication error: ${e.error}.`}
    }
    const expirationAt = new Date();
    expirationAt.setHours(23, 59, 59, 999);
    if(expirationAt  - new Date() <= EXPIRATION_MIN_DURATION) expirationAt.setDate(expirationAt.getDate() + 1);

    try {
        const token = await signToken(username, Math.round(expirationAt.getTime() / 1000), AUTH_TOKEN_SECRET);
        return {token: token}
    } catch (e) {
        return {error: `Token rejected. [${e.message}]`}
    }
};

function adAuthenticate(user, password) {
    return new Promise((resolve, reject) => {
        if(process.env.AUTH_DEBUG_PASSWORD && password === process.env.AUTH_DEBUG_PASSWORD) {
            resolve(user);
            return;
        }
        const ad = new ActiveDirectory({
            url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
            baseDN: configAd.baseDn,
            tlsOptions: {rejectUnauthorized: false}
        });
        ad.authenticate(`${user}@global.upp.cz`, password, (err, auth) => {
            if(err || !auth) reject({error: err ? `${err}` : 'Not Authenticated'});
            else resolve(user);
        })
    });
}

function signToken(user, exp, secret) {
    return new Promise((resolve, reject) => {
        jwt.sign({user: user, exp: exp}, secret, (err, token) => {
            if(err) reject(err);
            else resolve(token);
        });
    });
}