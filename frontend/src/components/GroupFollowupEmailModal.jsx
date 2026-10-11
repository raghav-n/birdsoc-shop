import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import RichTextEditor from './RichTextEditor';

// Compose and send a one-off email to an event group's participants. Each
// person's copy is rendered against their own event, so {{event_title}} is
// their site. Sends go out in small batches (one Gmail call per email, and the
// server kills requests after 30s); the server logs every copy as it goes, so
// the remaining list always comes from the server and nobody is emailed twice.

const BATCH_SIZE = 5;

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

const SkipBox = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 70px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  font-family: inherit;
  margin-top: 0.4rem;
`;

const LinkBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  color: var(--link-text);
  cursor: pointer;
  &:hover { text-decoration: underline; }
`;

const Preview = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.6rem 0.875rem;
  font-size: 0.88rem;
  max-height: 220px;
  overflow-y: auto;
  background: #fafafa;
  table { border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 0.2em 0.5em; }
  p { margin: 0 0 0.4em; }
`;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * `resume` is a saved follow-up email (from the group's send history): its
 * subject and body are fixed and only people it hasn't reached are offered.
 */
export default function GroupFollowupEmailModal({ group, send, checkInLabel, resume = null, onClose, onSent }) {
  const events = group.events || [];
  const [subject, setSubject] = useState(resume?.subject ?? DEFAULT_SUBJECT);
  const [body, setBody] = useState(resume?.body ?? DEFAULT_BODY);
  const [followupId, setFollowupId] = useState(resume?.id ?? null);
  const [eventIds, setEventIds] = useState(() => events.map(ev => ev.id));
  const [attendedOnly, setAttendedOnly] = useState(false);
  const [skipText, setSkipText] = useState('');
  const [showSkip, setShowSkip] = useState(false);
  const [audience, setAudience] = useState(null);
  const [reload, setReload] = useState(0);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [progress, setProgress] = useState(null);

  const filters = {
    event_ids: eventIds,
    attended_only: attendedOnly,
    ...(skipText.trim() ? { skip_emails: skipText } : {}),
    ...(followupId ? { followup_id: followupId } : {}),
  };
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let stale = false;
    setAudience(null);
    if (eventIds.length === 0) { setAudience({ recipients: [], already_sent: 0, skipped: 0 }); return undefined; }
    // Debounced so typing in the skip box doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      send({ dry_run: true, ...JSON.parse(filtersKey) })
        .then(res => { if (!stale) setAudience(res); })
        .catch(() => { if (!stale) toast.error('Failed to load recipients'); });
    }, skipText ? 400 : 0);
    return () => { stale = true; clearTimeout(timer); };
  }, [send, filtersKey, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const sending = progress !== null;
  const pending = audience?.recipients || [];
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
      const res = await send({ ...filters, subject, body, test_email: email });
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
    let id = followupId;
    const failed = [];
    setProgress({ sent, total });
    try {
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE).map(r => r.ep_id);
        const res = await send({
          ...filters, ...(id ? { followup_id: id } : {}), subject, body, ep_ids: batch,
        });
        id = res.followup_id;
        setFollowupId(id);
        sent += res.sent;
        failed.push(...res.failed);
        setProgress({ sent, total });
      }
      if (failed.length) {
        toast.error(`Sent ${sent}. Could not send to ${failed.length}: ${failed.join(', ')}`);
      } else {
        toast.success(`Email sent to ${plural(sent, 'participant')}`);
        onSent?.();
        onClose();
        return;
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Sending stopped. Send again to continue with the people not yet emailed.');
    } finally {
      setProgress(null);
    }
    // Whatever happened, the server's log says who is still waiting.
    onSent?.();
    setReload(n => n + 1);
  };

  const sendLabel = sending
    ? 'Sending…'
    : audience === null
      ? 'Loading recipients…'
      : `Send to ${plural(pending.length, 'participant')}`;

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <Dialog role="dialog" aria-label="Email participants">
        <Header>
          <div>
            <Title>{followupId && resume ? 'Continue sending' : 'Email participants'}</Title>
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
              {audience && ` ${plural(pending.length, 'person')} to email.`}
              {audience?.already_sent > 0 && ` ${audience.already_sent} already got this email.`}
              {audience?.skipped > 0 && ` Skipping ${audience.skipped} from your list.`}
            </Hint>
            <div style={{ marginTop: '0.5rem' }}>
              {showSkip || skipText ? (
                <>
                  <Label htmlFor="group-followup-skip">Skip these addresses (e.g. pasted from Gmail's Sent folder)</Label>
                  <SkipBox
                    id="group-followup-skip"
                    value={skipText}
                    disabled={sending}
                    onChange={e => setSkipText(e.target.value)}
                    placeholder="a@example.com, Name <b@example.com>, …"
                  />
                </>
              ) : (
                <LinkBtn type="button" onClick={() => setShowSkip(true)}>
                  Already emailed some people another way? Skip them
                </LinkBtn>
              )}
            </div>
          </div>

          {resume ? (
            <div>
              <Label as="div">Subject</Label>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.6rem' }}>{subject}</div>
              <Label as="div">Message</Label>
              {/* Staff-written HTML from our own console. */}
              <Preview dangerouslySetInnerHTML={{ __html: body }} />
              <Hint>The saved message is sent as-is so everyone gets the same email.</Hint>
            </div>
          ) : (<>
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
          </>)}

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
          <PrimaryBtn onClick={handleSend} disabled={sending || audience === null || pending.length === 0}>
            {sendLabel}
          </PrimaryBtn>
          {sending && <Progress>{progress.sent} of {progress.total} sent</Progress>}
          <Btn onClick={onClose} disabled={sending} style={{ marginLeft: 'auto' }}>Cancel</Btn>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
