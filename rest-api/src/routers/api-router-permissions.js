'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const validateToken = require('../validateToken');
const authoriseApiAccess = require('./authoriseApiAccess');

const PERMISSIONS_ACCESS = ['permissions:full'];

module.exports = router;

// *********************************************************************************************************************
// GET
// *********************************************************************************************************************
router.get('/', [validateToken, authoriseApiAccess(PERMISSIONS_ACCESS)],  async (req, res, next) => {
    try {
        res.status(200).json({test: "TEST"});
    } catch(error) {
        next(error);
    }
});
