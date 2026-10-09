import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventGroupView from '../EventGroupView';

const group = (overrides = {}) => ({
  id: 1,
  name: 'Big Day',
  is_active: true,
  guide_token: 'tok',
  quick_edit_fields: ['driving'],
  field_options: [
    { key: 'driving', title: 'Will you be driving?', type: 'string', enum: ['Yes', 'No', 'Unsure'] },
    { key: 'attended_before', title: 'I have attended this event before.', type: 'boolean', enum: null },
  ],
  allocations: [],
  events: [{
    id: 10,
    title: 'Site A',
    start_date: '2026-10-11T07:00:00+08:00',
    max_participants: 20,
    json_schema: null,
    bookings: [{
      ep_id: 100, first_name: 'Tan', last_name: 'Ah Kow', email: '', phone_number: '9123',
      quantity: 1, is_confirmed: true, is_cancelled: false, is_waitlisted: false,
      attended: false, notes: '', extra_json: [{ driving: 'Yes' }],
    }],
  }],
  ...overrides,
});

const makeApi = (g) => ({
  load: vi.fn().mockResolvedValue(g),
  toggleAttendance: vi.fn(),
  saveNotes: vi.fn(),
  setExtraField: vi.fn().mockResolvedValue({ extra_json: [{ driving: 'No' }] }),
  addParticipant: vi.fn().mockResolvedValue(g),
  setQuickEditFields: vi.fn().mockResolvedValue({ quick_edit_fields: [] }),
  regenerateGuideToken: vi.fn(),
});

const renderView = (api, mode) => render(
  <MemoryRouter><EventGroupView api={api} mode={mode} /></MemoryRouter>
);

describe('EventGroupView', () => {
  it('shows quick-edit fields as editable columns and saves changes', async () => {
    const api = makeApi(group());
    renderView(api, 'console');
    const select = await screen.findByDisplayValue('Yes');
    expect(screen.getByRole('columnheader', { name: 'Will you be driving?' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'No' } });
    await waitFor(() => expect(api.setExtraField).toHaveBeenCalledWith(
      expect.objectContaining({ ep_id: 100 }), { slot: 0, key: 'driving', value: 'No' },
    ));
  });

  it('adds a participant with just a name and phone', async () => {
    const api = makeApi(group());
    renderView(api, 'console');
    fireEvent.click(await screen.findByRole('button', { name: /add participant/i }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Walk In' } });
    fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '8888' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.addParticipant).toHaveBeenCalledWith(expect.objectContaining({
      event_id: 10, name: 'Walk In', phone_number: '8888', email: '',
    })));
  });

  it('hides the console-only controls on the guide link', async () => {
    const api = makeApi(group());
    renderView(api, 'guide');
    expect(await screen.findByText('Guide access')).toBeInTheDocument();
    expect(screen.queryByText('Quick-edit fields')).not.toBeInTheDocument();
    expect(screen.queryByText('Guide link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add participant/i })).toBeInTheDocument();
  });
});
