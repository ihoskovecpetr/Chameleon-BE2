'use strict';
// const mongoose = require('mongoose');
// const nanoid = require('nanoid/generate');
// const NANOID_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';
// const NANOID_LENGTH = 10;

//Collections
const User = require('../../_common/models/user');
const Project = require('../../_common/models/project');
const BookingProject = require('../../_common/models/booking-project');
const Person = require('../../_common/models/contact-person');
const Company = require('../../_common/models/contact-company');
const BookingEvent = require('../../_common/models/booking-event');
const BookingResource = require('../../_common/models/booking-resource');

// *******************************************************************************************
// PROJECTS CRUD
// *******************************************************************************************

exports.getK2Projects = async () => {
    const projects = []
    projects.push(Project.find({deleted: null, archived: null, K2: { $ne: null }},{__v: false}).lean().populate({path: 'person.id company.id', select: 'name'})); //{path: 'person', populate: {path: 'company', select: 'name'}}
    projects.push(BookingProject.find({deleted: null, archived: false, mergedToProject: null,  K2name: { $ne: null }, K2projectId: { $ne: null }  },{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false, checked: false, mergedToProject: false }).lean());
    // const histories = await Promise.all(projects.map(project => Project.getHistory(project._id, '/name', {unique: true, limit: 3})));
    // const result = await BookingProject.find({deleted: null, archived: false, mergedToProject: null,  K2name: { $ne: null } },{__v: false, 'jobs.__v': false, 'jobs._id': false, 'timing.__v': false, 'timing._id': false, 'invoice.__v': false, 'invoice._id': false, 'onair.__v': false, deleted: false, archived: false, checked: false, mergedToProject: false }).lean()
    

    function formateK2results(projects){
        return projects.map(project => {
            if(project.K2name){
              return project
            }else{
              return {...project,
                "K2rid": project.K2.rid,
                "K2client": project.K2.client,
                "K2name": project.K2.name,
                "K2projectId": project.K2.projectId,
                }
            }
          })
    }
    console.time("DB")
    return Promise.all(projects).then((values) => {
        console.log("GOT ALL PROJECTS: ", values[0].length, values[1].length)
        let projects = values[0].concat(values[1])
        const result = formateK2results(projects)
        console.timeEnd("DB")
        return result
      }).catch(err => {
        console.log("NOT All Promisses SPAWNING resolved,", err)
        return err
    });
    // return projects.map((project, i) => {
    //     project.$name = histories[i];
    //     return project;
    // });
};

exports.getProjects = async () => {
    const projects = await Project.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(projects.map(project => Project.getHistory(project._id, '/name', {unique: true, limit: 3})));
    return projects.map((project, i) => {
        project.$name = histories[i];
        return project;
    });
};


exports.updateProject = async (id, projectData, user) => {
    projectData._user = user;
    const project = await Project.findOneAndUpdate({_id: id}, projectData, {new: true});
    const result = project.toJSON();
    delete result.__v;
    result.$name = await Project.getHistory(project._id, '/name', {unique: true, limit: 3});
    return result;
};

exports.removeProject = async (id, user) => {
    await Project.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
};

// *******************************************************************************************
// PERSONS CRUD
// *******************************************************************************************
exports.createPerson = async (personData, user) => {
    personData._user = user;
    const person = await Person.create(personData);
    if(person.company && person.company.length > 0) await Company.update({_id: {$in: person.company}}, {$push: {person: person._id}}, {multi: true});
    const result = person.toObject();
    delete result.__v;
    return result;
};

exports.getPersons = async () => {
    const persons = await Person.find({deleted: null, archived: null},{__v: false}).lean();
    const histories = await Promise.all(persons.map(person => Person.getHistory(person._id, '/name', {unique: true, limit: 3})));
    return persons.map((person, i) => {
        person.$name = histories[i];
        return person;
    });
};

// exports.updatePerson = async (id, personData, user) => {
//     personData._user = user;
//     const person = await Person.findOneAndUpdate({_id: id}, personData);
//     if(personData.company) {
//         const oldCompany = person.company.map(company => company.toString());
//         const newCompany = personData.company;
//         const addTo = newCompany.filter(company => oldCompany.indexOf(company) < 0);
//         const removeFrom = oldCompany.filter(company => newCompany.indexOf(company) < 0);
//         if(addTo.length > 0) await Company.update({_id: {$in: addTo}}, {$push: {person: id}}, {multi: true});
//         if(removeFrom.length > 0) await Company.update({_id: {$in: removeFrom}}, {$pull: {person: id}}, {multi: true});
//     }
//     const result = person.toJSON();
//     delete result.__v;
//     Object.assign(result, personData);
//     result.$name = await Person.getHistory(person._id, '/name', {unique: true, limit: 3});
//     return result;
// };

