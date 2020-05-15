'use strict';
// >>>>>> SHARED BETWEEN WEB-SERVER AND REST-API SERVER <<<<<<<
const jwt = require('jsonwebtoken');
//const logger = require('./logger');

const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;

module.exports = async function(req, res, next) {
    try {
        //DEV
        req.remote_user = 'petr.hoskovec' // tokenPayload.user;
        req.remote_user_name = 'Petr Hoskovec' // tokenPayload.userName;
        if(!req.ignoreExpiration) req.token_expiration = 1588723200000 // tokenPayload.exp * 1000;
        
        //PRODUCTION
        // const tokenPayload = await validateToken(req.cookies[AUTHENTICATION_COOKIE_NAME], req.ignoreExpiration);
        // req.remote_user = tokenPayload.user;
        // req.remote_user_name = tokenPayload.userName;
        // if(!req.ignoreExpiration) req.token_expiration = tokenPayload.exp * 1000;
        next();
    } catch (e) {
        const app = getApplication(req);
        if(app.indexOf('authenticated') < 0) res.redirect(`/login${app ? `?app=${app}` : ''}`); //if()else is not shared to web-server
        else res.status(401).end();
    }
};

function validateToken(token, ignoreExpiration) {
    return new Promise((resolve, reject) => {
        if(!token) {
            reject({err: 'No token provided', id: 'TokenEmptyError'});
            return;
        }
        jwt.verify(token, AUTH_TOKEN_SECRET, {ignoreExpiration: !!ignoreExpiration}, (err, data) => {
            if(err) {
                reject({err: err.message, id: err.name});
            } else {
                resolve(data)
            }
        });
    });
}

function getApplication(req) {
    if(!req.url) return null;
    //TODO check and format valid application string REGEX? switch?
    return req.url;
}