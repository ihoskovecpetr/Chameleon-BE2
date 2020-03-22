'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const HistoryPlugin = require('../mongoHistoryPlugin');

const ProjectSchema = new Schema({
    projectId: {type: String, unique: true, required: true},
    name: {type: String, required: true},
    alias: {type: String, default: ''},
    lastContact: {type: Date, default: null},
    inquired: {type: Date, default: null},
    team: [{
        id: {type: Schema.Types.ObjectId, ref: 'user', required: true},
        role: [{type: String}],
        _id: false
    }],
    person: [{
        id: {type: Schema.Types.ObjectId, ref: 'contact-person', required: true},
        profession: [{type: String}],
        company: {type: Schema.Types.ObjectId, ref: 'contact-company', default: null},
        flag: [{type: String}],
        note: {type: String, default: ''},
        _id: false
    }],
    company: [{
        id: {type: Schema.Types.ObjectId, ref: 'contact-company', required: true},
        business: [{type: String}],
        flag: [{type: String}],
        note: {type: String, default: ''},
        _id: false
    }],
    project: [{
        id: {type: Schema.Types.ObjectId, ref: 'project', required: true},
        relation: [{type: String}],
        note: {type: String, default: ''},
        _id: false
    }],
    status: {type: String, required: true},
    statusNote: {type: String, default: ''},
    booking: {type: Boolean, default: false},
    bookingId: {type: Schema.Types.ObjectId, ref: 'booking-project', default: null},
    bookingBudget: {type: Schema.Types.ObjectId, ref: 'budget', default: null},
    clientBudget: {type: Schema.Types.ObjectId, ref: 'budget', default: null},
    sentBudget: [{type: Schema.Types.ObjectId, ref: 'budget'}],
    ballpark: {
        currency: {type: String, default: 'eur'},
        from: {type: Number, default: 0},
        to: {type: Number, default: 0}
    },
    projectNote: {type: String, default: ''},
    story: {type: String, default: ''},
    content: [{type: String}],
    category: [{type: String}],
    vipTag: [{type: String}],
    vipTagNote: {type: String, default: ''},
    K2: {
        rid: {type: String, default: null},
        client: {type: String, default: null},
        name: {type: String, default: null},
        projectId: {type: String, default: null}
    },
    invoice: [{
        date: {type: Date, default: null},
        name: {type: String, default: null},
        _id: false
    }],
    timingClient: [{
        type: {type: String, default: 'GENERAL'}, //id of timing
        subType: {type: Number, default: 1},
        date: Date,
        text: {type: String, default: ''},
        clip: [{type: Schema.Types.ObjectId, ref: 'project.clip'}], // clip._id
        _id: false
    }],
    timingUpp: [{
        type: {type: String, default: 'GENERAL'}, //id of timing
        subType: {type: Number, default: 1},
        date: Date,
        text: {type: String, default: ''},
        clip: [{type: Schema.Types.ObjectId, ref: 'project.clip'}], // clip._id
        _id: false
    }],
    clip: [{
        name: {type: String, default: ''},
        onair: {type: Date, default: null},
        state: {type: String, default: ''} //free, used, deleted, disabled - for onair
    }],
    paymentChecked: {type: Date, default: null},
    deleted: {type: Date, default: null},
    archived: {type: Date, default: null},
    bookingType: {type: String, default: 'UNCONFIRMED'},
    events: [{type: Schema.Types.ObjectId, ref: 'booking-event'}],
    work: [{
        type: {type: Schema.Types.ObjectId, ref: 'booking-work-type'},
        plannedDuration: {type: Number, default : 0},
        doneDuration: {type: Number, default : 0},
        _id: false
    }],
    bookingNote: {type: String, default: ''},
    kickBack: {type: Boolean, default: false},
    __v: { type: Number, select: false}
}, {timestamps : {createdAt: 'created', updatedAt: 'updated'}});


ProjectSchema.virtual('_user').set(function(v) {this.__user = v});
ProjectSchema.plugin(HistoryPlugin());

module.exports = mongoose.model('project', ProjectSchema);