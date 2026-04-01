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
              </ExternalLink> / <ExternalLink href="https://github.com/raghav-n/birdsoc-shop" target="_blank" rel="noopener noreferrer">
                <svg role="img" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ verticalAlign: 'middle' }}><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
              </ExternalLink></p>
        </FooterBottom>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;
