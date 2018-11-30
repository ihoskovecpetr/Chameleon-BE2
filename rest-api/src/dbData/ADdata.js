'use strict';

const ActiveDirectory = require('activedirectory');

const configAd = {
    host: process.env.AUTH_AD_HOST,
    ssl: process.env.AUTH_AD_SSL && (process.env.AUTH_AD_SSL === 'true' || process.env.AUTH_AD_SSL === 'TRUE'),
    baseDn: process.env.AUTH_AD_BASE_DN,
    user: process.env.AD_USER,
    password: process.env.AD_PASSWORD
};

exports.getUser = async uid => {
    return new Promise((resolve, reject) => {
        const ad = new ActiveDirectory({
            url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
            baseDN: configAd.baseDn,
            tlsOptions: {rejectUnauthorized: false},
            username: configAd.user,
            password: configAd.password
        });
        const filter = `(&(sAMAccountName=${uid})(objectClass=user)(!(objectClass=computer)))`;
        const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail'];
        ad.findUsers({filter, attributes}, (err, data) => {
            if (err) reject(`${err}`);
            else if (!data || data.length === 0) reject(`Can't find user ${uid}`);
            else resolve({
                    uid: data[0].sAMAccountName,
                    name: data[0].givenName && data[0].sn ? `${data[0].givenName} ${data[0].sn}` : data[0].displayName,
                    email: data[0].mail
                });
        })
    });
};
