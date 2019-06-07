const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

const config = {
    dbURI: `mongodb://${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/${process.env.MONGO_DB_DATABASE}?authSource=admin`,
    dbOptions: {
        user: process.env.MONGO_DB_USER,
        pass: process.env.MONGO_DB_PASSWORD,
        useNewUrlParser: true
    }
};

mongoose.Promise = global.Promise;
mongoose.set('debug', true);

//console.log(config);
//return;

(async () => {
    try {
        await mongoose.connect(config.dbURI, config.dbOptions);

        const Events = mongoose.connection.db.collection('booking-events');
        const Projects = mongoose.connection.db.collection('booking-projects');
        const Users = mongoose.connection.db.collection('users');

        const result1 = await Events.updateMany({}, {$unset: {external: 1}}, {multi: true});
        console.log(`Remove external from events: ${JSON.stringify(result1.result)}`);

        const result2 = await Projects.updateMany({}, {$unset: {external: 1}}, {multi: true});
        console.log(`Remove external from projects: ${JSON.stringify(result2.result)}`);

        const result3 = await Projects.updateMany({}, {$rename: {K2id: 'K2rid', client: 'K2client', projectId: 'K2projectId', notes: 'bookingNotes'}}, {multi: true});
        console.log(`Rename fields in projects: ${JSON.stringify(result3.result)}`);

        const result4 = await Projects.deleteOne({label: 'EXTERNAL'});
        console.log(`Remove EXTERNAL doc from projects: ${JSON.stringify(result4.result)}`);

        const result5 = await Projects.updateMany({checked: {$exists: false}}, {$set: {checked: null}}, {multi: true});
        console.log(`Add checked where is not set in projects: ${JSON.stringify(result5.result)}`);

        const result6 = await Users.updateMany({},  {$unset: {allowedResources: 1}}, {multi: true});
        console.log(`Remove AllowedResources from Users: ${JSON.stringify(result6.result)}`);

        const result7 = await Projects.updateMany({},  {$set: {archived: false}}, {multi: true});
        console.log(`Set Archived Project to false: ${JSON.stringify(result7.result)}`);

        const result8 = await Events.updateMany({},  {$set: {archived: false}}, {multi: true});
        console.log(`Set Archived Event to false: ${JSON.stringify(result8.result)}`);

        const result9 = await Projects.updateMany({},  {$set: {rnd: false}}, {multi: true});
        console.log(`Set R&D Project to false: ${JSON.stringify(result9.result)}`);

    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
})();

