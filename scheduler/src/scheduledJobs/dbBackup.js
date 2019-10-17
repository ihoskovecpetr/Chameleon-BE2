'use strict';

const path = require('path');
const fs = require('fs-extra');
const logger = require('../logger');
const db = require('../dbData/mongoDbData');

const exportXLS = require('../exportXLS');
const BACKUP_FILE_NAME_BASE = 'booking_backup';
const BACKUP_PATH = '../../data-backups';

module.exports = async () => {
    logger.debug('DB Backup Job Fired');
    try {
        const groups = await db.getResourceGroups();
        const resources = await db.getResources();
        const projects = await db.getProjects();
        const events = await db.getEvents();
        const jobs = await db.getJobs();
        const users = await db.getUsers();
        const now = new Date();
        const backupName = BACKUP_FILE_NAME_BASE + '_' + getDateString(now) + '.json';
        const backupPath = path.join(__dirname, BACKUP_PATH, backupName);
        const backupXLSName = BACKUP_FILE_NAME_BASE + '_' + getDateString(now) + '.xlsx';
        const backupXLSPath = path.join(__dirname, BACKUP_PATH, backupXLSName);
        const data = {
            timestamp: now.toString(),
            data: {groups, resources, projects, events, jobs, users}
        };
        try {
            logger.info("Writing backup to: " + backupPath);
            await fs.outputJson(backupPath, data);
        } catch (e) {
            logger.warn(`dbBackup Json Error: ${e}`);
        }
        try {
            logger.info("Writing XLSX backup to: " + backupXLSPath);
            await exportXLS(backupXLSPath, data);
        } catch (e) {
            logger.warn(`dbBackup XLSX Error: ${e}`);
        }
        try {
            const jsonFiles = await fs.readdir(path.join(__dirname, BACKUP_PATH));
            const re = new RegExp('^' + BACKUP_FILE_NAME_BASE + '_(\\d{2}_\\d{2}_\\d{4}).json$');
            const datesToDelete = jsonFiles.map(file => {
                const reExec = re.exec(file);
                if (Array.isArray(reExec) && reExec[1]) {
                    return reExec[1];
                } else return null;
            }).filter(file => file !== null).sort((a, b) => {
                a = a.split('_');
                b = b.split('_');
                a = parseInt(a[2] + a[1] + a[0]);
                b = parseInt(b[2] + b[1] + b[0]);
                return b - a;
            });
            if(datesToDelete.length > 10) {
                for (let i = 10; i < datesToDelete.length; i++) {
                    const fileName = BACKUP_FILE_NAME_BASE + '_' + datesToDelete[i] + '.json';
                    const fileXLSName = BACKUP_FILE_NAME_BASE + '_' + datesToDelete[i] + '.xlsx';
                    const filePath = path.join(__dirname, BACKUP_PATH, fileName);
                    const fileXLSPath = path.join(__dirname, BACKUP_PATH, fileXLSName);
                    try {
                        logger.info("Deleting old backup file: " + fileName);
                        await fs.remove(filePath);
                    } catch (e) {
                        logger.warn(`Can't delete backup file: ${filePath}, Error: ${e}`);
                    }
                    try {
                        logger.info("Deleting old XLS backup file: " + fileXLSName);
                        await fs.remove(fileXLSPath);
                    } catch (e) {
                        logger.warn(`Can't delete XLS backup file: ${fileXLSPath}, Error: ${e}`);
                    }
                }
            }
        } catch (e) {
            logger.warn(`Can't clean up backup folder ${path.join(__dirname, BACKUP_PATH)}, Error: ${e}`);
        }
    } catch (e) {
        logger.warn(`dbBackup Error: ${e}`);
    }
};

function getDateString(date) {
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    month = month < 10 ? '0' + month : month + '';
    let day = date.getDate();
    day = day < 10 ? '0' + day : day + '';
    return day + '_' + month + '_' + year;
}