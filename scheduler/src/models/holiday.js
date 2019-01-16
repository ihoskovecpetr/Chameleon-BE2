const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HolidaySchema = new Schema({
    days:[String]
});

module.exports = mongoose.model('holiday', HolidaySchema);
