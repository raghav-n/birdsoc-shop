import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Facebook, Instagram } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShopConfig } from '../context/ShopConfigContext';

const Container = styled.footer`
  background: var(--bs-body);
  border-top: 1px solid var(--bs-rule-soft);
  margin-top: auto;
`;

const Grid = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 64px 32px 32px;
  display: grid;
  grid-template-columns: 1.4fr repeat(3, 1fr);
  gap: 56px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 36px 32px;
    padding: 48px 24px 24px;
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 36px 20px 20px;
  }
`;

const BrandCol = styled.div``;

const BrandRow = styled.div`
  margin-bottom: 18px;
`;

const LogoMark = styled.img`
  display: block;
  height: 56px;
  width: auto;
  max-width: 100%;
`;

const BrandText = styled.p`
  font-size: 13px;
  color: var(--bs-text-dim);
  line-height: 1.65;
  max-width: 320px;
  margin: 0;
`;

const Socials = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 22px;
`;

const SocialBtn = styled.a`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--bs-text-dim);
  text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: var(--bs-accent);
    border-color: var(--bs-accent);
  }
`;

const ColTitle = styled.div`
  font-family: var(--bs-sans);
  font-size: 12px;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.4px;
  text-transform: uppercase;
  margin-bottom: 16px;
`;

const LinkList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const linkStyles = `
  font-size: 13.5px;
  color: var(--bs-text);
  text-decoration: none;
  letter-spacing: -0.1px;
  white-space: nowrap;
  transition: color 0.15s ease;

  &:hover { color: var(--bs-accent); }
`;

const FLink = styled(Link)`${linkStyles}`;
const FExternal = styled.a`${linkStyles}`;

const BottomBar = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px 32px 36px;
  border-top: 1px solid var(--bs-rule-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  @media (max-width: 900px) {
    padding: 20px 24px 28px;
  }

  @media (max-width: 520px) {
    padding: 18px 20px 22px;
  }
`;

const BottomText = styled.div`
  font-size: 12px;
  color: var(--bs-text-mute);
  letter-spacing: 0.2px;
`;

const Footer = () => {
  const { isAuthenticated } = useAuth();
  const { shopOpen } = useShopConfig();

  return (
    <Container>
      <Grid>
        <BrandCol>
          <BrandRow>
            <LogoMark src="/img/logo-soc.png" alt="Bird Society of Singapore" />
          </BrandRow>
          <BrandText>
            A registered society advancing the conservation, research and public appreciation of Singapore's avifauna.
          </BrandText>
          <Socials>
            <SocialBtn
              href="https://www.facebook.com/birdsocsg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <Facebook size={16} strokeWidth={1.7} />
            </SocialBtn>
            <SocialBtn
              href="https://www.instagram.com/birdsocsg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={16} strokeWidth={1.7} />
            </SocialBtn>
          </Socials>
        </BrandCol>

        <div>
          <ColTitle>Shop</ColTitle>
          <LinkList>
            <li><FLink to="/products">Products</FLink></li>
          </LinkList>
        </div>

        <div>
          <ColTitle>Engage</ColTitle>
          <LinkList>
            <li><FLink to="/events">Events</FLink></li>
            <li>
              <FExternal href="https://birdsociety.sg/about-us/" target="_blank" rel="noopener noreferrer">
                About the Society
              </FExternal>
            </li>
            <li><FLink to="/contact">Contact</FLink></li>
            <li><FLink to="/donate">Donate</FLink></li>
          </LinkList>
        </div>

        <div>
          <ColTitle>Help</ColTitle>
          <LinkList>
            <li><FLink to="/faq">FAQ</FLink></li>
            <li>
              <FExternal href="https://birdsociety.sg/data-protection-notice/" target="_blank" rel="noopener noreferrer">
                Data Protection Notice
              </FExternal>
            </li>
            {!isAuthenticated && shopOpen && <li><FLink to="/login">Sign in</FLink></li>}
            {isAuthenticated && shopOpen && <li><FLink to="/orders">My orders</FLink></li>}
          </LinkList>
        </div>
      </Grid>

      <BottomBar>
        <BottomText>
          © {new Date().getFullYear()} Bird Society of Singapore · UEN T23SS0038A · shop.birdsociety.sg
        </BottomText>
      </BottomBar>
    </Container>
  );
};

export default Footer;
