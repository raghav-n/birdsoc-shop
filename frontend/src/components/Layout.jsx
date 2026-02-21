import React from 'react';
import styled from 'styled-components';
import Header from './Header';
import Footer from './Footer';
import { useShopConfig } from '../context/ShopConfigContext';

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

const Layout = ({ children }) => {
  const { shopOpen } = useShopConfig();

  return (
    <LayoutContainer>
      <Header />
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
