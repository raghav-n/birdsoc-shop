import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { formatCurrency, getImageUrl } from '../utils/helpers';
import { sanitizeText } from '../utils/safeContent';
import {
  BsSectionLabel,
  BsSectionLabelOverline,
  BsSectionLabelSub,
} from '../styles/birdsoc';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Overline = styled.div`
  font-family: var(--bs-mono);
  font-size: 10.5px;
  color: var(--bs-accent);
  letter-spacing: 0.7px;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const Title = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--bs-text);
  letter-spacing: -0.25px;
  line-height: 1.3;
`;

const Description = styled.div`
  font-size: 0.78rem;
  color: var(--bs-text-mute);
  line-height: 1.4;
`;

const ItemsRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const ItemThumb = styled(Link)`
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bs-photo-bg, #E8EFE5);
  flex-shrink: 0;
  text-decoration: none;
  border: 1px solid var(--bs-rule-soft);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--bs-accent);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const ThumbFallback = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--bs-mono);
  font-size: 9px;
  color: var(--bs-text-mute);
  padding: 4px;
  text-align: center;
  line-height: 1.1;
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
`;

const BundlePrice = styled.span`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bs-accent);
  letter-spacing: -0.4px;
`;

const Crossed = styled.span`
  font-size: 0.82rem;
  color: var(--bs-text-mute);
  text-decoration: line-through;
`;

const SaveTag = styled.span`
  margin-left: auto;
  font-family: var(--bs-mono);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--bs-accent-dim);
  background: var(--bs-accent-soft);
  padding: 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PrimaryButton = styled.button`
  flex: 1;
  background: ${(p) => p.disabled ? 'var(--bs-panel-hi)' : 'var(--bs-accent)'};
  color: ${(p) => p.disabled ? 'var(--bs-text-mute)' : 'var(--bs-on-accent, #fff)'};
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  font-family: var(--bs-sans);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: ${(p) => p.disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--bs-accent-dim);
  }
`;

const SecondaryLink = styled(Link)`
  flex: 1;
  background: var(--bs-accent);
  color: var(--bs-on-accent, #fff);
  border-radius: 8px;
  padding: 9px 14px;
  font-family: var(--bs-sans);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  text-align: center;
  text-decoration: none;
  transition: background 0.15s ease;

  &:hover {
    background: var(--bs-accent-dim);
  }
`;

const FlexNote = styled.div`
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  font-style: italic;
`;

const initials = (title) => {
  if (!title) return '';
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
};

const BundleCard = ({ bundle }) => {
  const { addToCart, shopOpen } = useCart();
  const [adding, setAdding] = useState(false);

  const isFixedSet = bundle.condition_type === 'Coverage';
  const currency = bundle.currency || 'SGD';
  const original = Number(bundle.original_price);
  const price = Number(bundle.bundle_price);
  const savings = Number(bundle.savings);

  const handleAddBundle = async () => {
    if (adding || !shopOpen) return;
    setAdding(true);
    try {
      for (const item of bundle.items) {
        await addToCart(item.product_id, 1);
      }
    } finally {
      setAdding(false);
    }
  };

  // For "any N" bundles (e.g. shirts) we can't auto-pick variants,
  // so direct shoppers to the matching collection page.
  const flexLinkTarget = !isFixedSet
    ? (bundle.category_slug ? `/products?category=${bundle.category_slug}` : '/products')
    : null;

  return (
    <Card>
      <Header>
        <TitleBlock>
          <Overline><Sparkles size={11} strokeWidth={2.4} />Bundle deal</Overline>
          <Title>{sanitizeText(bundle.name)}</Title>
          {bundle.description && (
            <Description>{sanitizeText(bundle.description)}</Description>
          )}
        </TitleBlock>
      </Header>

      <ItemsRow>
        {bundle.items.map((item) => (
          <ItemThumb
            key={item.product_id}
            to={`/products/${item.product_id}`}
            title={item.title}
          >
            {item.image ? (
              <img
                src={getImageUrl(item.image)}
                alt={sanitizeText(item.title)}
                loading="lazy"
              />
            ) : (
              <ThumbFallback>{initials(item.title)}</ThumbFallback>
            )}
          </ItemThumb>
        ))}
      </ItemsRow>

      <PriceRow>
        <BundlePrice>{formatCurrency(price, currency)}</BundlePrice>
        {original > price && (
          <Crossed>{formatCurrency(original, currency)}</Crossed>
        )}
        {savings > 0 && (
          <SaveTag>Save {formatCurrency(savings, currency)}</SaveTag>
        )}
      </PriceRow>

      <ActionRow>
        {isFixedSet ? (
          <PrimaryButton
            onClick={handleAddBundle}
            disabled={adding || !shopOpen}
          >
            <Plus size={13} strokeWidth={2.6} />
            {adding ? 'Adding…' : 'Add bundle to cart'}
          </PrimaryButton>
        ) : (
          <SecondaryLink to={flexLinkTarget || '/products'}>
            Pick {bundle.condition_value} →
          </SecondaryLink>
        )}
      </ActionRow>

      {!isFixedSet && (
        <FlexNote>
          Discount applies automatically once you have {bundle.condition_value} in your cart.
        </FlexNote>
      )}
    </Card>
  );
};

const BundleGrid = ({ title, subtitle }) => {
  const [bundles, setBundles] = useState([]);

  useEffect(() => {
    api.get('/bundles')
      .then((res) => setBundles(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  if (bundles.length === 0) return null;

  return (
    <>
      {title && (
        <BsSectionLabel>
          <div>
            <BsSectionLabelOverline>{title}</BsSectionLabelOverline>
            {subtitle && <BsSectionLabelSub>{subtitle}</BsSectionLabelSub>}
          </div>
        </BsSectionLabel>
      )}
      <Grid>
        {bundles.map((bundle) => (
          <BundleCard key={bundle.id} bundle={bundle} />
        ))}
      </Grid>
    </>
  );
};

export default BundleGrid;
