import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const FooterContainer = styled.footer`
  background-color: var(--page-footer-background);
  border-top: 1px solid #e1e1e1;
  margin-top: auto;
  padding: 2rem 0 1rem 0;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
`;

const FooterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`;

const FooterSection = styled.div`
  h4 {
    color: var(--header-text);
    margin-bottom: 1rem;
    font-size: 1.1rem;
    font-weight: 600;
  }
`;

const FooterLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FooterLink = styled(Link)`
  color: var(--dark);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;

  &:hover {
    color: var(--link-text);
  }
`;

const FooterText = styled.p`
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--dark);
  line-height: 1.5;
`;

const FooterBottom = styled.div`
  border-top: 1px solid #e1e1e1;
  padding-top: 1rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--dark);
`;

const Footer = () => {
  return (
    <FooterContainer>
      <FooterContent>
        <FooterGrid>
          <FooterSection>
            <h4>BirdSoc Shop</h4>
            <FooterText>
              Your trusted source for birding equipment and accessories. 
              Supporting the birding community with quality products.
            </FooterText>
          </FooterSection>

          <FooterSection>
            <h4>Quick Links</h4>
            <FooterLinks>
              <FooterLink to="/products">Products</FooterLink>
              <FooterLink to="/events">Events</FooterLink>
              <FooterLink to="/orders">Order History</FooterLink>
              <FooterLink to="/refund">Request Refund</FooterLink>
            </FooterLinks>
          </FooterSection>

          <FooterSection>
            <h4>Customer Service</h4>
            <FooterLinks>
              <FooterLink to="/contact">Contact Us</FooterLink>
              <FooterLink to="/shipping">Shipping Info</FooterLink>
              <FooterLink to="/returns">Returns Policy</FooterLink>
              <FooterLink to="/faq">FAQ</FooterLink>
            </FooterLinks>
          </FooterSection>

          <FooterSection>
            <h4>Account</h4>
            <FooterLinks>
              <FooterLink to="/profile">My Profile</FooterLink>
              <FooterLink to="/orders">My Orders</FooterLink>
              <FooterLink to="/login">Sign In</FooterLink>
              <FooterLink to="/register">Create Account</FooterLink>
            </FooterLinks>
          </FooterSection>
        </FooterGrid>

        <FooterBottom>
          <p>&copy; 2024 BirdSoc Shop. All rights reserved.</p>
        </FooterBottom>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;
