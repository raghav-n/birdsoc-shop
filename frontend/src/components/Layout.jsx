import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Header from './Header';
import ConsoleHeader from './ConsoleHeader';
import Footer from './Footer';
import SafeHtml from './SafeHtml';
import { useShopConfig } from '../context/ShopConfigContext';
import { bannerService } from '../services/misc';
import { useLocation } from 'react-router-dom';

const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
  width: 100%;
`;

const ClosedBanner = styled.div`
  background-color: var(--bs-amber-soft);
  border-bottom: 1px solid var(--bs-rule-soft);
  color: var(--bs-amber-fg);
  text-align: center;
  padding: 0.75rem 1rem;
  font-family: var(--bs-sans);
  font-weight: 600;
  font-size: 0.88rem;
  letter-spacing: -0.1px;
`;

const TextBannerBar = styled.div`
  background-color: var(--bs-accent-dim);
  color: var(--bs-on-accent);
  text-align: center;
  padding: 0.6rem 1rem;
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  letter-spacing: -0.1px;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: break-word;

  a {
    color: inherit;
    text-decoration: underline;
  }

  img, video {
    max-width: 100%;
  }
`;

const Layout = ({ children }) => {
  const { shopOpen } = useShopConfig();
  const [textBanner, setTextBanner] = useState(null);
  const location = useLocation();

  const isDonationPage = location.pathname.startsWith('/donate');
  const isConsolePage = location.pathname === '/console' || location.pathname.startsWith('/console/');
  const hideBanners = isDonationPage || isConsolePage;

  useEffect(() => {
    bannerService.getTextBanner().then((data) => {
      if (data.is_active && data.text) setTextBanner(data.text);
    }).catch(() => {});
  }, []);

  return (
    <LayoutContainer>
      {isConsolePage ? <ConsoleHeader /> : <Header />}
      {textBanner && !hideBanners && (
        <TextBannerBar>
          <SafeHtml html={textBanner} tag="div" />
        </TextBannerBar>
      )}
      {!shopOpen && !hideBanners && (
        <ClosedBanner>
          Our shop is currently closed. You can browse products, but purchases are unavailable right now.
        </ClosedBanner>
      )}
      <MainContent>
        {children}
      </MainContent>
      {!isConsolePage && <Footer />}
    </LayoutContainer>
  );
};

export default Layout;
