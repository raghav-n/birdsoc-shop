import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import EventGroupView from '../components/EventGroupView';
import { consoleEventService as svc } from '../services/consoleEvents';

export default function EventGroupDetail() {
  const { id } = useParams();
  const api = useMemo(() => ({
    load: () => svc.getGroup(id),
    toggleCheckpoint: (b, slot) => svc.toggleGroupCheckpoint(id, b.ep_id, { slot, checkpoint: 1 }),
    saveNotes: (b, notes) => svc.updateParticipant(b.event.id, b.ep_id, { notes }),
    setExtraField: (b, data) => svc.setGroupExtraField(id, b.ep_id, data),
    addParticipant: (data) => svc.addGroupParticipant(id, data),
    updateGroup: (data) => svc.updateGroup(id, data),
    regenerateGuideToken: () => svc.regenerateGroupGuideToken(id),
  }), [id]);
  return <EventGroupView api={api} mode="console" />;
}
