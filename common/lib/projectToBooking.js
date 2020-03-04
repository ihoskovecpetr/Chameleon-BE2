'use strict';

const TIMING = {
    GO_AHEAD: {id: 'GO_AHEAD', category: 101, label: 'Go Ahead'},
    PPM: {id: 'PPM', category: 102, label: 'PPM'},
    TRAVEL: {id: 'TRAVEL', category: 103, label: 'Travel'},
    RECCE: {id: 'RECCE', category: 104, label: 'Recce'},
    SHOOT: {id: 'SHOOT', category: 105, label: 'Shoot'},
    OFFLINE_APPROVAL: {id: 'OFFLINE_APPROVAL', category: 106, label: 'Offline Approval'},
    ONLINE_PRESENTATION: {id: 'ONLINE_PRESENTATION', category: 107, label: 'Online Presentation'},
    DELIVERY: {id: 'DELIVERY', category: 108, label: 'Delivery'},
    ON_AIR: {id: 'ON_AIR', category: 109, label: 'On Air'},
    GENERAL1: {id: 'GENERAL1', category: 1, label: ''},
    GENERAL2: {id: 'GENERAL2', category: 2, label: ''},
    GENERAL3: {id: 'GENERAL3', category: 3, label: ''}
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
    //const onair = update && (typeof project.timing === 'undefined' || project.timing.filter(t => t.type === TIMING.ON_AIR.id).length === 0) ? undefined : project.timing ? project.timing.filter(t => t.type === TIMING.ON_AIR.id) : [];
    //const timing = update && (typeof project.timing === 'undefined' || project.timing.filter(t => t.type !== TIMING.ON_AIR.id).length === 0) ? undefined : project.timing ? project.timing.filter(t => t.type !== TIMING.ON_AIR.id) : [];
    //const clipsMap = update && typeof project.clip === 'undefined' ? undefined : project.clip.reduce((o, c) => {o[c._id] = c.name; return o}, {});
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
        budget: update && typeof project.bookingBudget === 'undefined' ? undefined : project.bookingBudget,
        K2rid: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.rid ? project.K2.rid : null,
        K2client: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.client ? project.K2.client : null,
        K2name: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.name ? project.K2.name : null,
        K2projectId: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.projectId ? project.K2.projectId : null,
        onair: [],//onair ? onair.map(t => projectTimingToOnair(t, clipsMap)) : undefined,
        timing: [],//timing ? timing.map(t => projectTimingToTiming(t, clipsMap)) : undefined,
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

function projectTimingToTiming(timing, clipsMap) {
    const category = TIMING[timing.type] ? TIMING[timing.type].category : 1; //1,2,3,101,...

    const type = TIMING[timing.type] && TIMING[timing.type].label ? TIMING[timing.type].label : '';
    const clips = timing.clip && timing.clip.length > 0 ? timing.clip.map(c => clipsMap[c] || 'unknown clip') : [];
    const text = timing.text ? timing.text : '';

    return {
        date: timing.date,
        category: category,
        text: encodeTimingText(type, text, clips),
        type: timing.category, //UPP, CLIENT
    };
}

function projectTimingToOnair(timing, clipsMap) {
    const clips = timing.clip && timing.clip.length > 0 ? timing.clip.map(c => clipsMap[c] || 'unknown clip').join(' + ') : null;
        return {
        date: timing.date,
        state: timing.state,
        _id: timing._id,
        name: `${clips ? clips : TIMING.ON_AIR.label}`
    };
}

function encodeTimingText(type, text, clips) {
    //return `${type}${text ? type ? ` - ${text}` : text : ''}${clips && clips.length > 0 ? type || text ? ` [${clips.join(', ')}]` : clips.join(', ') : ''}`
    return `<${type}::${text}::${clips.join(':')}>`;
}