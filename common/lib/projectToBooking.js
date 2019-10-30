'use strict';

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
    return {
        _id: update && typeof project._id === 'undefined' ? undefined : project._id,
        label: update && typeof project.name === 'undefined' ? undefined : project.name,
        producer: team.producer,
        manager: team.manager,
        supervisor: team.supervisor,
        lead2D: team.lead2D,
        lead3D: team.lead3D,
        leadMP: team.leadMP,
        created: update && typeof project.created === 'undefined' ? undefined : project.created,
        budget: update && typeof project.budget === 'undefined' ? undefined : project.budget && project.budget.booking ? project.budget.booking : null,
        K2rid: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.rid ? project.K2.rid : null,
        K2client: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.client ? project.K2.client : null,
        K2name: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.name ? project.K2.name : null,
        K2projectId: update && typeof project.K2 === 'undefined' ? undefined : project.K2 && project.K2.projectId ? project.K2.projectId : null,
        onair: update && typeof project.onair === 'undefined' ? undefined : project.onair,
        timing: update && typeof project.timing === 'undefined' ? undefined : project.timing && project.timing.length > 0 ? project.timing.map(t => ({type: t.type, date: t.date, dateTo: t.dateTo, text: t.label, category: t.category})) : [],
        invoice: update && typeof project.invoice === 'undefined' ? undefined : project.invoice,
        confirmed: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'CONFIRMED',
        internal: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'INTERNAL',
        rnd: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'RND',
        offtime: update && typeof project.bookingType === 'undefined' ? undefined : project.bookingType === 'OFFTIME',
        events: update && typeof project.events === 'undefined' ? undefined : project.events,
        jobs: update && typeof project.work === 'undefined' ? undefined : project.work && project.work.length > 0 ? project.work.map(w => ({job: w.type, plannedDuration: w.plannedDuration, doneDuration: w.doneDuration})) : [],
        bookingNotes: update && typeof project.bookingNote === 'undefined' ? undefined : project.bookingNote,
        kickBack: update && typeof project.kickBack === 'undefined' ? undefined : project.kickBack,
        version: update ? undefined : 2
    }
};