import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventGroupView from '../EventGroupView';

const group = (overrides = {}) => ({
  id: 1,
  name: 'Big Day',
  is_active: true,
  guide_token: 'tok',
  quick_edit_fields: ['driving'],
  checkpoint_labels: ['Check-in', 'At site'],
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
      attended: false, notes: '', extra_json: [{ driving: 'Yes' }], checkpoints: [],
    }],
  }],
  ...overrides,
});

const makeApi = (g) => ({
  load: vi.fn().mockResolvedValue(g),
  toggleCheckpoint: vi.fn().mockResolvedValue({ checkpoints: [{ 1: '2026-10-11T07:42:00+08:00' }], attended: true }),
  saveNotes: vi.fn(),
  setExtraField: vi.fn().mockResolvedValue({ extra_json: [{ driving: 'No' }] }),
  addParticipant: vi.fn().mockResolvedValue(g),
  updateGroup: vi.fn().mockResolvedValue({ quick_edit_fields: [], checkpoint_labels: ['Check-in', 'At site'] }),
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

  it('marks checkpoint 1 per person on the group page', async () => {
    const api = makeApi(group());
    renderView(api, 'guide');
    expect(await screen.findByRole('columnheader', { name: 'Check-in' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark' }));
    await waitFor(() => expect(api.toggleCheckpoint).toHaveBeenCalledWith(expect.objectContaining({ ep_id: 100 }), 0));
    expect(await screen.findByRole('button', { name: /✓/ })).toBeInTheDocument();
  });

  it('summarizes driving answers per site using the lead registrant of a party', async () => {
    const booking = (ep_id, name, quantity, extra_json) => ({
      ep_id, first_name: name, last_name: '', email: '', phone_number: '1', quantity,
      is_confirmed: true, is_cancelled: false, is_waitlisted: false,
      attended: false, notes: '', extra_json, checkpoints: [],
    });
    const g = group({
      quick_edit_fields: [],
      events: [
        { ...group().events[0], bookings: [
          booking(1, 'Lead', 3, [{ driving: 'Yes' }, { driving: 'No' }, { driving: 'No' }]),
          booking(2, 'Solo', 1, [{}]),
        ] },
        { ...group().events[0], id: 11, title: 'Site B', bookings: [booking(3, 'Bee', 1, [{ driving: 'No' }])] },
      ],
    });
    renderView(makeApi(g), 'console');
    fireEvent.click(await screen.findByRole('button', { name: /will you be driving\?/i, expanded: false }));
    const siteA = screen.getAllByRole('row').find(r => r.textContent.startsWith('Site A'));
    // Site A: Yes 1, No 0, Unsure 0, No answer 1, drivers "Lead"
    expect([...siteA.querySelectorAll('td')].map(td => td.textContent)).toEqual(['Site A', '1', '0', '0', '1', 'Lead']);
    const total = screen.getAllByRole('row').find(r => r.textContent.startsWith('Total'));
    expect([...total.querySelectorAll('td')].map(td => td.textContent).slice(0, 5)).toEqual(['Total', '1', '1', '0', '1']);
  });
});
