const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PusherGroupSchema = new Schema({
    label: String,
    owner: {type: Schema.Types.ObjectId, ref: 'user', default: null},
    members: [{type: Schema.Types.ObjectId, ref: 'user'}],
    __v: { type: Number, select: false}
});

module.exports = mongoose.model('pusher-group', PusherGroupSchema);
