import React, { useState } from 'react';
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
  height: 220px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 1rem;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
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

const CrossedOutPrice = styled.span`
  font-size: 0.95rem;
  font-weight: 400;
  color: #999;
  text-decoration: line-through;
  margin-left: 0.5rem;
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

const VariantSelect = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 0.875rem;
  background-color: #f1f1f1;
  margin-bottom: 0.75rem;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }
`;

const getVariantLabel = (child, parentTitle) => {
  if (child.attributes && child.attributes.length > 0) {
    return child.attributes.map((a) => a.value).join(' / ');
  }
  return child.title.replace(parentTitle, '').replace(/^\s*[-–—]\s*/, '').trim() || child.title;
};

const pickDefaultChild = (children) => {
  if (!children || children.length === 0) return null;
  const mChild = children.find((c) => getVariantLabel(c, '').toUpperCase() === 'M');
  return mChild || children[0];
};

const ProductCard = ({ product }) => {
  const { addToCart, shopOpen } = useCart();
  const isParent = product.structure === 'parent' && product.children?.length > 0;

  const [selectedChildId, setSelectedChildId] = useState(
    isParent ? pickDefaultChild(product.children)?.id : null
  );

  const selectedChild = isParent
    ? product.children.find((c) => c.id === selectedChildId)
    : null;

  // For display: use child's price/stock when a variant is selected, else the product's own
  const displayPrice = selectedChild?.price || product.price;
  const displayStock = selectedChild?.stock || product.stock;
  const cartProductId = isParent ? selectedChildId : product.id;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cartProductId) return;
    await addToCart(cartProductId, 1);
  };

  const stockStatus = getStockStatus({ stock: displayStock });
  const inStock = isProductInStock({ stock: displayStock });
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
            <Price>
              {formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}
              {displayPrice?.crossed_out_price && (
                <CrossedOutPrice>{formatCurrency(displayPrice.crossed_out_price, displayPrice.currency)}</CrossedOutPrice>
              )}
            </Price>
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

      {isParent && (
        <VariantSelect
          value={selectedChildId || ''}
          onChange={(e) => {
            e.stopPropagation();
            setSelectedChildId(Number(e.target.value));
          }}
          onClick={(e) => e.preventDefault()}
        >
          {product.children.map((child) => (
            <option key={child.id} value={child.id}>
              {getVariantLabel(child, product.title)}
            </option>
          ))}
        </VariantSelect>
      )}

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
