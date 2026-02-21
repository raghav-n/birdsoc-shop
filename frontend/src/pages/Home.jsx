import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { catalogueService } from '../services/catalogue';
import { Grid } from '../styles/GlobalStyles';
import ProductCard from '../components/ProductCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';

const Section = styled.section`
  padding: 3rem 0;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
`;


const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await catalogueService.getProducts({ page_size: 100 });
        setProducts(response.results || response);
      } catch (err) {
        setError('Failed to load products');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <>
      <Section>
        <Container>
          {loading && <Loading text="Loading products..." />}

          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          {!loading && !error && products.length > 0 && (
            <Grid minWidth="280px" gap="1.5rem">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </Grid>
          )}

          {!loading && !error && products.length === 0 && (
            <Alert variant="info">
              No products available at the moment.
            </Alert>
          )}
        </Container>
      </Section>
    </>
  );
};

export default Home;
