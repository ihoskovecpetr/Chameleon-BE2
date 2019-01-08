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

const PROJECT_AGE_TO_ARCHIVE = 365; //days

(async () => {
    try {
        await mongoose.connect(config.dbURI, config.dbOptions);

        const Events = mongoose.connection.db.collection('booking-events');
        const Projects = mongoose.connection.db.collection('booking-projects');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latestDayToArchive = new Date(today.getTime() - (PROJECT_AGE_TO_ARCHIVE * 24 * 60 * 60 * 1000));

        const projects = await Projects.find({archived: false, deleted: null}).toArray();
        for(const project of projects) {
            const projectEvents = await Events.find({project: project._id}, {projection: {_id: 1, startDate: 1, days: 1 } }).toArray();
            let latestProjectDay = 0;
            for(const event of projectEvents) {
                const eventLastDay = getEventLastDate(event);
                if (eventLastDay - latestProjectDay > 0) latestProjectDay = eventLastDay;
                if (project.offtime && latestDayToArchive - eventLastDay > 0) {
                    console.log(event.startDate, eventLastDay, event._id);
                    await Events.updateOne({_id: event._id}, {$set: {archived: true}});
                }
            }
            if(!project.offtime && latestDayToArchive - latestProjectDay > 0 && latestProjectDay > 0) {
                project.archived = true;
                await Projects.updateOne({_id: project._id}, {$set: {archived: true}});
            }
        }

    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
})();

function getEventLastDate(event) {
    const startDate = new Date(event.startDate);
    return new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + (event.days && event.days.length > 0 ? event.days.length - 1 : 0),
        0,
        0,
        0,
        0
    );
}

