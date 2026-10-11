import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { Copy, Download, ExternalLink, Pencil, Send, Star } from 'lucide-react';
import { consoleFormService as svc } from '../services/forms';
import HelpModal from '../components/HelpModal';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 960px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.2rem 0 1rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.3rem;
`;

const Meta = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  align-items: center;
`;

const Badge = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: ${p => (p.$variant === 'green' ? '#dcfce7' : p.$variant === 'red' ? '#fee2e2' : '#f3f4f6')};
  color: ${p => (p.$variant === 'green' ? '#15803d' : p.$variant === 'red' ? '#b91c1c' : '#374151')};
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Button = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  text-decoration: none;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryButton = styled(Button)`
  background: var(--link-text);
  color: #fff;
  &:hover:not(:disabled) { opacity: 0.88; color: #fff; }
`;

const SecondaryButton = styled(Button)`
  background: #fff;
  border-color: #d1d5db;
  color: var(--text-primary);
  &:hover:not(:disabled) { background: #f9fafb; color: var(--text-primary); }
`;

const LinkPanel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
`;

const LinkLabel = styled.span`
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
`;

const LinkUrl = styled.code`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const StatTile = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem 1rem;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
`;

const StatLabel = styled.div`
  font-size: 0.78rem;
  color: var(--text-secondary);
`;

const Tabs = styled.div`
  display: flex;
  gap: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1.25rem;
  overflow-x: auto;
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  color: ${p => (p.$active ? 'var(--text-primary)' : 'var(--text-secondary)')};
  border-bottom: 2px solid ${p => (p.$active ? 'var(--link-text)' : 'transparent')};
  margin-bottom: -1px;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 0.9rem;
`;

const CardTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.2rem;
`;

const CardSub = styled.div`
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
`;

const BigNumber = styled.span`
  font-size: 1.6rem;
  font-weight: 700;
  margin-right: 0.4rem;
`;

const BarRow = styled.div`
  display: grid;
  grid-template-columns: minmax(70px, 160px) 1fr 3rem;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  margin: 0.25rem 0;
`;

const BarTrack = styled.div`
  height: 12px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  width: ${p => p.$pct}%;
  background: var(--link-text);
  border-radius: 3px;
`;

const BarCount = styled.span`
  color: var(--text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const SiteTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin-top: 0.75rem;
  th, td { padding: 0.3rem 0.4rem; text-align: left; border-top: 1px solid #f0f0f0; }
  th { color: var(--text-secondary); font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
`;

const Quote = styled.blockquote`
  margin: 0 0 0.6rem;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid #d1d5db;
  background: #fafafa;
  font-size: 0.88rem;
  white-space: pre-line;
  footer { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; }
`;

const AnswerList = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(140px, 260px) 1fr;
  gap: 0.35rem 1rem;
  font-size: 0.86rem;
  dt { color: var(--text-secondary); }
  dd { margin: 0; white-space: pre-line; }
  @media (max-width: 640px) { grid-template-columns: 1fr; dd { margin-bottom: 0.4rem; } }
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  align-items: center;
  margin-bottom: 1rem;
  font-size: 0.85rem;
`;

const Dropdown = styled.select`
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
`;

const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  input { accent-color: var(--link-text); }
`;

const TableWrap = styled.div`
  overflow-x: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  th, td { padding: 0.55rem 0.75rem; text-align: left; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
  th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
  tr:last-child td { border-bottom: none; }
`;

const Muted = styled.span`
  color: var(--text-secondary);
`;

