'use strict';

const logger = require('../../src/logger');

const TIMING = {
    GO_AHEAD: {id: 'GO_AHEAD', category: 101, label: 'Go Ahead'},
    PPM: {id: 'PPM', category: 102, label: 'PPM'},
    TRAVEL: {id: 'TRAVEL', category: 103, label: 'Travel'},
    RECCE: {id: 'RECCE', category: 104, label: 'Recce'},
    SHOOT: {id: 'SHOOT', category: 105, label: 'Shoot'},
    EDL: {id: 'EDL', category: 106, label: 'EDL Technical Check'},
    OFFLINE: {id: 'OFFLINE', category: 107, label: 'Offline Approval'},
    ONLINE: {id: 'ONLINE', category: 108, label: 'Online Presentation'},
    DELIVERY: {id: 'DELIVERY', category: 108, label: 'Delivery'}
};

module.exports = (project, update) => {
    if(!project) return null;
    if(project.toJSON) project = project.toJSON();
    const team = {
        producer: update ? undefined : null,
        manager: update ? undefined : null,
        supervisor: update ? undefined : null,
        lead2D: update ? undefined : null,
        lead3D: update ? undefined : null,
        leadMP: update ? undefined : null
    };
    if(project.team && project.team.length > 0) {
        for(const teamMember of project.team) {
            for(const role of teamMember.role) {
                switch (role) {
                    case 'PRODUCER':
                        if(!team.producer) team.producer = teamMember.id;
                        break;
                    case 'MANAGER':
                        if(!team.manager) team.manager = teamMember.id;
                        break;
                    case 'SUPERVISOR':
                        if(!team.supervisor) team.supervisor = teamMember.id;
                        break;
                    case 'LEAD_2D':
                        if(!team.lead2D) team.lead2D = teamMember.id;
                        break;
                    case 'LEAD_3D':
                        if(!team.lead3D) team.lead3D = teamMember.id;
                        break;
                    case 'LEAD_MP':
                        if(!team.leadMP) team.leadMP = teamMember.id;
                        break;
                }
            }
        }
    }

    const clipsMap = typeof project.clip === 'undefined' ? undefined : project.clip.reduce((out, clip) => {out[clip._id] = clip.name; return out}, {}); //clip id to name

    const timing = update && project.timingClient === 'undefined' && project.timingUpp === 'undefined' ? undefined : [];

    if(timing && project.timingClient) {
        project.timingClient.forEach(clientTiming => {
            timing.push({
                date: clientTiming.date,
                type: 'CLIENT',
                text: encodeTimingText(clientTiming, clipsMap),
                category: clientTiming.type !== 'GENERAL' ? TIMING[clientTiming.type] ? TIMING[clientTiming.type].category : 100 : clientTiming.subType,
                _id: clientTiming._id
            });
        });
    }
    if(timing && project.timingUpp) {
        project.timingUpp.forEach(uppTiming => {
            timing.push({
                date: uppTiming.date,
                type: 'UPP',
                text: encodeTimingText(uppTiming, clipsMap),
                category: uppTiming.type !== 'GENERAL' ? TIMING[uppTiming.type] ? TIMING[uppTiming.type].category : 100 : uppTiming.subType,
                _id: uppTiming._id
            });
        });
    }
    let onair = typeof project.clip === 'undefined' ? undefined : project.clip.filter(clip => clip.state !== 'disabled');
    if(onair) {
        if(onair.length === 0) onair = [{name: null, date: null, state: "free", _id: 1}]; //_id: 1 is ok, it will never be saved from booking
        else onair = onair.map(clip => ({name: clip.name, date: clip.onair, state: clip.state, _id: clip._id}));
    }
    const out = {
        _id: update && typeof project._id === 'undefined' ? undefined : project._id,
        label: update && typeof project.name === 'undefined' ? undefined : project.name,
        producer: team.producer,
        manager: team.manager,
        supervisor: team.supervisor,
        lead2D: team.lead2D,
        lead3D: team.lead3D,
        leadMP: team.leadMP,
        created: update && typeof project.created === 'undefined' ? undefined : project.created,

        budget: update && typeof project.bookingBudget === 'undefined' ? undefined : project.bookingBudget ? project.bookingBudget._id ? project.bookingBudget._id : project.bookingBudget : null,

        K2rid: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.rid ? project.K2.rid : null,
        K2client: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.client ? project.K2.client : null,
        K2name: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.name ? project.K2.name : null,
        K2projectId: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.projectId ? project.K2.projectId : null,
        onair: onair,
        timingClient: update && typeof project.timingClient === 'undefined' ? undefined : project.timingClient,
        timingUpp: update && typeof project.timingUpp === 'undefined' ? undefined : project.timingUpp,
        timing: timing ? timing : undefined,
        invoice: update && typeof project.invoice === 'undefined' ? undefined : project.invoice,
        confirmed: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'CONFIRMED',
        internal: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'INTERNAL',
        rnd: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'RND',
        offtime: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'OFFTIME',
        events: update && typeof project.events === 'undefined' ? undefined : project.events,
        jobs: update && typeof project.work === 'undefined' ? undefined : project.work && project.work.length > 0 ? project.work.map(w => ({job: w.type, plannedDuration: w.plannedDuration, doneDuration: w.doneDuration})) : [],
        bookingNotes: update && typeof project.bookingNote === 'undefined' ? undefined : project.bookingNote,
        kickBack: update && typeof project.kickBack === 'undefined' ? undefined : project.kickBack,
        checked: update && typeof project.paymentChecked === 'undefined' ? undefined : project.paymentChecked,
        version: 2
    };
    if(update) {
        for(const key in out) {
            if(out[key] === undefined) delete out[key];
        }
    }
    return out;
};

function encodeTimingText(timing, clipsMap) {
    const type = timing.type !== 'GENERAL' && TIMING[timing.type] ? TIMING[timing.type].label  : '';
    const text = timing.text && timing.text.trim() ? timing.text.trim() : '';
    const clip = timing.clip && timing.clip.length > 0 ? timing.clip.filter(clipId => clipsMap[clipId]).map(clipId => clipsMap[clipId]).join(', ') : null;
    return `${type}${type && text ? ' - ' : ''}${text}${clip ? `[${clip}]` : ''}`
}

