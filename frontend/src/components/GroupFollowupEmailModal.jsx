import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import RichTextEditor from './RichTextEditor';

// Compose and send a one-off email to an event group's participants. Each
// person's copy is rendered against their own event, so {{event_title}} is
// their site. Sends go out in batches so a big group never hits a request timeout.

const BATCH_SIZE = 25;

const DEFAULT_SUBJECT = 'Update about {{group_name}}';
const DEFAULT_BODY = `<p>Hi {{first_name}},</p>

<p>We're writing with an update about <strong>{{group_name}}</strong> ({{event_title}}).</p>

<p></p>

<p>— Bird Society of Singapore</p>`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  @media (min-width: 641px) {
    align-items: center;
    justify-content: center;
  }
`;

const Dialog = styled.div`
  background: #fff;
  width: 100%;
  max-height: 90vh;
  border-radius: 16px 16px 0 0;
  overflow-y: auto;
  @media (min-width: 641px) {
    width: 640px;
    max-height: 85vh;
    border-radius: 12px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
`;

const Title = styled.div`
  font-weight: 700;
  font-size: 1rem;
`;

const Subtitle = styled.div`
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
`;

const Body = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem 1rem;
  border-top: 1px solid #e5e7eb;
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 500;
  color: #374151;
  display: block;
  margin-bottom: 0.3rem;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
`;

const Hint = styled.p`
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0.4rem 0 0;
  line-height: 1.5;
  code {
    background: #f3f4f6;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.72rem;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const Chip = styled.button`
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid ${p => p.$active ? '#6d28d9' : '#d1d5db'};
  background: ${p => p.$active ? '#ede9fe' : '#fff'};
  color: ${p => p.$active ? '#6d28d9' : '#374151'};
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  margin-top: 0.5rem;
`;

const TestRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const Btn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  color: var(--text-primary);
  white-space: nowrap;
  &:hover:not(:disabled) { background: #f9fafb; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryBtn = styled(Btn)`
  background: var(--link-text);
  border-color: transparent;
  color: #fff;
  &:hover:not(:disabled) { background: var(--link-text); opacity: 0.85; }
`;

const Progress = styled.span`
  font-size: 0.8rem;
  color: var(--text-secondary);
`;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function GroupFollowupEmailModal({ group, send, checkInLabel, onClose }) {
  const events = group.events || [];
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [eventIds, setEventIds] = useState(() => events.map(ev => ev.id));
  const [attendedOnly, setAttendedOnly] = useState(false);
  const [recipients, setRecipients] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [progress, setProgress] = useState(null);
  // Bookings already emailed in this session, so a retry after an error picks up where it stopped.
  const done = useRef(new Set());

  useEffect(() => {
    let stale = false;
    setRecipients(null);
    if (eventIds.length === 0) { setRecipients([]); return undefined; }
    send({ dry_run: true, event_ids: eventIds, attended_only: attendedOnly })
      .then(res => { if (!stale) setRecipients(res.recipients); })
      .catch(() => { if (!stale) toast.error('Failed to load recipients'); });
    return () => { stale = true; };
  }, [send, eventIds, attendedOnly]);

  const sending = progress !== null;
  const pending = (recipients || []).filter(r => !done.current.has(r.ep_id));
  const bodyIsEmpty = !body || body.replace(/<[^>]*>/g, '').trim() === '';

  const toggleEvent = (id) => setEventIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const validate = () => {
    if (!subject.trim()) { toast.error('Enter a subject'); return false; }
    if (bodyIsEmpty) { toast.error('Write an email body first'); return false; }
    return true;
  };

  const handleSendTest = async () => {
    const email = testEmail.trim();
    if (!email) { toast.error('Enter a test recipient email'); return; }
    if (!validate()) return;
    setSendingTest(true);
    try {
      const res = await send({ subject, body, test_email: email, event_ids: eventIds, attended_only: attendedOnly });
      toast.success(res?.detail || `Test email sent to ${email}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSend = async () => {
    if (!validate()) return;
    if (pending.length === 0) { toast.error('There is nobody left to email'); return; }
    if (!window.confirm(`Send this email to ${plural(pending.length, 'participant')}? This cannot be undone.`)) return;
    const total = pending.length;
    let sent = 0;
    const failed = [];
    setProgress({ sent, total });
    try {
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE).map(r => r.ep_id);
        const res = await send({
          subject, body, ep_ids: batch, event_ids: eventIds, attended_only: attendedOnly,
        });
        res.sent_ep_ids.forEach(id => done.current.add(id));
        sent += res.sent;
        failed.push(...res.failed);
        setProgress({ sent, total });
      }
      if (failed.length) {
        toast.error(`Sent ${sent}. Could not send to ${failed.length}: ${failed.join(', ')}`);
      } else {
        toast.success(`Email sent to ${plural(sent, 'participant')}`);
        onClose();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Stopped after ${sent} sent. Send again to continue with the rest.`);
    } finally {
      setProgress(null);
    }
  };

  const sendLabel = sending
    ? 'Sending…'
    : recipients === null
      ? 'Loading recipients…'
      : `Send to ${plural(pending.length, 'participant')}`;

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <Dialog role="dialog" aria-label="Email participants">
        <Header>
          <div>
            <Title>Email participants</Title>
            <Subtitle>{group.name}</Subtitle>
          </div>
          <CloseBtn onClick={onClose} disabled={sending} aria-label="Close">×</CloseBtn>
        </Header>

        <Body>
          <div>
            <Label as="div">Send to</Label>
            <Chips>
              {events.map(ev => (
                <Chip
                  key={ev.id}
                  type="button"
                  $active={eventIds.includes(ev.id)}
                  disabled={sending}
                  onClick={() => toggleEvent(ev.id)}
                >
                  {eventIds.includes(ev.id) ? '✓ ' : ''}{ev.title}
                </Chip>
              ))}
            </Chips>
            <CheckRow>
              <input
                type="checkbox"
                checked={attendedOnly}
                disabled={sending}
                onChange={e => setAttendedOnly(e.target.checked)}
              />
              Only people marked at {checkInLabel}
            </CheckRow>
            <Hint>
              Confirmed bookings only, one email per address.
              {recipients !== null && ` ${plural(recipients.length, 'recipient')}.`}
              {recipients !== null && pending.length < recipients.length && ` ${recipients.length - pending.length} already sent.`}
            </Hint>
          </div>

          <div>
            <Label htmlFor="group-followup-subject">Subject</Label>
            <Input
              id="group-followup-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={DEFAULT_SUBJECT}
            />
          </div>

          <div>
            <Label as="div">Message</Label>
            <RichTextEditor value={body} onChange={setBody} tables />
            <Hint>
              Variables for the subject or body: <code>{'{{first_name}}'}</code>, <code>{'{{last_name}}'}</code>,{' '}
              <code>{'{{group_name}}'}</code>, <code>{'{{event_title}}'}</code>, <code>{'{{event_date}}'}</code>,{' '}
              <code>{'{{event_location}}'}</code>. Event details are each person's own site.
            </Hint>
          </div>

          <TestRow>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Label htmlFor="group-followup-test">Send a test to yourself first</Label>
              <Input
                id="group-followup-test"
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Btn onClick={handleSendTest} disabled={sendingTest || sending}>
              {sendingTest ? 'Sending…' : 'Send test'}
            </Btn>
          </TestRow>
        </Body>

        <Footer>
          <PrimaryBtn onClick={handleSend} disabled={sending || recipients === null || pending.length === 0}>
            {sendLabel}
          </PrimaryBtn>
          {sending && <Progress>{progress.sent} of {progress.total} sent</Progress>}
          <Btn onClick={onClose} disabled={sending} style={{ marginLeft: 'auto' }}>Cancel</Btn>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
