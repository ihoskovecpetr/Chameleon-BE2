'use strict';

const logger = require('./logger');
//const AUTHENTICATION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
//const AUTHENTICATION_COOKIE_OPTION = {httpOnly: true, secure: process.env.NODE_ENV === 'production'};

module.exports = async function(req, res) {
    try {
        const authenticatedUserId = req.remote_user;
        if(!authenticatedUserId) throw new Error('No remote user authenticated');
        const user = await getUser(authenticatedUserId);
        user.exp = req.token_expiration;
        res.json(user);
    } catch (e) {
        logger.warn(e);
        //res.clearCookie(AUTHENTICATION_COOKIE_NAME, AUTHENTICATION_COOKIE_OPTION);
        res.json({user: 'Unauthorized', access: [], role: [], name: '', email: ''});
    }
};

async function getUser(id) {
    if(id === 'miroslav.kozel') {
        return {user: id, access: [], role: [], name: 'Miroslav Kozel', email: 'miroslav.koze.@upp.cz', id: 'aaabbbcccddd'}
    } else throw new Error(`${id} - Unauthorised`);
}

