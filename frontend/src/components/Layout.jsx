import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Header from './Header';
import Footer from './Footer';
import { useShopConfig } from '../context/ShopConfigContext';
import { bannerService } from '../services/misc';

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
  background-color: #fff3cd;
  border-bottom: 1px solid #ffc107;
  color: #664d03;
  text-align: center;
  padding: 0.75rem 1rem;
  font-weight: 500;
  font-size: 0.95rem;
`;

const TextBannerBar = styled.div`
  background-color: var(--dark);
  color: #fff;
  text-align: center;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
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

  useEffect(() => {
    bannerService.getTextBanner().then((data) => {
      if (data.is_active && data.text) setTextBanner(data.text);
    }).catch(() => {});
  }, []);

  return (
    <LayoutContainer>
      <Header />
      {textBanner && (
        <TextBannerBar dangerouslySetInnerHTML={{ __html: textBanner }} />
      )}
      {!shopOpen && (
        <ClosedBanner>
          Our shop is currently closed. You can browse products, but purchases are unavailable right now.
        </ClosedBanner>
      )}
      <MainContent>
        {children}
      </MainContent>
      <Footer />
    </LayoutContainer>
  );
};

export default Layout;
