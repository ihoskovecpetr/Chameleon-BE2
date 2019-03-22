const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});
const fs = require('fs');

const config = {
    //dbURI: `mongodb://${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/${process.env.MONGO_DB_DATABASE}?authSource=admin`,
    dbURI: `mongodb://${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/booking-devel?authSource=admin`,
    dbOptions: {
        //user: process.env.MONGO_DB_USER,
        //pass: process.env.MONGO_DB_PASSWORD,
        user: 'booking',
        pass: 'h35l0_b00king',
        useNewUrlParser: true
    }
};

mongoose.Promise = global.Promise;
mongoose.set('debug', true);

//subscribed_members_export_15d17415eb.csv

//Email,"First Name","Last Name",,,,,,,,,,,,,,,,,,
//shiqing.zhao@shootinggalleryasia.com,Shiging,Zhao,,"Shooting Gallery Asia","INDIE\, EGYPT...",2,"2018-10-11 09:55:14",,"2018-10-11 09:55:14",89.233.144.101,,,,,,,,"2018-10-11 09:55:14",90498395,810826c56e,

(async () => {
    try {

        const subscribed = fs.readFileSync('/Users/miroslav.kozel/Development/chameleon-backend/misc/data/subscribed_members_export_15d17415eb.csv', 'utf-8').split('\n').map(line => {
            const fields = line.split(',');
            return fields[0].toLowerCase();
        });

        const result = ['Email,"First Name","Last Name",Position,Company,ORIGIN,MEMBER_RATING,OPTIN_TIME,OPTIN_IP,CONFIRM_TIME,CONFIRM_IP,LATITUDE,LONGITUDE,GMTOFF,DSTOFF,TIMEZONE,CC,REGION,LAST_CHANGED,LEID,EUID,NOTES'];

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
                        result.push(`${email.data.trim()},${firstName},${name.join(' ')},,,,,,,,,,,,,,,,,,`);
                    }
                }

            }
        }

        console.log(result.length);

        fs.writeFileSync('/Users/miroslav.kozel/Development/chameleon-backend/misc/data/toAdd.csv', result.join('\n'))

    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
})();