const Empty = styled.div`
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

const SendPanel = styled(Card)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function displayAnswer(field, value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field?.type === 'rating') return `${value} / 5`;
  if (field?.type === 'scale') return `${value} / 10`;
  return String(value);
}

const copy = (text) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied');
};

function Bars({ rows, labelFor = (r) => r.value }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return rows.map(r => (
    <BarRow key={r.value}>
      <span>{labelFor(r)}</span>
      <BarTrack><BarFill $pct={(100 * r.count) / max} /></BarTrack>
      <BarCount>{r.count}</BarCount>
    </BarRow>
  ));
}

function SummaryCard({ item, responses }) {
  const sub = `${item.answered} ${item.answered === 1 ? 'answer' : 'answers'}`;
  if (item.type === 'rating' || item.type === 'scale') {
    const max = item.type === 'rating' ? 5 : 10;
    return (
      <Card>
        <CardTitle>{item.label}</CardTitle>
        <CardSub>{sub}</CardSub>
        {item.average !== null && (
          <div style={{ marginBottom: '0.6rem' }}>
            <BigNumber>{item.average.toFixed(1)}</BigNumber>
            <Muted>/ {max} average</Muted>
            {item.nps !== undefined && (
              <Muted style={{ marginLeft: '1rem' }} title="% scoring 9-10 minus % scoring 0-6">
                Recommend score (NPS): <strong style={{ color: 'var(--text-primary)' }}>{item.nps}</strong>
              </Muted>
            )}
          </div>
        )}
        <Bars
          rows={[...item.distribution].reverse()}
          labelFor={r => (item.type === 'rating'
            ? <span style={{ color: '#d6a21e', letterSpacing: '1px' }} aria-label={`${r.value} stars`}>
                {Array.from({ length: r.value }, (_, i) => <Star key={i} size={11} fill="currentColor" strokeWidth={0} />)}
              </span>
            : r.value)}
        />
        {item.by_site?.length > 1 && (
          <SiteTable>
            <thead><tr><th>Site</th><th className="num">Average</th><th className="num">Answers</th></tr></thead>
            <tbody>
              {item.by_site.map(s => (
                <tr key={s.event}><td>{s.event}</td><td className="num">{s.average.toFixed(1)}</td><td className="num">{s.count}</td></tr>
              ))}
            </tbody>
          </SiteTable>
        )}
      </Card>
    );
  }
  if (item.counts) {
    return (
      <Card>
        <CardTitle>{item.label}</CardTitle>
        <CardSub>{sub}</CardSub>
        <Bars rows={item.counts} />
      </Card>
    );
  }
  if (item.type === 'number') {
    return (
      <Card>
        <CardTitle>{item.label}</CardTitle>
        <CardSub>{sub}</CardSub>
        {item.average !== null && <div><BigNumber>{item.average}</BigNumber><Muted>average</Muted></div>}
      </Card>
    );
  }
  const answers = responses.filter(r => r.data[item.key]);
  return (
    <Card>
      <CardTitle>{item.label}</CardTitle>
      <CardSub>{sub}</CardSub>
      {answers.length === 0 ? <Muted>No answers yet.</Muted> : answers.map(r => (
        <Quote key={r.id}>
          {String(r.data[item.key])}
          <footer>
            {r.respondent ? `${r.respondent.name}, ${r.respondent.event.title}` : 'Anonymous'}
          </footer>
        </Quote>
      ))}
    </Card>
  );
}

// ─── Invites tab ──────────────────────────────────────────────────────────────

function InvitesTab({ form, onSent }) {
  const [data, setData] = useState(null);
  const [site, setSite] = useState('');
  const [status, setStatus] = useState('');
  const [attendedOnly, setAttendedOnly] = useState(true);
  const [sending, setSending] = useState(null);

  const load = useCallback(() => svc.getInvites(form.id).then(setData).catch(() => toast.error('Failed to load participants')), [form.id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Empty>Loading…</Empty>;
  if (!data.has_group) {
    return (
      <Empty>
        This form isn't linked to an event group. <Link to={`/console/forms/${form.id}/edit`}>Edit the form</Link> and choose one to send personal links.
      </Empty>
    );
  }

  const people = data.participants;
  const pool = people.filter(p => !attendedOnly || p.attended);
  const toSend = pool.filter(p => !p.emailed_at).length;
  const sites = [...new Set(people.map(p => p.event.title))];
  const visible = people.filter(p =>
    (!site || p.event.title === site) &&
    (!status ||
      (status === 'responded' && p.responded_at) ||
      (status === 'waiting' && p.emailed_at && !p.responded_at) ||
      (status === 'not_sent' && !p.emailed_at))
  );
  const formOpen = form.is_active && form.accept_submissions;

  const handleSend = async () => {
    const who = attendedOnly ? 'checked-in participants' : 'confirmed participants';
    if (!window.confirm(`Email a personal feedback link to ${toSend} ${who} who haven't been sent one yet?`)) return;
    setSending({ sent: 0, total: toSend, failed: [] });
    let sent = 0;
    const failed = [];
    try {
      for (;;) {
        const res = await svc.sendInviteBatch(form.id, { attendedOnly, limit: 20 });
        sent += res.sent;
        failed.push(...res.failed);
        setSending({ sent, total: toSend, failed: [...failed] });
        if (res.remaining === 0 || res.sent === 0) break;
      }
      if (failed.length) toast.error(`Sent ${sent}. Could not send to ${failed.length}: ${failed.join(', ')}`);
      else toast.success(`Sent ${sent} invite${sent === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || `Stopped after ${sent} sent. Try again to continue.`);
    } finally {
      setSending(null);
      load();
      onSent();
    }
  };

  return (
    <>
      <SendPanel>
        <div>
          <div style={{ fontWeight: 600 }}>
            {toSend > 0 ? `${toSend} ${toSend === 1 ? 'person has' : 'people have'} not been sent a link yet` : (attendedOnly ? 'Everyone checked in has been sent a link' : 'Everyone has been sent a link')}
          </div>
          <Check style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
            <input type="checkbox" checked={attendedOnly} onChange={e => setAttendedOnly(e.target.checked)} />
            Only people marked as checked in ({people.filter(p => p.attended).length} of {people.length})
          </Check>
          {!formOpen && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.35rem' }}>Turn on "Form is live" and "Accepting responses" before sending.</div>}
        </div>
        <PrimaryButton onClick={handleSend} disabled={!!sending || toSend === 0 || !formOpen}>
          <Send size={14} />
          {sending ? `Sending ${sending.sent} / ${sending.total}…` : `Send ${toSend} invite${toSend === 1 ? '' : 's'}`}
        </PrimaryButton>
      </SendPanel>

      <Controls>
        <Dropdown value={site} onChange={e => setSite(e.target.value)} aria-label="Filter by site">
          <option value="">All sites</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </Dropdown>
        <Dropdown value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="responded">Responded</option>
          <option value="waiting">Sent, no response</option>
          <option value="not_sent">Not sent</option>
        </Dropdown>
        <Muted>{visible.length} shown</Muted>
      </Controls>

      {visible.length === 0 ? <Empty>No participants match.</Empty> : (
        <TableWrap>
          <Table>
            <thead>
              <tr><th>Name</th><th>Site</th><th>Checked in</th><th>Emailed</th><th>Responded</th><th>Personal link</th></tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.ep_id}>
                  <td>{p.name}{p.party_size > 1 && <Muted> (+{p.party_size - 1})</Muted>}<br /><Muted>{p.email}</Muted></td>
                  <td>{p.event.title}</td>
                  <td>{p.attended ? 'Yes' : <Muted>No</Muted>}</td>
                  <td>{p.emailed_at ? fmt(p.emailed_at) : <Muted>Not sent</Muted>}</td>
                  <td>{p.responded_at ? fmt(p.responded_at) : <Muted>-</Muted>}</td>
                  <td>
                    {p.link
                      ? <SecondaryButton style={{ padding: '0.25rem 0.55rem' }} onClick={() => copy(p.link)}><Copy size={12} /> Copy</SecondaryButton>
                      : <Muted>Created on send</Muted>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const TABS = ['summary', 'responses', 'invites'];

export default function FormResponses() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'summary';
  const setTab = (t) => setSearchParams(t === 'summary' ? {} : { tab: t }, { replace: true });

  const [data, setData] = useState(null);
  const [site, setSite] = useState('');

  const load = useCallback(() => svc.getResponses(id).then(setData).catch(() => toast.error('Failed to load responses')), [id]);
  useEffect(() => { load(); }, [load]);

  const fieldsByKey = useMemo(() => Object.fromEntries((data?.form.fields || []).map(f => [f.key, f])), [data]);

  if (!data) return <Page>Loading…</Page>;

  const { form, summary, responses } = data;
  const sites = [...new Set(responses.filter(r => r.respondent).map(r => r.respondent.event.title))];
  const visibleResponses = responses.filter(r => !site || r.respondent?.event.title === site);

  const handleCsv = async () => {
    try {
      const blob = await svc.downloadResponsesCsv(form.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.slug}-responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const publicUrl = `${window.location.origin}/forms/${form.slug}`;

  return (
    <Page>
      <HelpModal title="How to use: Form responses">
        <h3>Summary</h3>
        <p>Averages and answer counts for every question. Rating questions are also broken down by site when responses came through personal links.</p>
        <h3>Responses</h3>
        <p>Every individual response. Use <strong>Download CSV</strong> for a spreadsheet.</p>
        <h3>Invites</h3>
        <ul>
          <li>Lists every confirmed booking in the linked event group, with whether they've been emailed and whether they've responded.</li>
          <li><strong>Send invites</strong> emails a personal link to everyone not emailed yet. It's safe to press again later: people already emailed are skipped, so you can use it after adding late check-ins.</li>
          <li>Personal links let people come back and edit their answers, and tie their response to their booking and site.</li>
          <li>Use <strong>Copy</strong> to send someone their link over WhatsApp instead.</li>
        </ul>
      </HelpModal>

      <BackLink to="/console/forms">← Forms</BackLink>
      <HeaderRow>
        <div>
          <Title>{form.name}</Title>
          <Meta>
            <Badge $variant={form.is_active ? 'green' : 'red'}>{form.is_active ? 'Live' : 'Off'}</Badge>
            {form.is_active && !form.accept_submissions && <Badge $variant="red">Closed to responses</Badge>}
            {form.event_group && <Link to={`/console/event-groups/${form.event_group.id}`}>{form.event_group.name}</Link>}
          </Meta>
        </div>
        <ButtonRow>
          <SecondaryButton as={Link} to={`/console/forms/${form.id}/edit`}><Pencil size={14} /> Edit form</SecondaryButton>
          <SecondaryButton as="a" href={`/forms/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Preview</SecondaryButton>
          <SecondaryButton onClick={handleCsv} disabled={responses.length === 0}><Download size={14} /> Download CSV</SecondaryButton>
        </ButtonRow>
      </HeaderRow>

      <LinkPanel>
        <LinkLabel>Public link</LinkLabel>
        <LinkUrl title={publicUrl}>{publicUrl}</LinkUrl>
        <SecondaryButton style={{ padding: '0.25rem 0.55rem' }} onClick={() => copy(publicUrl)}><Copy size={12} /> Copy</SecondaryButton>
      </LinkPanel>

      <Stats>
        <StatTile><StatValue>{responses.length}</StatValue><StatLabel>Responses</StatLabel></StatTile>
        <StatTile>
          <StatValue>{responses.filter(r => r.respondent).length}</StatValue>
          <StatLabel>Through personal links</StatLabel>
        </StatTile>
        <StatTile><StatValue>{form.invite_count}</StatValue><StatLabel>Personal links created</StatLabel></StatTile>
      </Stats>

      <Tabs>
        <Tab $active={tab === 'summary'} onClick={() => setTab('summary')}>Summary</Tab>
        <Tab $active={tab === 'responses'} onClick={() => setTab('responses')}>Responses ({responses.length})</Tab>
        <Tab $active={tab === 'invites'} onClick={() => setTab('invites')}>Invites</Tab>
      </Tabs>

      {tab === 'summary' && (
        responses.length === 0
          ? <Empty>No responses yet.</Empty>
          : summary.map(item => <SummaryCard key={item.key} item={item} responses={responses} />)
      )}

      {tab === 'responses' && (
        <>
          {sites.length > 1 && (
            <Controls>
              <Dropdown value={site} onChange={e => setSite(e.target.value)} aria-label="Filter by site">
                <option value="">All sites</option>
                {sites.map(s => <option key={s} value={s}>{s}</option>)}
              </Dropdown>
              <Muted>{visibleResponses.length} shown</Muted>
            </Controls>
          )}
          {visibleResponses.length === 0 ? <Empty>No responses yet.</Empty> : visibleResponses.map(r => (
            <Card key={r.id}>
              <CardTitle>{r.respondent ? r.respondent.name : 'Anonymous'}</CardTitle>
              <CardSub>
                {r.respondent && <>{r.respondent.event.title} · {r.respondent.email} · </>}
                {fmt(r.updated_at || r.submitted_at)}
              </CardSub>
              <AnswerList>
                {form.fields.map(f => {
                  const answer = displayAnswer(fieldsByKey[f.key], r.data[f.key]);
                  return answer === null ? null : (
                    <React.Fragment key={f.key}><dt>{f.label}</dt><dd>{answer}</dd></React.Fragment>
                  );
                })}
              </AnswerList>
            </Card>
          ))}
        </>
      )}

      {tab === 'invites' && <InvitesTab form={form} onSent={load} />}
    </Page>
  );
}
