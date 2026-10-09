import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import EventGroupView from '../components/EventGroupView';
import { groupGuideService as svc } from '../services/consoleEvents';

export default function GuideEventGroupDetail() {
  const { token } = useParams();
  const api = useMemo(() => ({
    load: () => svc.getGroup(token),
    toggleCheckpoint: (b, slot) => svc.toggleCheckpoint(token, b.ep_id, slot),
    saveNotes: (b, notes) => svc.updateNotes(token, b.ep_id, notes),
    setExtraField: (b, data) => svc.setExtraField(token, b.ep_id, data),
    addParticipant: (data) => svc.addParticipant(token, data),
  }), [token]);
  return <EventGroupView api={api} mode="guide" />;
}
