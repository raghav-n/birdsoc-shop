import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleUsersService } from '../services/consoleUsers';
import HelpModal from '../components/HelpModal';

const CONSOLE_GROUPS = ['Merch Sales', 'Merch Management', 'Events'];

const Page = styled.div`
  max-width: 720px;
  margin: 4rem auto;
  padding: 0 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
`;

const Subtitle = styled.p`
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;

  &:focus {
    outline: none;
    border-color: var(--link-text);
  }
`;

const UserCard = styled.div`
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 0.85rem;
`;

const UserHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
`;

const UserName = styled.div`
  font-weight: 600;
  font-size: 0.95rem;
`;

const UserEmail = styled.div`
  font-size: 0.825rem;
  color: var(--text-secondary);
`;

const Badge = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 4px;
  background: ${(p) => (p.$super ? '#1f2937' : '#eef2ff')};
  color: ${(p) => (p.$super ? '#fff' : '#3730a3')};
  margin-left: 0.4rem;
`;

const Groups = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
`;

const Checkbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
  opacity: ${(p) => (p.$disabled ? 0.55 : 1)};

  input { cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')}; }
`;

const SaveBtn = styled.button`
  margin-left: auto;
  padding: 0.4rem 0.9rem;
  border-radius: 7px;
  border: 1px solid var(--link-text);
  background: var(--link-text);
  color: #fff;
  font-size: 0.825rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Empty = styled.p`
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

const groupsEqual = (a, b) => {
  const sa = new Set(a);
  return a.length === b.length && b.every((g) => sa.has(g));
};

const UserRow = ({ user, onSaved }) => {
  // Only the managed console groups are editable here.
  const initial = CONSOLE_GROUPS.filter((g) => user.groups?.includes(g));
  const [selected, setSelected] = useState(initial);
  const [saving, setSaving] = useState(false);

  const toggle = (group) => {
    setSelected((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const dirty = !groupsEqual(selected, initial);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await consoleUsersService.updateUserGroups(user.id, selected);
      toast.success(`Updated ${updated.email}`);
      onSaved(updated);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

  return (
    <UserCard>
      <UserHead>
        <div>
          <UserName>
            {fullName || user.email}
            {user.is_superuser && <Badge $super>Superuser</Badge>}
          </UserName>
          {fullName && <UserEmail>{user.email}</UserEmail>}
        </div>
      </UserHead>
      <Groups>
        {CONSOLE_GROUPS.map((group) => (
          <Checkbox key={group} $disabled={user.is_superuser}>
            <input
              type="checkbox"
              checked={user.is_superuser || selected.includes(group)}
              disabled={user.is_superuser}
              onChange={() => toggle(group)}
            />
            {group}
          </Checkbox>
        ))}
        {!user.is_superuser && (
          <SaveBtn onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </SaveBtn>
        )}
      </Groups>
    </UserCard>
  );
};

const UserManagement = () => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await consoleUsersService.listUsers(q);
      setUsers(data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleSaved = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  return (
    <Page>
      <HelpModal title="How to use: User Management">
        <p>Assign staff to console groups. Superusers always have full access and can't be edited here — manage superuser status in the Django admin.</p>
        <ul>
          <li><strong>Merch Sales</strong> — onsite purchase and order lookup.</li>
          <li><strong>Merch Management</strong> — Merch Sales access plus analytics.</li>
          <li><strong>Events</strong> — event management.</li>
        </ul>
        <p>Granting any group automatically gives the user console access; removing all groups revokes it. Use the search box to find users not yet in any group.</p>
      </HelpModal>

      <Title>User management</Title>
      <Subtitle>Assign staff to console access groups</Subtitle>

      <SearchInput
        type="text"
        placeholder="Search by email or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <Empty>Loading…</Empty>
      ) : users.length === 0 ? (
        <Empty>{search ? 'No users match your search.' : 'No console users yet. Search to find a user to add.'}</Empty>
      ) : (
        users.map((u) => <UserRow key={u.id} user={u} onSaved={handleSaved} />)
      )}
    </Page>
  );
};

export default UserManagement;
