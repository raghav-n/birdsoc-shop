import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { catalogueService } from '../services/catalogue';
import { Input, Button, Grid, FormGroup, Label } from '../styles/GlobalStyles';
import ProductCard from '../components/ProductCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
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
  grid-template-columns: 2fr 1fr 1fr auto;
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

const ResultsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e1e1e1;
`;

const ResultsCount = styled.div`
  color: #666;
  font-size: 0.9rem;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
`;

const PageButton = styled(Button)`
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  
  ${props => props.active && `
    background-color: var(--link-text);
    color: white;
  `}
`;

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('ordering') || '');

  const pageSize = 12;

  // Debounced search function
  const debouncedSearch = debounce((query) => {
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set('q', query);
    } else {
      newParams.delete('q');
    }
    newParams.delete('page'); // Reset to first page
    setSearchParams(newParams);
  }, 500);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        page_size: pageSize,
      };

      const query = searchParams.get('q');
      const category = searchParams.get('category');
      const ordering = searchParams.get('ordering');

      if (query) params.q = query;
      if (category) params.category = category;
      if (ordering) params.ordering = ordering;

      const response = await catalogueService.getProducts(params);
      
      setProducts(response.results || response);
      setTotalCount(response.count || (response.results ? response.results.length : response.length));
    } catch (err) {
      setError('Failed to load products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await catalogueService.getCategories(true);
      setCategories(response.results || response);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1;
    setCurrentPage(page);
    fetchProducts();
  }, [searchParams]);

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
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortBy(value);
    
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('ordering', value);
    } else {
      newParams.delete('ordering');
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handlePageChange = (page) => {
    const newParams = new URLSearchParams(searchParams);
    if (page > 1) {
      newParams.set('page', page.toString());
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSortBy('');
    setSearchParams({});
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getPaginationRange = () => {
    const range = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    return range;
  };

  return (
    <ProductsContainer>
      <Header>
        <Title>Products</Title>
      </Header>

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
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup style={{ margin: 0 }}>
            <Label htmlFor="sort">Sort By</Label>
            <Select
              id="sort"
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="">Default</option>
              <option value="title">Name A-Z</option>
              <option value="-title">Name Z-A</option>
              <option value="price">Price Low-High</option>
              <option value="-price">Price High-Low</option>
            </Select>
          </FormGroup>
        </FiltersGrid>
      </FiltersSection>

      {loading && <Loading text="Loading products..." />}

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <>
          <ResultsHeader>
            <ResultsCount>
              {totalCount > 0 ? (
                `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} products`
              ) : (
                'No products found'
              )}
            </ResultsCount>
          </ResultsHeader>

          {products.length > 0 ? (
            <>
              <Grid minWidth="280px" gap="1.5rem">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </Grid>

              {totalPages > 1 && (
                <Pagination>
                  <PageButton
                    variant="secondary"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    Previous
                  </PageButton>

                  {getPaginationRange().map((page) => (
                    <PageButton
                      key={page}
                      active={page === currentPage}
                      variant={page === currentPage ? undefined : 'secondary'}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </PageButton>
                  ))}

                  <PageButton
                    variant="secondary"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next
                  </PageButton>
                </Pagination>
              )}
            </>
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
