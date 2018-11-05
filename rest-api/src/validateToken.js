'use strict';

const jwt = require('jsonwebtoken');

const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'cham3l30n_Aut43nt1cat10n_53cr3t';

module.exports = async function(req, res, next) {
    try {
        const tokenPayload = await validateToken(req.cookies[AUTHENTICATION_COOKIE_NAME]);
        req.remote_user = tokenPayload.user;
        req.token_expiration = tokenPayload.exp * 1000;
        next();
    } catch (e) {
        res.redirect(`/login${req.url ? `?app=${req.url}` : ''}`);
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