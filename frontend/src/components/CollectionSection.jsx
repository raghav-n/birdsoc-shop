import React from 'react';
import styled from 'styled-components';
import {
  BsSectionLabel,
  BsSectionLabelOverline,
} from '../styles/birdsoc';
import { getImageUrl } from '../utils/helpers';
import { sanitizeText } from '../utils/safeContent';
import ProductCard from './ProductCard';

const Section = styled.section`
  margin-bottom: 3rem;
`;

const Banner = styled.div`
  width: 100%;
  aspect-ratio: 16 / 5;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 1.25rem;
  background: var(--bs-photo-bg);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
`;

const CollectionSection = ({ collection }) => {
  return (
    <Section>
      {collection.image && (
        <Banner>
          <img src={getImageUrl(collection.image)} alt={sanitizeText(collection.name)} />
        </Banner>
      )}
      <BsSectionLabel>
        <div>
          <BsSectionLabelOverline>{sanitizeText(collection.name)}</BsSectionLabelOverline>
        </div>
      </BsSectionLabel>
      <Grid>
        {collection.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Grid>
    </Section>
  );
};

export default CollectionSection;
