const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});
const fs = require('fs');
const moment = require('moment');

const config = {
    dbURI: `mongodb://${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/chameleon?authSource=admin`,
    dbOptions: {
        user: 'admin',
        pass: 'm0ng0_01_adm1n',
        useNewUrlParser: true
    }
};

mongoose.Promise = global.Promise;
mongoose.set('debug', true);

//const currentMembers = 'subscribed_members_export_4de65ff335.csv';
//const currentMembers = 'subscribed_members_export_15d17415eb.csv';
//const currentMembers = 'subscribed_members_export_1bde686f3d.csv';
//const currentMembers = 'subscribed_members_export_c5ed02d3c7.csv';
const currentMembers = 'subscribed_members_export_ba473dc14f.csv';


//Email,"First Name","Last Name",,,,,,,,,,,,,,,,,,
//shiqing.zhao@shootinggalleryasia.com,Shiging,Zhao,,"Shooting Gallery Asia","INDIE\, EGYPT...",2,"2018-10-11 09:55:14",,"2018-10-11 09:55:14",89.233.144.101,,,,,,,,"2018-10-11 09:55:14",90498395,810826c56e,

(async () => {
    try {

        const subscribed = fs.readFileSync(`${path.resolve(__dirname, '../data')}/${currentMembers}`, 'utf-8').split('\n').map(line => {
            const fields = line.split(',');
            return fields[0].toLowerCase();
        });
        const result = ['Email,"First Name","Last Name",Position,Company,ORIGIN,MEMBER_RATING,OPTIN_TIME,OPTIN_IP,CONFIRM_TIME,CONFIRM_IP,LATITUDE,LONGITUDE,GMTOFF,DSTOFF,TIMEZONE,CC,REGION,LAST_CHANGED,LEID,EUID,NOTES,TAGS'];
        const numOfFields = result[0].split(',').length;
        const commasToAdd = ','.repeat(numOfFields - 3);

        await mongoose.connect(config.dbURI, config.dbOptions);

        const People = mongoose.connection.db.collection('contact-people');

        const people = await People.find().toArray();
        for(const person of people) {
            const contact = person.contact.filter(c => c.type === 'EMAIL');
            if(!person.delete && contact.length > 0) {
                for(const email of contact) {
                    if(subscribed.indexOf(email.data.toLowerCase()) < 0 && email.data.indexOf('@') > 0) {
                        const name = person.name.split(' ');
                        let firstName = '';
                        if(name.length > 1) {
                            firstName = name.shift();
                        }
                        result.push(`${email.data.trim()},${firstName},${name.join(' ')}${commasToAdd}`);
                    }
                }

            }
        }

        console.log(result.length);

        fs.writeFileSync(`${path.resolve(__dirname, '../data')}/toAdd_${moment().format('YYYYMMDD')}.csv`, result.join('\n'))

    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
})();

