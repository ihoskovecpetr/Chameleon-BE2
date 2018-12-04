'use strict';
const db = require('../dbData/mongoDb-chameleon');

module.exports = access => {
    return async function(req, res, next) {
        const remoteUser = req.remote_user;
        if(!remoteUser) {
            const error = new Error('Unauthenticated User! Access Forbidden.');
            error.statusCode = 401;
            next(error);
        } else {
            if(!access) next();
            else {
                if(!Array.isArray(access)) access = [access];
                try {
                    const userAccess = await db.getUserAppAccess(remoteUser);
                    if(!userAccess || !userAccess.access || userAccess.access.length === 0) return res.status(403).json({error: 'Unauthorized! Access Forbidden.'});
                    let hasAccess = false;
                    for(const a of access) hasAccess = !hasAccess && userAccess.access.indexOf(a) >= 0;
                    if(hasAccess) next();
                    else {
                        const error = new Error('Unauthorized! Access Forbidden.');
                        error.statusCode = 403;
                        next(error);
                    }
                } catch(error) {
                    next(error);
                }
            }
        }
    };
};
