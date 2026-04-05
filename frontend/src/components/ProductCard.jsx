import React, { useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Card, Button } from '../styles/GlobalStyles';
import { formatCurrency, getImageUrl, isProductInStock } from '../utils/helpers';
import { trackAddToCart } from '../utils/analytics';
import { sanitizeText } from '../utils/safeContent';
import { useCart } from '../context/CartContext';

const ProductCardContainer = styled(Card)`
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 6px;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  }
`;

const ProductImage = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  background-color: #f0f0f0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
    transform-origin: center center;
  }
`;

const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.65rem 0.75rem 0.5rem;
`;

const ProductTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--dark);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PriceSection = styled.div`
  margin-bottom: 0.5rem;
`;

const Price = styled.div`
  font-size: 0.95rem;
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

const OutOfStockBadge = styled.div`
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 0.25rem;
`;

const ProductActions = styled.div`
  padding: 0 0.75rem 0.75rem;
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
  width: calc(100% - 1.5rem);
  margin: 0 0.75rem 0.75rem;
  padding: 0.5rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 0.875rem;
  background-color: #f1f1f1;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }
`;

// Compute the CSS object-position values that center a focal point (fx%, fy%)
// in a square crop, accounting for the image's actual aspect ratio.
function focalPointToObjectPosition(fx, fy, naturalW, naturalH) {
  const ratio = naturalW / naturalH;
  let cssX, cssY;
  if (ratio > 1) {
    // Landscape: width overflows. Solve for cssX to center focal point.
    cssX = Math.max(0, Math.min(100, (fx * ratio - 50) / (ratio - 1)));
    cssY = fy;
  } else if (ratio < 1) {
    // Portrait: height overflows.
    const inv = 1 / ratio;
    cssX = fx;
    cssY = Math.max(0, Math.min(100, (fy * inv - 50) / (inv - 1)));
  } else {
    cssX = fx;
    cssY = fy;
  }
  return `${cssX}% ${cssY}%`;
}

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
    const result = await addToCart(cartProductId, 1);
    if (result?.success) {
      trackAddToCart(product, selectedChild, 1, displayPrice);
    }
  };

  const inStock = isProductInStock({ stock: displayStock });
  const primaryImage = product.images?.[0];
  const fx = primaryImage?.focal_point_x ?? 50;
  const fy = primaryImage?.focal_point_y ?? 50;
  const zoom = primaryImage?.zoom_level ?? 1.0;
  const [objectPosition, setObjectPosition] = useState(`${fx}% ${fy}%`);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setObjectPosition(focalPointToObjectPosition(fx, fy, naturalWidth, naturalHeight));
    }
  };

  return (
    <ProductCardContainer>
      <Link to={`/products/${product.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ProductImage>
          {primaryImage ? (
            <img
              src={getImageUrl(primaryImage.thumbnail || primaryImage.original)}
              srcSet={primaryImage.thumbnail && primaryImage.original
                ? `${getImageUrl(primaryImage.thumbnail)} 648w, ${getImageUrl(primaryImage.original)} 1200w`
                : undefined}
              sizes="162px"
              alt={sanitizeText(primaryImage.caption || product.title)}
              style={{ objectPosition, transform: `scale(${zoom})` }}
              onLoad={handleImageLoad}
            />
          ) : (
            <ImagePlaceholder>
              No Image Available
            </ImagePlaceholder>
          )}
        </ProductImage>

        <ProductInfo>
          <ProductTitle>{sanitizeText(product.title)}</ProductTitle>

          <PriceSection>
            <Price>
              {formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}
              {displayPrice?.crossed_out_price && (
                <CrossedOutPrice>{formatCurrency(displayPrice.crossed_out_price, displayPrice.currency)}</CrossedOutPrice>
              )}
            </Price>
          </PriceSection>

          {!inStock && <OutOfStockBadge>Out of stock</OutOfStockBadge>}
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

      {shopOpen && (
        <ProductActions>
          <Button
            onClick={handleAddToCart}
            disabled={!inStock}
            size="small"
            fullWidth
          >
            <ShoppingCart size={16} />
            Add to Cart
          </Button>
        </ProductActions>
      )}
    </ProductCardContainer>
  );
};

export default ProductCard;
