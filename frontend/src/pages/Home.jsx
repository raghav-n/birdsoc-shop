import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import CollectionSection from '../components/CollectionSection';
import BannerGrid from '../components/BannerGrid';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { buildCollections, fetchCatalogueSnapshot } from '../utils/catalogue';

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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchCatalogueSnapshot({ page_size: 200 });
        setProducts(data.products);
        setCategories(data.categories);
      } catch (err) {
        setError('Failed to load products');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const collections = useMemo(() => {
    return buildCollections(products, categories);
  }, [products, categories]);

  return (
    <>
      <Section>
        <Container>
          <BannerGrid />

          {loading && <Loading text="Loading products..." />}

          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          {!loading && !error && collections.length > 0 && (
            collections.map((collection) => (
              <CollectionSection key={collection.id} collection={collection} />
            ))
          )}

          {!loading && !error && collections.length === 0 && (
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
