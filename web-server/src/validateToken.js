'use strict';
// >>>>>> SHARED WITH REST-API SERVER <<<<<<<
const jwt = require('jsonwebtoken');

const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;

module.exports = async function(req, res, next) {
    try {
        const tokenPayload = await validateToken(req.cookies[AUTHENTICATION_COOKIE_NAME]);
        req.remote_user = tokenPayload.user;
        req.token_expiration = tokenPayload.exp * 1000;
        next();
    } catch (e) {
        const app = getApplication(req);
        res.redirect(`/login${app ? `?app=${app}` : ''}`);
    }
};


function validateToken(token) {
    return new Promise((resolve, reject) => {
        if(!token) {
            reject({err: 'No token provided', id: 'TokenEmptyError'});
            return;
        }
        jwt.verify(token, AUTH_TOKEN_SECRET, (err, data) => {
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