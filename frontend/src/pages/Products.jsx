import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Search, SlidersHorizontal } from 'lucide-react';
import { catalogueService } from '../services/catalogue';
import { Input, Button, FormGroup, Label } from '../styles/GlobalStyles';
import CollectionSection from '../components/CollectionSection';
import BannerGrid from '../components/BannerGrid';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { sanitizeText } from '../utils/safeContent';
import { debounce } from '../utils/helpers';

const ProductsContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 1rem;
`;

const FiltersSection = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const FiltersHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 1rem;
  align-items: end;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SearchContainer = styled.div`
  position: relative;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
`;

const SearchInput = styled(Input)`
  padding-left: 2.5rem;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 1rem;
  background-color: #f1f1f1;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }
`;

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');

  const debouncedSearch = debounce((query) => {
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set('q', query);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  }, 500);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page_size: 200 };
      const query = searchParams.get('q');
      if (query) params.q = query;

      const [productsRes, categoriesRes] = await Promise.all([
        catalogueService.getProducts(params),
        catalogueService.getCategories(true),
      ]);

      setProducts(productsRes.results || productsRes);
      setCategories(categoriesRes.results || categoriesRes);
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
    const categoryFilter = searchParams.get('category');

    const filtered = categoryFilter
      ? categories.filter((c) => c.slug === categoryFilter)
      : categories;

    const grouped = filtered
      .map((cat) => ({
        ...cat,
        products: products.filter(
          (p) => p.category_slugs && p.category_slugs.includes(cat.slug)
        ),
      }))
      .filter((col) => col.products.length > 0);

    // Products not in any category
    if (!categoryFilter) {
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
    }

    return grouped;
  }, [products, categories, searchParams]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setSelectedCategory(value);
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('category', value);
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSearchParams({});
  };

  return (
    <ProductsContainer>
      <Header>
        <Title>Products</Title>
      </Header>

      <BannerGrid type="product" />

      <FiltersSection>
        <FiltersHeader>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SlidersHorizontal size={20} />
            Filters
          </h3>
          <Button variant="secondary" size="small" onClick={clearFilters}>
            Clear All
          </Button>
        </FiltersHeader>

        <FiltersGrid>
          <FormGroup style={{ margin: 0 }}>
            <Label htmlFor="search">Search Products</Label>
            <SearchContainer>
              <SearchIcon>
                <Search size={18} />
              </SearchIcon>
              <SearchInput
                id="search"
                type="text"
                placeholder="Search for products..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </SearchContainer>
          </FormGroup>

          <FormGroup style={{ margin: 0 }}>
            <Label htmlFor="category">Collection</Label>
            <Select
              id="category"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Collections</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {sanitizeText(category.name)}
                </option>
              ))}
            </Select>
          </FormGroup>
        </FiltersGrid>
      </FiltersSection>

      {loading && <Loading text="Loading products..." />}

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <>
          {collections.length > 0 ? (
            collections.map((collection) => (
              <CollectionSection key={collection.id} collection={collection} />
            ))
          ) : (
            <Alert variant="info">
              No products found matching your criteria.
            </Alert>
          )}
        </>
      )}
    </ProductsContainer>
  );
};

export default Products;
