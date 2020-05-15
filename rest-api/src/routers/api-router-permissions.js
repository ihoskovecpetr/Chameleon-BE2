'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../dbData/mongoDb-permissions');
const ad = require('../dbData/ADdata');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const PERMISSIONS_ACCESS = ['permissions:full'];

module.exports = router;


// *********************************************************************************************************************
// PROJECTS CRUD
// *********************************************************************************************************************
router.get('/k2_projects', [validateToken,  authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    try {
        console.log("Hitting K2 Projects endpoint")
        const result = await db.getK2Projects();
        console.log("result: ", result.length)
        res.status(200).json(result);
    } catch(error) {
        next(error);
    }
});

// router.get('/', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
//     try {
//         const result = await db.getProjects();
//         res.status(200).json(result);
//     } catch(error) {
//         next(error);
//     }
// });


// *********************************************************************************************************************
// UPP USERS -R-- (role, name, uid)
// *********************************************************************************************************************
router.get('/users/role', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    try {
        const users = await db.getUsersRole();
        res.status(200).json(users);
    } catch(error) {
        next(error);
    }
});

router.post('/users/by_role', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    console.log(`hitting users/by_role >>>>>>> req.body ${JSON.stringify(req.body, undefined, 2)}`);
    console.log(`hitting users/by_role >>>>>>> req.body ${JSON.stringify(req.body, undefined, 2)}`);
    try {
        const users = await db.getUsersByRole(req.body.rolesArr);
        res.status(200).json(users);
    } catch(error) {
        next(error);
    }
});

// *********************************************************************************************************************
// AD ldap
// *********************************************************************************************************************
router.get('/my_groups', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    console.log("Hitting My GROUPS")
    try {
        const result = await ad.getOwnGroups();
        res.status(200).json(result);
    } catch(error) {
        next(error);
    }
});

router.post('/group_members', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    try {
        const result = await ad.getGroupMembers(req.body.name);
        res.status(200).json(result); 
         
    } catch(error) {
        next(error);
    }
});

router.post('/groups_members', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    console.log("Hitting  ./groups_members")
    try {
        const result = await ad.getGroupsMembers(req.body.namesArr);

            res.status(200).json(result); 
 
    } catch(error) {
        next(error);
    }
});

router.post('/project/groups_with_members', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    console.log("Hitting  ./project/groups_with_members: ", req.body.project_name)
    try {
        const result_project_groups = await ad.getProjectGroups(req.body.project_name)
        const arrOfGroupnames = result_project_groups.map(item => item.sAMAccountName)

        const result = await ad.getGroupsMembers(arrOfGroupnames);
        console.log("groups: ", arrOfGroupnames)
        res.status(200).json(result); 
 
    } catch(error) {
        next(error);
    }
});

router.post('/add_members', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {

    console.log("Hitting add_members req.body: ", req.body.group, req.body.usersArr)

    try {
        const result = await ad.addGroupMembers(req.body.group, req.body.usersArr);
        res.status(200).json(result);  
    } catch(error) {
        next(error);
    }
});

router.post('/remove_member', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {

    console.log("Hitting remove_members req.body: ", req.body.group, req.body.user)

    try {
        const result = await ad.removeGroupMembers(req.body.group, req.body.user);
        res.status(200).json(result);  
    } catch(error) {
        next(error);
    }
});

//SAVE

router.post('/save/:group_name', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    console.log("Hitting  ./save/:group_name  payload: ", req.params.group_name, req.body.users)
    try {
        const result = await ad.saveNewGroupMembers(req.params.group_name, req.body.users);
        res.status(200).json(result);  
    } catch(error) {
        next(error);
    }
});



