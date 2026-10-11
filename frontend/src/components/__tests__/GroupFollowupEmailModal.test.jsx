import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GroupFollowupEmailModal from '../GroupFollowupEmailModal';

const group = {
  id: 1,
  name: 'Big Day',
  events: [{ id: 10, title: 'Site A' }, { id: 11, title: 'Site B' }],
};

const recipients = (n) => Array.from({ length: n }, (_, i) => ({
  ep_id: i + 1, name: `P${i}`, email: `p${i}@x.com`, event_id: 10, event_title: 'Site A',
}));

const renderModal = (send, onClose = vi.fn()) => render(
  <GroupFollowupEmailModal group={group} send={send} checkInLabel="Check-in" onClose={onClose} />
);

describe('GroupFollowupEmailModal', () => {
  beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('loads recipients for the chosen sites and attendance filter', async () => {
    const send = vi.fn().mockResolvedValue({ recipients: recipients(3) });
    renderModal(send);
    expect(await screen.findByText('Send to 3 participants')).toBeInTheDocument();
    expect(send).toHaveBeenLastCalledWith({ dry_run: true, event_ids: [10, 11], attended_only: false });

    fireEvent.click(screen.getByRole('button', { name: /Site B/ }));
    await waitFor(() => expect(send).toHaveBeenLastCalledWith({ dry_run: true, event_ids: [10], attended_only: false }));

    fireEvent.click(screen.getByLabelText(/Only people marked at Check-in/));
    await waitFor(() => expect(send).toHaveBeenLastCalledWith({ dry_run: true, event_ids: [10], attended_only: true }));
  });

  it('sends in batches of 25 and closes when done', async () => {
    const send = vi.fn(async (data) => {
      if (data.dry_run) return { recipients: recipients(30) };
      return { sent: data.ep_ids.length, sent_ep_ids: data.ep_ids, failed: [] };
    });
    const onClose = vi.fn();
    renderModal(send, onClose);
    fireEvent.click(await screen.findByText('Send to 30 participants'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const batches = send.mock.calls.map(c => c[0]).filter(d => d.ep_ids);
    expect(batches.map(b => b.ep_ids.length)).toEqual([25, 5]);
    expect(batches[0].subject).toBe('Update about {{group_name}}');
  });

  it('resumes with only the unsent people after a failed batch', async () => {
    let calls = 0;
    const send = vi.fn(async (data) => {
      if (data.dry_run) return { recipients: recipients(30) };
      calls += 1;
      if (calls === 2) throw new Error('timeout');
      return { sent: data.ep_ids.length, sent_ep_ids: data.ep_ids, failed: [] };
    });
    renderModal(send);
    fireEvent.click(await screen.findByText('Send to 30 participants'));
    expect(await screen.findByText('Send to 5 participants')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Send to 5 participants'));
    await waitFor(() => expect(calls).toBe(3));
    expect(send.mock.calls.at(-1)[0].ep_ids).toEqual([26, 27, 28, 29, 30]);
  });
});
