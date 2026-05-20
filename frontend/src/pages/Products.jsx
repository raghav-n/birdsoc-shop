import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Heart, SlidersHorizontal } from 'lucide-react';
import {
  BsPage,
  BsHero,
  BsHeroInner,
  BsOverline,
  BsH1,
  BsLead,
  BsButton,
} from '../styles/birdsoc';
import CollectionSection from '../components/CollectionSection';
import BundleGrid from '../components/BundleGrid';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { sanitizeText } from '../utils/safeContent';
import { buildCollections, fetchCatalogueSnapshot } from '../utils/catalogue';
import { useShopConfig } from '../context/ShopConfigContext';

const Layout = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 2.5rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    padding: 1rem 1rem 2.5rem;
    gap: 0.5rem;
  }
`;

const Sidebar = styled.aside`
  position: sticky;
  top: 5rem;
  align-self: start;

  @media (max-width: 900px) {
    display: none;
  }
`;

const RailLabel = styled.div`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.4px;
  text-transform: uppercase;
  margin-bottom: 0.9rem;
`;

const CollectionRow = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: ${(p) => p.$active ? 'var(--bs-panel-hi)' : 'transparent'};
  color: ${(p) => p.$active ? 'var(--bs-accent-dim)' : 'var(--bs-text)'};
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  font-weight: ${(p) => p.$active ? 600 : 500};
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: var(--bs-panel-hi);
  }
`;

const CollectionCount = styled.span`
  font-family: var(--bs-mono);
  font-size: 0.7rem;
  color: var(--bs-text-mute);
  letter-spacing: 0.3px;
`;

const Content = styled.div`
  min-width: 0;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.4rem;
  gap: 0.75rem;
  flex-wrap: wrap;

  @media (max-width: 900px) {
    margin-bottom: 1rem;
  }
`;

const TopBarTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TopBarH = styled.div`
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--bs-text);

  @media (max-width: 768px) {
    font-size: 1.05rem;
  }
`;

const TopBarSub = styled.div`
  font-size: 0.78rem;
  color: var(--bs-text-mute);
`;

const MobileFilterRow = styled.div`
  display: none;

  @media (max-width: 900px) {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
`;

const ChipScroller = styled.div`
  display: none;

  @media (max-width: 900px) {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.25rem 1rem 0.85rem;
    margin: 0 -1rem;

    &::-webkit-scrollbar { display: none; }
  }
`;

const Chip = styled.button`
  padding: 7px 13px;
  border-radius: 999px;
  background: ${(p) => p.$active ? 'var(--bs-accent)' : 'var(--bs-panel)'};
  color: ${(p) => p.$active ? 'var(--bs-on-accent)' : 'var(--bs-text)'};
  border: ${(p) => p.$active ? 'none' : '1px solid var(--bs-rule-soft)'};
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: -0.1px;
  cursor: pointer;
  flex-shrink: 0;
`;

const Banner = styled.div`
  background: var(--bs-accent);
  color: var(--bs-on-accent);
  border-radius: 14px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 1.4rem;

  @media (max-width: 768px) {
    padding: 14px 16px;
    gap: 12px;
    margin-bottom: 1rem;
    border-radius: 12px;
  }
`;

const BannerIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--bs-accent-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    border-radius: 9px;
  }
`;

const BannerTitle = styled.div`
  font-size: 0.91rem;
  font-weight: 700;
  letter-spacing: -0.2px;

  @media (max-width: 768px) {
    font-size: 0.82rem;
  }
`;

const BannerSub = styled.div`
  font-size: 0.78rem;
  color: rgba(240, 250, 245, 0.78);
  margin-top: 2px;
  line-height: 1.4;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

const BannerButton = styled.a`
  display: none;
  background: var(--bs-body);
  color: var(--bs-text);
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  text-decoration: none;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  @media (min-width: 769px) {
    display: inline-flex;
  }
`;

