'use strict';
const db = require('../dbData/mongoDb-chameleon');
const logger = require('../logger');

module.exports = access => {
    return async function(req, res, next) {
        const remoteUser = req.remote_user;
        if(!remoteUser) {
            const error = new Error('Unauthenticated User! Access Forbidden.');
            error.statusCode = 401;
            next(error);
        } else {
            if(!access) {
                next();
            } else {
                if(!Array.isArray(access)) access = [access];
                try {
                    const userAccess = await db.getUserAppAccess(remoteUser);
                    if(userAccess && userAccess.access && userAccess.access.length > 0) {
                        let hasAccess = false;
                        for(const a of access) hasAccess = hasAccess || userAccess.access.indexOf(a) >= 0;
                        if(hasAccess) {
                            next();
                            return;
                        }
                    }
                    const error = new Error(`Unauthorized! Access Forbidden. [user: ${remoteUser}, access: ${access}]`);
                    error.statusCode = 403;
                    next(error);
                } catch(error) {
                    next(error);
                }
            }
        }
    };
};
