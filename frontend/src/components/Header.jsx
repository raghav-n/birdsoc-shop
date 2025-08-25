import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ShoppingCart, User, Menu, X, Search, LogOut } from 'lucide-react';
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
  font-family: "Libre Franklin", sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--header-text);
  text-decoration: none;
  
  &:hover {
    color: var(--header-text);
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
    max-width: 200px;
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
  const { getCartCount } = useCart();
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
          <Logo to="/">BirdSoc Shop</Logo>
          
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

          <NavLinks>
            <NavLink to="/products">Products</NavLink>
            <NavLink to="/events">Events</NavLink>
          </NavLinks>

          <UserActions>
            <IconButton as={Link} to="/cart">
              <ShoppingCart size={20} />
              {cartCount > 0 && <CartBadge>{cartCount}</CartBadge>}
            </IconButton>

            {isAuthenticated ? (
              <>
                <IconButton as={Link} to="/orders">
                  <User size={20} />
                  <span className="hidden md:inline">Orders</span>
                </IconButton>
                <IconButton as={Link} to="/profile">
                  <User size={20} />
                  <span className="hidden md:inline">{user?.first_name || 'Profile'}</span>
                </IconButton>
                <IconButton onClick={handleLogout}>
                  <LogOut size={18} />
                </IconButton>
              </>
            ) : (
              <>
                <Button as={Link} to="/login" size="small" variant="secondary">
                  Login
                </Button>
                <Button as={Link} to="/register" size="small">
                  Register
                </Button>
              </>
            )}

            <MobileMenu>
              <IconButton onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={20} />
              </IconButton>
            </MobileMenu>
          </UserActions>
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
          <NavLink to="/cart" onClick={closeMobileMenu}>
            Cart {cartCount > 0 && `(${cartCount})`}
          </NavLink>
          
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" onClick={closeMobileMenu}>Profile</NavLink>
              <NavLink to="/orders" onClick={closeMobileMenu}>Orders</NavLink>
              <Button onClick={handleLogout} variant="secondary" fullWidth>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button as={Link} to="/login" onClick={closeMobileMenu} variant="secondary" fullWidth>
                Login
              </Button>
              <Button as={Link} to="/register" onClick={closeMobileMenu} fullWidth>
                Register
              </Button>
            </>
          )}
        </MobileNavLinks>
      </MobileMenuContent>
    </>
  );
};

export default Header;
