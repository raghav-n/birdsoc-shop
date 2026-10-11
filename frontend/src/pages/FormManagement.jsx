import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleFormService as svc } from '../services/forms';
import HelpModal from '../components/HelpModal';

const Page = styled.div`
  max-width: 860px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.2rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryButton = styled(Button)`
  background: var(--link-text);
  color: #fff;
  &:hover:not(:disabled) { opacity: 0.88; }
`;

const SmallButton = styled(Button)`
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  background: #fff;
  border-color: ${p => (p.$danger ? '#f87171' : '#d1d5db')};
  color: ${p => (p.$danger ? '#dc2626' : 'var(--text-primary)')};
  &:hover:not(:disabled) { background: ${p => (p.$danger ? '#fef2f2' : '#f9fafb')}; }
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const CardMain = styled.div`
  flex: 1;
  min-width: 220px;
`;

const FormTitle = styled(Link)`
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const Meta = styled.div`
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
`;

const Badge = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: ${p => (p.$variant === 'green' ? '#dcfce7' : p.$variant === 'red' ? '#fee2e2' : '#f3f4f6')};
  color: ${p => (p.$variant === 'green' ? '#15803d' : p.$variant === 'red' ? '#b91c1c' : '#374151')};
`;

const Actions = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

export default function FormManagement() {
  const navigate = useNavigate();
  const [forms, setForms] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    svc.listForms().then(d => setForms(d.forms)).catch(() => toast.error('Failed to load forms'));
  }, []);

  const handleDelete = async (form) => {
    const warning = form.response_count
      ? `Delete "${form.name}" and its ${form.response_count} responses? This cannot be undone.`
      : `Delete "${form.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setDeleting(form.id);
    try {
      await svc.deleteForm(form.id);
      setForms(prev => prev.filter(f => f.id !== form.id));
      toast.success('Form deleted');
    } catch {
      toast.error('Failed to delete form');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Page>
      <HelpModal title="How to use: Forms">
        <p>Build feedback and survey forms, share them by link, and see the results.</p>
        <ul>
          <li>Click <strong>+ New form</strong> to build one. The event feedback template gives you a good starting set of questions.</li>
          <li>Link a form to an event group to email each participant a personal link and see results per site.</li>
          <li>Click a form's name to see its responses and send invites.</li>
        </ul>
      </HelpModal>

      <HeaderRow>
        <div>
          <BackLink to="/console">← Console</BackLink>
          <Title>Forms</Title>
        </div>
        <PrimaryButton onClick={() => navigate('/console/forms/new')}>+ New form</PrimaryButton>
      </HeaderRow>

      {forms === null ? (
        <Empty>Loading…</Empty>
      ) : forms.length === 0 ? (
        <Empty>No forms yet.</Empty>
      ) : forms.map(form => (
        <Card key={form.id}>
          <CardMain>
            <FormTitle to={`/console/forms/${form.id}`}>{form.name}</FormTitle>
            <Meta>
              <span>/forms/{form.slug}</span>
              {form.event_group && <span>{form.event_group.name}</span>}
              <span>{form.response_count} {form.response_count === 1 ? 'response' : 'responses'}</span>
            </Meta>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              <Badge $variant={form.is_active ? 'green' : 'red'}>{form.is_active ? 'Live' : 'Off'}</Badge>
              {form.is_active && !form.accept_submissions && <Badge $variant="red">Closed to responses</Badge>}
            </div>
          </CardMain>
          <Actions>
            <SmallButton onClick={() => navigate(`/console/forms/${form.id}`)}>Responses</SmallButton>
            <SmallButton onClick={() => navigate(`/console/forms/${form.id}/edit`)}>Edit</SmallButton>
            <SmallButton $danger onClick={() => handleDelete(form)} disabled={deleting === form.id}>
              {deleting === form.id ? '…' : 'Delete'}
            </SmallButton>
          </Actions>
        </Card>
      ))}
    </Page>
  );
}
