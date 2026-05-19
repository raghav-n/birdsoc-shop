import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  ShoppingCart, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { BsButton } from '../styles/birdsoc';

const Container = styled.header`
  background: var(--bs-body);
  border-bottom: 1px solid var(--bs-rule-soft);
  position: sticky;
  top: 0;
  z-index: 1000;
`;

const Bar = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 2rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: "logo nav actions";
  align-items: center;
  gap: 32px;

  @media (max-width: 900px) {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "logo actions"
      "nav nav";
    padding: 10px 1rem;
    gap: 6px 12px;
  }
`;

const LogoLink = styled(Link)`
  grid-area: logo;
  display: flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
`;

const LogoMark = styled.img`
  width: 44px;
  height: 44px;
  object-fit: contain;
  display: block;

  @media (max-width: 900px) {
    width: 38px;
    height: 38px;
  }
`;

const Wordmark = styled.div`
  display: flex;
  flex-direction: column;
  font-weight: 700;
  color: var(--bs-text);
  letter-spacing: -0.3px;
  line-height: 1.05;
  white-space: nowrap;

  span:first-child { font-size: 0.95rem; }
  span:last-child {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--bs-text-dim);
    letter-spacing: 0;
  }

  @media (max-width: 480px) {
    display: none;
  }
`;

const Nav = styled.nav`
  grid-area: nav;
  display: flex;
  gap: 1.75rem;
  align-items: center;
  justify-content: center;

  @media (max-width: 900px) {
    gap: 1.25rem;
    padding-top: 4px;
    padding-bottom: 2px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }
  }
`;

const NavLink = styled(Link)`
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  font-weight: 500;
  color: ${(p) => p.$active ? 'var(--bs-text)' : 'var(--bs-text-dim)'};
  letter-spacing: -0.1px;
  text-decoration: none;
  padding-bottom: 4px;
  border-bottom: 2px solid ${(p) => p.$active ? 'var(--bs-accent)' : 'transparent'};
  transition: color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;

  &:hover {
    color: var(--bs-text);
  }
`;

const ExternalNavLink = styled.a`
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--bs-text-dim);
  text-decoration: none;
  padding-bottom: 4px;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease;
  white-space: nowrap;

  &:hover {
    color: var(--bs-text);
  }
`;

const Right = styled.div`
  grid-area: actions;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;

  @media (max-width: 900px) {
    gap: 6px;
  }
`;

const IconBtn = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid var(--bs-rule);
  background: var(--bs-panel);
  color: var(--bs-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: var(--bs-panel-hi);
    border-color: var(--bs-accent);
  }

  @media (max-width: 900px) {
    width: 34px;
    height: 34px;
    border-radius: 7px;
  }
`;

const CartPill = styled(Link)`
  height: 38px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--bs-rule);
  background: var(--bs-panel);
  color: var(--bs-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--bs-sans);
  font-size: 0.81rem;
  font-weight: 600;
  text-decoration: none;
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: var(--bs-panel-hi);
    border-color: var(--bs-accent);
  }

  @media (max-width: 900px) {
    padding: 0;
    width: 34px;
    height: 34px;
    border-radius: 7px;
    justify-content: center;

    span.label { display: none; }
  }
`;

const CartCount = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--bs-accent);
  color: var(--bs-on-accent);
  font-size: 10.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 900px) {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 16px;
    height: 16px;
    font-size: 9.5px;
  }
`;

const AuthActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 900px) {
    gap: 6px;
  }
`;

const Header = () => {
  const { isAuthenticated, logout } = useAuth();
  const { getCartCount, shopOpen } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const cartCount = getCartCount();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <Container>
      <Bar>
        <LogoLink to="/" aria-label="BirdSoc SG Shop home">
          <LogoMark src="/img/logo-sm.png" alt="" />
          <Wordmark>
            <span>BirdSoc SG</span>
            <span>Shop</span>
          </Wordmark>
        </LogoLink>

        <Nav>
          <NavLink to="/products" $active={isActive('/products')}>Products</NavLink>
          <NavLink to="/events" $active={isActive('/events')}>Events</NavLink>
          <ExternalNavLink href="https://birdsociety.sg" target="_blank" rel="noopener noreferrer">
            BirdSoc SG
          </ExternalNavLink>
          <NavLink to="/contact" $active={isActive('/contact')}>Contact</NavLink>
        </Nav>

        <Right>
          {shopOpen && (
            <CartPill to="/cart" aria-label="Cart">
              <ShoppingCart size={16} strokeWidth={1.7} />
              <span className="label">Cart</span>
              {cartCount > 0 && <CartCount>{cartCount}</CartCount>}
            </CartPill>
          )}

          {isAuthenticated ? (
            <AuthActions>
              <IconBtn onClick={handleLogout} aria-label="Logout">
                <LogOut size={16} strokeWidth={1.7} />
              </IconBtn>
            </AuthActions>
          ) : shopOpen ? (
            <AuthActions>
              <BsButton as={Link} to="/login" $size="sm">Login</BsButton>
              <BsButton as={Link} to="/register" $size="sm" $primary>Register</BsButton>
            </AuthActions>
          ) : null}
        </Right>
      </Bar>
    </Container>
  );
};

export default Header;