const MobileFilterButton = styled.button`
  display: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--bs-rule);
  background: var(--bs-panel);
  color: var(--bs-text);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;

  @media (max-width: 900px) {
    display: inline-flex;
  }
`;

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { shopOpen } = useShopConfig();
  const selectedCategory = searchParams.get('category') || '';

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchCatalogueSnapshot({ page_size: 200 });
      setProducts(data.products);
      setCategories(data.categories);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const collections = useMemo(() => {
    return buildCollections(products, categories, selectedCategory);
  }, [products, categories, selectedCategory]);

  const collectionsForRail = useMemo(() => {
    const counts = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: products.filter((p) => p.category_slugs?.includes(c.slug)).length,
    })).filter((c) => c.count > 0);
    return counts;
  }, [products, categories]);

  const totalCount = products.length;
  const activeCollection = categories.find((c) => c.slug === selectedCategory);

  const setCategoryParam = (slug) => {
    const newParams = new URLSearchParams(searchParams);
    if (slug) {
      newParams.set('category', slug);
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  return (
    <BsPage>
      {/* Hero hidden — may be reinstated later
      <BsHero>
        <BsHeroInner>
          <BsOverline>Shop · {totalCount} items</BsOverline>
          <BsH1>Field-ready gear, made for the Singapore birder.</BsH1>
          <BsLead>
            Every purchase supports the Society's research, advocacy and free public outreach. Members enjoy 10% off all year round.
          </BsLead>
        </BsHeroInner>
      </BsHero>
      */}

      {/* Mobile chip filters */}
      <ChipScroller>
        <Chip $active={!selectedCategory} onClick={() => setCategoryParam('')}>All</Chip>
        {collectionsForRail.map((c) => (
          <Chip
            key={c.id}
            $active={selectedCategory === c.slug}
            onClick={() => setCategoryParam(c.slug)}
          >
            {sanitizeText(c.name)}
          </Chip>
        ))}
      </ChipScroller>

      <Layout>
        <Sidebar>
          <RailLabel>Collections</RailLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <CollectionRow
              $active={!selectedCategory}
              onClick={() => setCategoryParam('')}
            >
              <span>All collections</span>
              <CollectionCount>{totalCount}</CollectionCount>
            </CollectionRow>
            {collectionsForRail.map((c) => (
              <CollectionRow
                key={c.id}
                $active={selectedCategory === c.slug}
                onClick={() => setCategoryParam(c.slug)}
              >
                <span>{sanitizeText(c.name)}</span>
                <CollectionCount>{c.count}</CollectionCount>
              </CollectionRow>
            ))}
          </div>
        </Sidebar>

        <Content>
          <TopBar>
            <TopBarTitle>
              <TopBarH>
                {activeCollection ? sanitizeText(activeCollection.name) : 'All products'}
              </TopBarH>
              <TopBarSub>
                {`${activeCollection ? products.filter((p) => p.category_slugs?.includes(activeCollection.slug)).length : totalCount} items`}
              </TopBarSub>
            </TopBarTitle>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <MobileFilterRow>
                <MobileFilterButton aria-label="Filters">
                  <SlidersHorizontal size={16} />
                </MobileFilterButton>
              </MobileFilterRow>
            </div>
          </TopBar>

          <Banner>
            <BannerIcon>
              <Heart size={22} />
            </BannerIcon>
            <div style={{ flex: 1 }}>
              <BannerTitle>Every purchase funds our programs</BannerTitle>
              <BannerSub>BirdSoc SG is a volunteer-run Society. All proceeds from the shop go towards our operating costs, like hosting our websites online and free public outreach efforts.
              </BannerSub>
            </div>
            <BannerButton href="https://birdsociety.sg/about-us/" target="_blank" rel="noopener noreferrer">
              Learn more →
            </BannerButton>
          </Banner>

          {shopOpen && <BundleGrid />}

          {loading && <Loading text="Loading products..." />}

          {error && <Alert variant="error">{error}</Alert>}

          {!loading && !error && (
            <>
              {collections.length > 0 ? (
                collections.map((collection) => (
                  <CollectionSection
                    key={collection.id}
                    collection={collection}
                  />
                ))
              ) : (
                <Alert variant="info">
                  No products found matching your criteria.
                </Alert>
              )}
            </>
          )}
        </Content>
      </Layout>
    </BsPage>
  );
};

export default Products;
