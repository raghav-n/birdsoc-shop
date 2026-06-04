import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Container = styled.header`
  background: var(--bs-panel);
  border-bottom: 1px solid var(--bs-rule);
  position: sticky;
  top: 0;
  z-index: 1000;
`;

const Bar = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;

  @media (max-width: 600px) {
    padding: 8px 1rem;
    gap: 0.75rem;
  }
`;

const Brand = styled(Link)`
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--bs-text);
  font-family: var(--bs-sans);
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: -0.2px;
  min-width: 0;
`;

const LogoMark = styled.img`
  width: 32px;
  height: 32px;
  object-fit: contain;
  display: block;
`;

const ConsoleTag = styled.span`
  font-family: var(--bs-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: var(--bs-text);
  color: var(--bs-body);
  padding: 3px 7px;
  border-radius: 4px;
  line-height: 1;
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-left: 0.75rem;
  flex: 1;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (max-width: 600px) {
    gap: 0.9rem;
    margin-left: 0.25rem;
  }
`;

const NavLink = styled(Link)`
  font-family: var(--bs-sans);
  font-size: 0.82rem;
  font-weight: 500;
  color: ${(p) => p.$active ? 'var(--bs-text)' : 'var(--bs-text-dim)'};
  text-decoration: none;
  padding-bottom: 3px;
  border-bottom: 2px solid ${(p) => p.$active ? 'var(--bs-accent)' : 'transparent'};
  transition: color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;

  &:hover { color: var(--bs-text); }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`;

const ShopLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid var(--bs-rule);
  background: var(--bs-body);
  color: var(--bs-text-dim);
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;

  &:hover {
    color: var(--bs-text);
    border-color: var(--bs-accent);
  }

  @media (max-width: 600px) {
    padding: 0;
    width: 34px;
    justify-content: center;
    span.label { display: none; }
  }
`;

const IconBtn = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 7px;
  border: 1px solid var(--bs-rule);
  background: var(--bs-body);
  color: var(--bs-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: var(--bs-panel-hi);
    border-color: var(--bs-accent);
  }
`;

const UserEmail = styled.span`
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  color: var(--bs-text-dim);
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 800px) {
    display: none;
  }
`;

const ConsoleHeader = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const canMerchandise = user?.is_superuser || user?.groups?.includes('Merch Sales') || user?.groups?.includes('Merch Management');
  const canAnalytics = user?.is_superuser || user?.groups?.includes('Merch Management');
  const canEvents = user?.is_superuser || user?.groups?.includes('Events');

  const isActive = (path, exact = false) => (
    exact ? location.pathname === path : location.pathname.startsWith(path)
  );

  return (
    <Container>
      <Bar>
        <Brand to="/console" aria-label="Console home">
          <LogoMark src="/img/logo-sm.png" alt="" />
          <ConsoleTag>Console</ConsoleTag>
        </Brand>

        <Nav>
          <NavLink to="/console" $active={isActive('/console', true)}>Home</NavLink>
          {canMerchandise && (
            <>
              <NavLink to="/console/onsite-purchase" $active={isActive('/console/onsite-purchase')}>
                Onsite
              </NavLink>
              <NavLink to="/console/order-lookup" $active={isActive('/console/order-lookup')}>
                Orders
              </NavLink>
              {canAnalytics && (
                <NavLink to="/console/analytics" $active={isActive('/console/analytics')}>
                  Analytics
                </NavLink>
              )}
            </>
          )}
          {canEvents && (
            <NavLink to="/console/events" $active={isActive('/console/events')}>
              Events
            </NavLink>
          )}
          {user?.is_superuser && (
            <NavLink to="/console/users" $active={isActive('/console/users')}>
              Users
            </NavLink>
          )}
        </Nav>

        <Right>
          {user?.email && <UserEmail>{user.email}</UserEmail>}
          <ShopLink to="/" aria-label="Back to shop">
            <ArrowLeft size={14} strokeWidth={1.8} />
            <span className="label">Shop</span>
          </ShopLink>
          {isAuthenticated && (
            <IconBtn onClick={handleLogout} aria-label="Logout">
              <LogOut size={15} strokeWidth={1.7} />
            </IconBtn>
          )}
        </Right>
      </Bar>
    </Container>
  );
};

export default ConsoleHeader;
