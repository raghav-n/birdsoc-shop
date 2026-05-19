import React, { useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BsPill } from '../styles/birdsoc';
import { formatCurrency, getImageUrl, isProductInStock } from '../utils/helpers';
import { trackAddToCart } from '../utils/analytics';
import { sanitizeText } from '../utils/safeContent';
import { useCart } from '../context/CartContext';

const Card = styled.div`
  position: relative;
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  transition: transform 0.15s ease, border-color 0.15s ease;
  opacity: ${(p) => p.$dim ? 0.7 : 1};

  &:hover {
    transform: translateY(-2px);
    border-color: var(--bs-accent);
  }

  @media (max-width: 768px) {
    border-radius: 10px;
  }
`;

const ImageWrap = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--bs-photo-bg);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
    transform-origin: center center;
  }
`;

const ImagePlaceholder = styled.div`
  position: absolute;
  inset: 0;
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bs-accent);
  opacity: 0.55;
  font-family: var(--bs-mono);
  font-size: 0.6rem;
  letter-spacing: 0.6px;
  text-transform: uppercase;
`;

const BadgeStack = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const OutOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(31, 45, 38, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const OutBadge = styled.div`
  background: var(--bs-body);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--bs-text);
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const Info = styled.div`
  padding: 0.9rem 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;

  @media (max-width: 768px) {
    padding: 0.75rem 0.75rem 0.85rem;
  }
`;

const Collection = styled.div`
  font-family: var(--bs-mono);
  font-size: 10.5px;
  color: var(--bs-text-mute);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  min-height: 12px;
`;

const Title = styled.h3`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--bs-text);
  letter-spacing: -0.2px;
  line-height: 1.3;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (max-width: 768px) {
    font-size: 0.84rem;
  }
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 2px;
`;

const Price = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: var(--bs-accent);
  letter-spacing: -0.3px;

  @media (max-width: 768px) {
    font-size: 0.93rem;
  }
`;

const CrossedPrice = styled.span`
  font-size: 0.78rem;
  color: var(--bs-text-mute);
  text-decoration: line-through;
`;

const Footer = styled.div`
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const AddButton = styled.button`
  background: ${(p) => p.disabled ? 'var(--bs-panel-hi)' : 'var(--bs-accent)'};
  color: ${(p) => p.disabled ? 'var(--bs-text-mute)' : 'var(--bs-on-accent)'};
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: ${(p) => p.disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--bs-accent-dim);
  }
`;

const VariantSelect = styled.select`
  margin: 0 0.9rem 0.9rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--bs-rule);
  background: var(--bs-body);
  color: var(--bs-text);
  border-radius: 8px;
  font-family: var(--bs-sans);
  font-size: 0.8rem;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A5C52' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;

  &:focus {
    outline: none;
    border-color: var(--bs-accent);
    box-shadow: 0 0 0 3px var(--bs-accent-tint);
  }

  @media (max-width: 768px) {
    margin: 0 0.75rem 0.75rem;
  }
`;

const CardLink = styled(Link)`
  text-decoration: none;
  color: inherit;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

function focalPointToObjectPosition(fx, fy, naturalW, naturalH) {
  const ratio = naturalW / naturalH;
  let cssX, cssY;
  if (ratio > 1) {
    cssX = Math.max(0, Math.min(100, (fx * ratio - 50) / (ratio - 1)));
    cssY = fy;
  } else if (ratio < 1) {
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

  const lowStock = inStock && displayStock?.num_in_stock != null && displayStock.num_in_stock <= 5;
  const stockLabel = !inStock ? 'Out of stock' : lowStock ? 'Low stock' : 'In stock';
  const stockTone = !inStock ? 'coral' : lowStock ? 'amber' : 'sage';

  const collectionName = product.category_names?.[0] || (isParent ? 'Collection' : '');

  return (
    <Card $dim={!inStock}>
      <CardLink to={`/products/${product.id}`}>
        <ImageWrap>
          {primaryImage ? (
            <img
              src={getImageUrl(primaryImage.thumbnail || primaryImage.original)}
              srcSet={primaryImage.thumbnail && primaryImage.original
                ? `${getImageUrl(primaryImage.thumbnail)} 648w, ${getImageUrl(primaryImage.original)} 1200w`
                : undefined}
              sizes="(max-width: 768px) 50vw, 280px"
              alt={sanitizeText(primaryImage.caption || product.title)}
              style={{ objectPosition, transform: `scale(${zoom})` }}
              onLoad={handleImageLoad}
            />
          ) : (
            <ImagePlaceholder>no image</ImagePlaceholder>
          )}
          {!inStock && (
            <OutOverlay>
              <OutBadge>Out of stock</OutBadge>
            </OutOverlay>
          )}
        </ImageWrap>

        <Info>
          <Collection>{sanitizeText(collectionName)}</Collection>
          <Title>{sanitizeText(product.title)}</Title>
          <PriceRow>
            <Price>{formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}</Price>
            {displayPrice?.crossed_out_price && (
              <CrossedPrice>
                {formatCurrency(displayPrice.crossed_out_price, displayPrice.currency)}
              </CrossedPrice>
            )}
          </PriceRow>

          <Footer>
            <BsPill $tone={stockTone}>{stockLabel}</BsPill>
            {shopOpen && (
              <AddButton
                onClick={handleAddToCart}
                disabled={!inStock}
                aria-label="Add to cart"
              >
                <Plus size={12} strokeWidth={2.4} />
                Add
              </AddButton>
            )}
          </Footer>
        </Info>
      </CardLink>

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
    </Card>
  );
};

export default ProductCard;
