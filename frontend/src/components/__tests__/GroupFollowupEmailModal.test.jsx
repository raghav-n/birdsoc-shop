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

  // Fake server: logs each send per follow-up email and leaves logged people out of dry runs.
  const fakeServer = (n, { failOnCall } = {}) => {
    const people = recipients(n);
    const logged = new Set();
    let sendCalls = 0;
    const send = vi.fn(async (data) => {
      const skip = new Set((data.skip_emails || '').split(/[\s,]+/).filter(Boolean));
      const pending = people.filter(p => !logged.has(p.ep_id) && !skip.has(p.email));
      if (data.dry_run) return { recipients: pending, already_sent: logged.size, skipped: n - logged.size - pending.length };
      sendCalls += 1;
      if (sendCalls === failOnCall) {
        logged.add(data.ep_ids[0]); // server got one out before the request died
        throw new Error('timeout');
      }
      const sent = data.ep_ids.filter(id => pending.some(p => p.ep_id === id));
      sent.forEach(id => logged.add(id));
      return { followup_id: 7, sent: sent.length, sent_ep_ids: sent, failed: [] };
    });
    return { send, logged, batches: () => send.mock.calls.map(c => c[0]).filter(d => d.ep_ids) };
  };

  it('sends in batches of 5, reusing the follow-up id, and closes when done', async () => {
    const server = fakeServer(12);
    const onClose = vi.fn();
    const onSent = vi.fn();
    renderModal(server.send, onClose);
    fireEvent.click(await screen.findByText('Send to 12 participants'));
    await waitFor(() => expect(server.logged.size).toBe(12));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const batches = server.batches();
    expect(batches.map(b => b.ep_ids.length)).toEqual([5, 5, 2]);
    expect(batches[0].followup_id).toBeUndefined();
    expect(batches.slice(1).every(b => b.followup_id === 7)).toBe(true);
  });

  it('after a failed batch, offers only the people the server has not logged', async () => {
    const server = fakeServer(12, { failOnCall: 2 });
    renderModal(server.send);
    fireEvent.click(await screen.findByText('Send to 12 participants'));
    // Batch 1 sent 5, batch 2 died after sending 1 → 6 left.
    expect(await screen.findByText('Send to 6 participants')).toBeInTheDocument();
    expect(screen.getByText(/6 already got this email/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Send to 6 participants'));
    await waitFor(() => expect(server.logged.size).toBe(12));
    const sentIds = server.batches().flatMap(b => b.ep_ids);
    expect(sentIds.filter(id => id === 6)).toHaveLength(1);
  });

  it('skips pasted addresses', async () => {
    const server = fakeServer(3);
    renderModal(server.send);
    await screen.findByText('Send to 3 participants');
    fireEvent.click(screen.getByText(/Skip them/));
    fireEvent.change(screen.getByLabelText(/Skip these addresses/), { target: { value: 'p0@x.com, p2@x.com' } });
    expect(await screen.findByText('Send to 1 participant')).toBeInTheDocument();
    expect(screen.getByText(/Skipping 2 from your list/)).toBeInTheDocument();
  });

  it('resuming shows the saved message read-only and sends with its id', async () => {
    const server = fakeServer(2);
    render(
      <GroupFollowupEmailModal
        group={group} send={server.send} checkInLabel="Check-in"
        resume={{ id: 7, subject: 'Saved subject', body: '<p>Saved body</p>' }}
        onClose={vi.fn()}
      />
    );
    expect(await screen.findByText('Saved subject')).toBeInTheDocument();
    expect(screen.getByText('Saved body')).toBeInTheDocument();
    expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();
    await waitFor(() => expect(server.send).toHaveBeenCalledWith(expect.objectContaining({ dry_run: true, followup_id: 7 })));
  });
});
