import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { ShoppingCart, Eye } from 'lucide-react';
import { Card, Button, Badge } from '../styles/GlobalStyles';
import { formatCurrency, getImageUrl, isProductInStock, getStockStatus } from '../utils/helpers';
import { sanitizeText } from '../utils/safeContent';
import { useCart } from '../context/CartContext';

const ProductCardContainer = styled(Card)`
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
`;

const ProductImage = styled.div`
  width: 100%;
  height: 200px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 1rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  &:hover img {
    transform: scale(1.05);
  }
`;

const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ProductTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--dark);
  line-height: 1.4;
`;

const ProductDescription = styled.p`
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 1rem;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PriceSection = styled.div`
  margin-bottom: 1rem;
`;

const Price = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--link-text);
`;

const StockInfo = styled.div`
  margin-bottom: 1rem;
`;

const ProductActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--page-header-background);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dark);
  font-size: 0.875rem;
`;

const ProductCard = ({ product }) => {
  const { addToCart, shopOpen } = useCart();

  const handleAddToCart = async (e) => {
    e.preventDefault();
    await addToCart(product.id, 1);
  };

  const stockStatus = getStockStatus(product);
  const inStock = isProductInStock(product);
  const primaryImage = product.images?.[0];

  return (
    <ProductCardContainer>
      <Link to={`/products/${product.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ProductImage>
          {primaryImage ? (
            <img 
              src={getImageUrl(primaryImage.original)} 
              alt={sanitizeText(primaryImage.caption || product.title)}
            />
          ) : (
            <ImagePlaceholder>
              No Image Available
            </ImagePlaceholder>
          )}
        </ProductImage>

        <ProductInfo>
          <ProductTitle>{sanitizeText(product.title)}</ProductTitle>
          
          {product.description && (
            <ProductDescription>{sanitizeText(product.description)}</ProductDescription>
          )}

          <PriceSection>
            <Price>{formatCurrency(product.price?.incl_tax, product.price?.currency)}</Price>
          </PriceSection>

          <StockInfo>
            <Badge 
              variant={
                stockStatus === 'In Stock' ? 'success' : 
                stockStatus === 'Low Stock' ? 'warning' : 'danger'
              }
            >
              {stockStatus}
            </Badge>
          </StockInfo>
        </ProductInfo>
      </Link>

      <ProductActions>
        <Button as={Link} to={`/products/${product.id}`} variant="secondary" size="small">
          <Eye size={16} />
          View
        </Button>
        
        {shopOpen && (
          <Button
            onClick={handleAddToCart}
            disabled={!inStock}
            size="small"
            style={{ flex: 1 }}
          >
            <ShoppingCart size={16} />
            Add to Cart
          </Button>
        )}
      </ProductActions>
    </ProductCardContainer>
  );
};

export default ProductCard;
