import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { catalogueService } from '../services/catalogue';
import { Button, Grid } from '../styles/GlobalStyles';
import ProductCard from '../components/ProductCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';

const HeroSection = styled.section`
  background: linear-gradient(135deg, var(--page-header-background) 0%, var(--page-background) 100%);
  padding: 4rem 0;
  text-align: center;
`;

const HeroContent = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem;
`;

const HeroTitle = styled.h1`
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--dark);

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const HeroSubtitle = styled.p`
  font-size: 1.25rem;
  color: var(--dark);
  margin-bottom: 2rem;
  line-height: 1.6;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

const Section = styled.section`
  padding: 3rem 0;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
`;

const SectionHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  font-weight: 600;
  color: var(--dark);
  margin-bottom: 0.5rem;
`;

const SectionSubtitle = styled.p`
  font-size: 1.1rem;
  color: #666;
  max-width: 600px;
  margin: 0 auto;
`;

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setLoading(true);
        // Get featured products (you can modify this to get specific featured products)
        const response = await catalogueService.getProducts({ 
          page_size: 8,
          ordering: '-id' // Get latest products as featured
        });
        setFeaturedProducts(response.results || response);
      } catch (err) {
        setError('Failed to load featured products');
        console.error('Error fetching featured products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  return (
    <>
      <HeroSection>
        <HeroContent>
          <HeroTitle>Welcome to BirdSoc Shop</HeroTitle>
          <HeroSubtitle>
            Discover premium birding equipment and accessories. 
            Join our community events and enhance your birding experience.
          </HeroSubtitle>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button as={Link} to="/products" size="large">
              Shop Now
            </Button>
            <Button as={Link} to="/events" variant="secondary" size="large">
              View Events
            </Button>
          </div>
        </HeroContent>
      </HeroSection>

      <Section>
        <Container>
          <SectionHeader>
            <SectionTitle>Featured Products</SectionTitle>
            <SectionSubtitle>
              Check out our latest and most popular birding products
            </SectionSubtitle>
          </SectionHeader>

          {loading && <Loading text="Loading featured products..." />}
          
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          {!loading && !error && featuredProducts.length > 0 && (
            <>
              <Grid minWidth="280px" gap="1.5rem">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </Grid>
              
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <Button as={Link} to="/products" variant="secondary">
                  View All Products
                </Button>
              </div>
            </>
          )}

          {!loading && !error && featuredProducts.length === 0 && (
            <Alert variant="info">
              No featured products available at the moment.
            </Alert>
          )}
        </Container>
      </Section>

      <Section style={{ backgroundColor: 'var(--page-header-background)' }}>
        <Container>
          <SectionHeader>
            <SectionTitle>Why Choose BirdSoc Shop?</SectionTitle>
          </SectionHeader>

          <Grid minWidth="300px" gap="2rem">
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--link-text)', marginBottom: '1rem' }}>Quality Products</h3>
              <p>Carefully curated birding equipment from trusted brands, ensuring the best experience for enthusiasts.</p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--link-text)', marginBottom: '1rem' }}>Community Events</h3>
              <p>Join our regular birding events and connect with fellow enthusiasts in the community.</p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--link-text)', marginBottom: '1rem' }}>Expert Support</h3>
              <p>Get advice and support from experienced birders to help you make the right choices.</p>
            </div>
          </Grid>
        </Container>
      </Section>
    </>
  );
};

export default Home;
