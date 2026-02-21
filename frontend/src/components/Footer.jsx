import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShopConfig } from '../context/ShopConfigContext';

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
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
`;

const FooterSection = styled.div`
  flex: 0 1 300px;
  text-align: center;

  h4 {
    color: var(--header-text);
    margin-bottom: 1rem;
    font-size: 1.1rem;
    font-weight: 600;
  }
`;

const FooterSectionCompact = styled(FooterSection)`
  flex-basis: auto;
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

const ExternalLink = styled.a`
  color: var(--dark);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;

  &:hover {
    color: var(--link-text);
  }
`;

const FooterBottom = styled.div`
  border-top: 1px solid #e1e1e1;
  padding-top: 1rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--dark);
`;

const Footer = () => {
  const { isAuthenticated } = useAuth();
  const { shopOpen } = useShopConfig();
  return (
    <FooterContainer>
      <FooterContent>
        <FooterGrid>
          <FooterSection>
            <h4>Bird Society of Singapore</h4>
            <FooterText>
              The Bird Society of Singapore is the leading organisation promoting the conservation and research of our island's birds. 
              Read more about us <b><ExternalLink href="https://birdsociety.sg/about-us/" target="_blank">here</ExternalLink></b>.
            </FooterText>
          </FooterSection>

          <FooterSectionCompact>
            <h4>Useful Links</h4>
            <FooterLinks>
              <FooterLink to="/contact">Contact Us</FooterLink>
              <FooterLink to="/faq#shipping">Shipping Info</FooterLink>
              <FooterLink to="/faq">FAQ</FooterLink>
            </FooterLinks>
          </FooterSectionCompact>

          {shopOpen && (
            <FooterSectionCompact>
              <h4>Account</h4>
              <FooterLinks>
                <FooterLink to="/orders">My Orders</FooterLink>
                {!isAuthenticated && (
                  <>
                    <FooterLink to="/login">Sign In</FooterLink>
                    <FooterLink to="/register">Create Account</FooterLink>
                  </>
                )}
              </FooterLinks>
            </FooterSectionCompact>
          )}
        </FooterGrid>

        <FooterBottom>
          <p>&copy; {new Date().getFullYear()} Bird Society of Singapore / <ExternalLink href="https://birdsociety.sg/data-protection-notice/" target="_blank" rel="noopener noreferrer">
                Data Protection Notice
              </ExternalLink></p>
        </FooterBottom>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;
