import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import {
  BsPage, BsHero, BsHeroInner, BsOverline, BsH1, BsLead,
  BsSectionLabel, BsSectionLabelOverline, BsSectionLabelSub, BsSectionLabelLink,
} from '../styles/birdsoc';
import BundleGrid from '../components/BundleGrid';
import ProductCard from '../components/ProductCard';
import EventCard from '../components/EventCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { catalogueService } from '../services/catalogue';
import { eventService } from '../services/misc';
import { useCart } from '../context/CartContext';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;

  @media (max-width: 768px) {
    padding: 1.25rem 1rem 2rem;
  }
`;

const Section = styled.section`
  margin-bottom: 3rem;

  &:last-child { margin-bottom: 0; }
`;

const ProductsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
`;

const EventsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 0.9rem;
  }
`;

const FEATURED_PRODUCT_LIMIT = 4;
const UPCOMING_EVENT_LIMIT = 3;

const Home = () => {
  const { shopOpen } = useCart();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(!!shopOpen);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    if (shopOpen) {
      catalogueService.getPopularProducts(FEATURED_PRODUCT_LIMIT)
        .then((data) => setFeaturedProducts(Array.isArray(data) ? data : data.results || []))
        .catch((err) => {
          console.error('Error fetching products:', err);
          setProductsError('Failed to load products');
        })
        .finally(() => setLoadingProducts(false));
    }

    eventService.getEvents()
      .then((data) => setEvents(Array.isArray(data) ? data : data.results || []))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, [shopOpen]);

  const upcomingEvents = events.slice(0, UPCOMING_EVENT_LIMIT);

  return (
    <BsPage>
      {/* Hero hidden — may be reinstated later
      <BsHero>
        <BsHeroInner>
          <BsOverline>Bird Society of Singapore</BsOverline>
          <BsH1>Shop, attend, support our birds.</BsH1>
          <BsLead>
            Field-ready gear and member events from the Bird Society of Singapore.
            Every purchase and ticket funds research, advocacy, and free public outreach.
          </BsLead>
        </BsHeroInner>
      </BsHero>
      */}

      <Container>
        {shopOpen && (
          <>
            <BundleGrid title="Bundle deals" subtitle="Save when you buy a set." />

            <Section>
              <BsSectionLabel>
                <div>
                  <BsSectionLabelOverline>Featured products</BsSectionLabelOverline>
                  <BsSectionLabelSub>Our best-sellers from the past year.</BsSectionLabelSub>
                </div>
                <BsSectionLabelLink as={Link} to="/products">
                  Shop all →
                </BsSectionLabelLink>
              </BsSectionLabel>

              {loadingProducts && <Loading text="Loading products..." />}
              {productsError && <Alert variant="error">{productsError}</Alert>}
              {!loadingProducts && !productsError && featuredProducts.length === 0 && (
                <Alert variant="info">No products available at the moment.</Alert>
              )}
              {!loadingProducts && !productsError && featuredProducts.length > 0 && (
                <ProductsGrid>
                  {featuredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </ProductsGrid>
              )}
            </Section>
          </>
        )}

        {(loadingEvents || upcomingEvents.length > 0) && (
          <Section>
            <BsSectionLabel>
              <div>
                <BsSectionLabelOverline>Upcoming events</BsSectionLabelOverline>
              </div>
              <BsSectionLabelLink as={Link} to="/events">
                See all →
              </BsSectionLabelLink>
            </BsSectionLabel>

            {loadingEvents ? (
              <Loading text="Loading events..." />
            ) : (
              <EventsGrid>
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </EventsGrid>
            )}
          </Section>
        )}
      </Container>
    </BsPage>
  );
};

export default Home;