// exports.removePerson = async (id, user) => {
//     await Person.findOneAndUpdate({_id: id}, {deleted: new Date(), _user: user});
//     await Company.update({person: id}, {$pull: {person: id}}, {multiple: true});
// };


// *******************************************************************************************
// UPP USERS - role, name, uid
// *******************************************************************************************
exports.getAllActiveUsers = async () => {

    const result = await User.find({}, {role: true, name: true, ssoId: true, resource: true, access: true}).lean()
    return result

};

exports.getUsersByRole = async (rolesArr) => {

    console.log("ERT: ", rolesArr)
    let promissses = []
    rolesArr.map(role => {
        promissses.push(User.find({role: `booking:${role}`}, {role: true, name: true, ssoId: true, resource: true, access: true}).lean())
    })

///ZDEEE
    return Promise.all(promissses).then((values) => {
        console.log("GOT ALL ROLES: ", values.length)
        let resultArr = []
        resultArr = resultArr.concat(...values)
        return resultArr
      }).catch(err => {
        console.log("DID NOT GET All ROLES,", err)
        return err
    });

    // return await User.find({role: `booking:${role}`}, {role: true, name: true, ssoId: true}).lean(); //role: "booking:3D"
};



exports.getOneUser = async (id) => {
    try{
          console.log("FindById id ", id, typeof id)
    const person = await User.find({_id: id}).lean();
    console.log("Got one person: ", person.length, id)
    const histories = await Promise.all(person.map(person => Person.getHistory(person._id, '/name', {unique: true, limit: 3})));
    return person.map((personOne, i) => {
        personOne.$name = histories[i];
        return personOne;
    });  
    }catch(err){
        console.log("ERR: ", err)
    }

};


// *******************************************************************************************
// BOOKING EVENTS CRUD
// *******************************************************************************************

exports.getBookingEventsUsers = async (_id) => {
    try{
        console.log("FInd EVENTS FOR Booking _id new ", _id, typeof _id)

        const bookingEvents = await BookingEvent.find({project: _id},{project:true, job: true, operator: true}).lean().populate({path: 'job', select: 'type'});
        
        //odstranit duplicity
        let eventsObj = {} 
        bookingEvents.map(event => {
            if(eventsObj[event.operator]){
                if(event.job && event.job.type && eventsObj[event.operator].indexOf(event.job.type) === -1) {  // this makes sure no item is 2x in arr
                    eventsObj[event.operator].push(event.job ? event.job.type : null)
                }
            }else{
                if(event.operator){
                    eventsObj[event.operator] = [event.job ? event.job.type : null]
                } 
            }
        })
        console.log("ROZTRIDENY obj: ", eventsObj)
        return eventsObj
    }catch(err){
        console.log("ERR: ", err)
    }
};

// *******************************************************************************************
// BOOKING PROJECTS CRUD
// *******************************************************************************************

exports.getBookingProjectsCast = async (k2projectId) => {
    try{
        console.log("FInd getBookingProjectsCast FOR Booking k2projectId new ", k2projectId, typeof k2projectId)

        // const bookingEvents = await BookingEvent.find({project: _id},{project:true, job: true, operator: true}).lean().populate({path: 'job', select: 'type'});
        const bookingBosses = await BookingProject.find({K2projectId: k2projectId},{manager:true, supervisor: true, lead3D: true, lead2D: true, leadMP: true}).lean(); // .populate({path: 'manager', select: 'type'});
        console.log("Got bookingBosses: ", bookingBosses)
        
        //odstranit duplicity
        let ManagersObj = {} 
        let formKey
        Object.keys(bookingBosses[0]).map(key => {
            switch(key){
                case 'manager':
                    formKey = 'MA' 
                    break;
                case 'supervisor':
                    formKey = 'SV' 
                    break;
                  default:
                    formKey = key 
            }
            console.log("Iterace: bookingBosses: ", key, formKey, bookingBosses[0][key])
            if(ManagersObj[bookingBosses[0][key]]){
                ManagersObj[bookingBosses[0][key]].push(formKey)
            }else{
                ManagersObj[bookingBosses[0][key]] = [formKey]
            }
        })
        console.log("ROZTRIDENY ManagersObj: ", ManagersObj)
        return ManagersObj
    }catch(err){
        console.log("ERR: ", err)
    }
};