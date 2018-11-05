const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-project');
//const dbCommon = require(('../mongodb-data'));
const logger = require('../logger');
const validateToken = require('../validateToken');

module.exports = router;

const ROLE_HIERARCHY = ['booking:admin', 'booking:main-producer', ''];

// *********************************************************************************************************************
// PROJECTS CRUD
// *********************************************************************************************************************
router.post('/projects', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const projectData = req.body;
        const project = await db.createProject(projectData, req.remote_user);
        res.status(200).json(project);
    } catch (e) {
        next(e);
    }
});

router.get('/projects', [validateToken, authorizeApiAccess('')],  async (req, res, next) => {
    try {
        const projects = await db.getProjects();
        res.status(200).json(projects);
    } catch(e) {
        next(e);
    }
});

router.put('/projects/:id', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const projectData = req.body;
        if(!id || !projectData || (projectData._id && projectData._id !== id)) {
            next(new Error('Wrong or mismatched project id.'));
        } else {
            const project = await db.updateProject(id, projectData, req.remote_user);
            res.status(200).json(project);
        }
    } catch (e) {
        next(e);
    }
});

router.delete('/projects/:id', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            next(new Error('Wrong or mismatched project id.'));
        } else {
            await db.removeProject(id, req.remote_user);
            res.status(200).end();
        }
    } catch (e) {
        next(e);
    }
});

// *********************************************************************************************************************
// PERSONS CRUD
// *********************************************************************************************************************
router.post('/persons', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const personData = req.body;
        const person = await db.createPerson(personData, req.remote_user);
        res.status(200).json(person);
    } catch (e) {
        next(e);
    }
});

router.get('/persons', [validateToken, authorizeApiAccess('')],  async (req, res, next) => {
    try {
        const persons = await db.getPersons();
        res.status(200).json(persons);
    } catch(e) {
        next(e);
    }
});

router.put('/persons/:id', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const personData = req.body;
        if(!id || !personData || (personData._id && personData._id !== id)) {
            next(new Error('Wrong or mismatched project id.'));
        } else {
            const person = await db.updatePerson(id, personData, req.remote_user);
            res.status(200).json(person);
        }
    } catch (e) {
        next(e);
    }
});

router.delete('/persons/:id', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            next(new Error('Wrong or mismatched project id.'));
        } else {
            await db.removePerson(id, req.remote_user);
            res.status(200).end();
        }
    } catch (e) {
        next(e);
    }
});
// *********************************************************************************************************************
// COMPANIES CRUD
// *********************************************************************************************************************
router.post('/companies', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const companyData = req.body;
        const company = await db.createCompany(companyData, req.remote_user);
        res.status(200).json(company);
    } catch (e) {
        next(e);
    }
});

router.get('/companies', [validateToken, authorizeApiAccess('')],  async (req, res, next) => {
    try {
        const companies = await db.getCompanies();
        res.status(200).json(companies);
    } catch(e) {
        next(e);
    }
});

router.put('/companies/:id', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        const companyData = req.body;
        if(!id || !companyData || (companyData._id && companyData._id !== id)) {
            next(new Error('Wrong or mismatched project id.'));
        } else {
            const company = await db.updateCompany(id, companyData, req.remote_user);
            res.status(200).json(company);
        }
    } catch (e) {
        next(e);
    }
});

router.delete('/companies/:id', [validateToken, authorizeApiAccess('')], async (req, res, next) => {
    try {
        const id = req.params.id && mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null;
        if(!id) {
            next(new Error('Wrong or mismatched project id.'));
        } else {
            await db.removeCompany(id, req.remote_user);
            res.status(200).end();
        }
    } catch (e) {
        next(e);
    }
});

// *********************************************************************************************************************
// USERS _R__
// *********************************************************************************************************************
router.get('/users', [validateToken, authorizeApiAccess('')],  async (req, res, next) => {
    try {
        const users = await db.getUsers();
        res.status(200).json(users);
    } catch(e) {
        next(e);
    }
});

// *********************************************************************************************************************
// AUTHORIZE API ACCESS
// *********************************************************************************************************************
function authorizeApiAccess(role) {
    return function(req, res, next) {
        next();
        return;
        const roleHierarchyIndex = ROLE_HIERARCHY.indexOf(role);
        const user = req.headers['remote_user'] || req.remote_user; //TODO remove this
        if(!user || roleHierarchyIndex < 0 ) {
            res.status(403).json({error: 'Unauthorized! Access Forbidden.'});
        } else {
            const roleHierarchy = ROLE_HIERARCHY.slice(0, roleHierarchyIndex + 1);
            /*dbCommon.getUserBySsoId(user).then(userIds => {
                const hasRole = role === '' || roleHierarchy.some(access => userIds.role.indexOf(access) >= 0);
                if(hasRole) {
                    req.remote_user = user;
                    next();
                }
                else res.status(403).json({error: 'Unauthorized! Access Forbidden.'});
            }, () => res.status(403).json({error: 'Unauthorized! Access Forbidden.'}));*/
        }
    };
}
// *********************************************************************************************************************
// API REQUEST ERROR HANDLING
// *********************************************************************************************************************
router.use(function (err, req, res, next) {
    delete err.stack;
    logger.error(err);
    let statusCode = err.statusCode || 500;
    res.status(statusCode).json({error: `${err}`});
});
