const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HolidaySchema = new Schema({
    days:[String],
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('holiday', HolidaySchema);
