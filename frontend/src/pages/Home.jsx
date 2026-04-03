import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { catalogueService } from '../services/catalogue';
import CollectionSection from '../components/CollectionSection';
import BannerGrid from '../components/BannerGrid';
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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsRes, categoriesRes] = await Promise.all([
          catalogueService.getProducts({ page_size: 200 }),
          catalogueService.getCategories(true),
        ]);
        setProducts(productsRes.results || productsRes);
        setCategories(categoriesRes.results || categoriesRes);
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
    const grouped = categories
      .map((cat) => ({
        ...cat,
        products: products.filter(
          (p) => p.category_slugs && p.category_slugs.includes(cat.slug)
        ),
      }))
      .filter((col) => col.products.length > 0);

    // Products not in any category
    const categorised = new Set(
      categories.flatMap((c) =>
        products
          .filter((p) => p.category_slugs && p.category_slugs.includes(c.slug))
          .map((p) => p.id)
      )
    );
    const uncategorised = products.filter((p) => !categorised.has(p.id));
    if (uncategorised.length > 0) {
      grouped.push({
        id: 'uncategorised',
        name: 'Other',
        slug: 'other',
        description: '',
        image: null,
        products: uncategorised,
      });
    }

    return grouped;
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
