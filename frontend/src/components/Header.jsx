import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ShoppingCart, Menu, X, Search, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button } from '../styles/GlobalStyles';

const HeaderContainer = styled.header`
  background-color: var(--page-header-background);
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const NavContainer = styled.nav`
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  flex-shrink: 0;

  img {
    height: 55px;
    width: auto;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 768px) {
    gap: 0.5rem;
  }
`;

const DesktopOnly = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavLink = styled(Link)`
  color: var(--header-text);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
  
  &:hover {
    color: var(--link-text);
  }
`;

const SearchForm = styled.form`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  max-width: 400px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  
  &:focus {
    outline: none;
    border-color: var(--link-text);
  }
`;

const IconButton = styled.button`
  background: none;
  border: none;
  color: var(--header-text);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  position: relative;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
    color: var(--link-text);
  }
`;

const CartBadge = styled.span`
  position: absolute;
  top: -2px;
  right: -2px;
  background-color: var(--link-text);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
`;

const UserActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MobileMenu = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const MobileMenuOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1001;
  display: ${props => props.isOpen ? 'block' : 'none'};
`;

const MobileMenuContent = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background-color: white;
  padding: 2rem;
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s ease;
  z-index: 1002;
  overflow-y: auto;
`;

const MobileMenuHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 2rem;
`;

const MobileNavLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { getCartCount, shopOpen } = useCart();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const cartCount = getCartCount();

  return (
    <>
      <HeaderContainer>
        <NavContainer>
          <Logo to="/">
            <img src="/static/img/logo.png" alt="Bird Society of Singapore" />
          </Logo>
          
          <SearchForm onSubmit={handleSearch}>
            <SearchInput
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <IconButton type="submit">
              <Search size={18} />
            </IconButton>
          </SearchForm>

          <RightSection>
          <NavLinks>
            <NavLink to="/products">Products</NavLink>
            <NavLink to="/events">Events</NavLink>
          </NavLinks>

          <UserActions>
            {shopOpen && (
              <IconButton as={Link} to="/cart">
                <ShoppingCart size={20} />
                {cartCount > 0 && <CartBadge>{cartCount}</CartBadge>}
              </IconButton>
            )}

            {isAuthenticated ? (
              <DesktopOnly>
                <IconButton onClick={handleLogout}>
                  <LogOut size={18} />
                </IconButton>
              </DesktopOnly>
            ) : shopOpen ? (
              <DesktopOnly>
                <Button as={Link} to="/login" size="small" variant="secondary">
                  Login
                </Button>
                <Button as={Link} to="/register" size="small">
                  Register
                </Button>
              </DesktopOnly>
            ) : null}

            <MobileMenu>
              <IconButton onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={20} />
              </IconButton>
            </MobileMenu>
          </UserActions>
          </RightSection>
        </NavContainer>
      </HeaderContainer>

      <MobileMenuOverlay 
        isOpen={isMobileMenuOpen} 
        onClick={closeMobileMenu}
      />
      
      <MobileMenuContent isOpen={isMobileMenuOpen}>
        <MobileMenuHeader>
          <h3>Menu</h3>
          <IconButton onClick={closeMobileMenu}>
            <X size={20} />
          </IconButton>
        </MobileMenuHeader>

        <MobileNavLinks>
          <NavLink to="/products" onClick={closeMobileMenu}>Products</NavLink>
          <NavLink to="/events" onClick={closeMobileMenu}>Events</NavLink>
          {shopOpen && (
            <NavLink to="/cart" onClick={closeMobileMenu}>
              Cart {cartCount > 0 && `(${cartCount})`}
            </NavLink>
          )}
          
          {isAuthenticated ? (
            <>
              <Button onClick={handleLogout} variant="secondary" fullWidth>
                Logout
              </Button>
            </>
          ) : shopOpen ? (
            <>
              <Button as={Link} to="/login" onClick={closeMobileMenu} variant="secondary" fullWidth>
                Login
              </Button>
              <Button as={Link} to="/register" onClick={closeMobileMenu} fullWidth>
                Register
              </Button>
            </>
          ) : null}
        </MobileNavLinks>
      </MobileMenuContent>
    </>
  );
};

export default Header;
