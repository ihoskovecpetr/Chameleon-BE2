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

(async () => {
    try {
        await mongoose.connect(config.dbURI, config.dbOptions);
        const Companies = mongoose.connection.db.collection('contact-companies');
        const Projects = mongoose.connection.db.collection('projects');
        const companies = await Companies.find({deleted: null}).toArray();
        const projects = await Projects.find({}).toArray();

        const companyToProjectMap = projects.reduce((out, project) => {
            //console.log(project)
            for(const company of project.company) {
                if(!out[company.id]) out[company.id] = [];
                out[company.id].push({name: project.name, date: project.inquired});
            }
            return out;
        }, {});


        const result = companies.map(company => {
            return {
                name: company.name,
                business: company.business.length > 0 ? company.business.sort().join(', ') : 'Z',
                projects: companyToProjectMap[company._id] ? companyToProjectMap[company._id].sort((a,b) => new Date(b.date) - new Date(a.date)).map(project => `${project.name}${project.date ? ` (${moment(project.date).format('D.M.YYYY')})` : ''}`) : [],
                contact: company.contact.map(contact => contact.data.trim())
            }

        }).sort((a, b) => a.business.localeCompare(b.business));

        const list = result.map(company => `${company.name};${company.business !== 'Z' ? company.business : ''};${company.contact.length > 0 ? company.contact.join(', ') : ''};${company.projects.join(', ')}`).join('\n');
        console.log(list);

        fs.writeFileSync(`${path.resolve(__dirname, '../data')}/Companies_${moment().format('YYMMDD')}_2.csv`, list)

    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
})();

