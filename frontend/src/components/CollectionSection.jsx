import React from 'react';
import styled from 'styled-components';
import { Grid } from '../styles/GlobalStyles';
import { getImageUrl } from '../utils/helpers';
import { sanitizeText } from '../utils/safeContent';
import ProductCard from './ProductCard';

const Section = styled.section`
  margin-bottom: 3rem;
`;

const SectionHeader = styled.div`
  margin-bottom: 1.5rem;
`;

const BannerImage = styled.div`
  width: 100%;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  color: var(--dark);
  margin: 0 0 0.5rem 0;
`;

const SectionDescription = styled.p`
  font-size: 0.95rem;
  color: #666;
  margin: 0;
  max-width: 700px;
  line-height: 1.6;
`;

const CollectionSection = ({ collection }) => {
  return (
    <Section>
      <SectionHeader>
        {collection.image && (
          <BannerImage>
            <img
              src={getImageUrl(collection.image)}
              alt={sanitizeText(collection.name)}
            />
          </BannerImage>
        )}
        <SectionTitle>{sanitizeText(collection.name)}</SectionTitle>
        {collection.description && (
          <SectionDescription>{sanitizeText(collection.description)}</SectionDescription>
        )}
      </SectionHeader>
      <Grid minWidth="280px" gap="1.5rem">
        {collection.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Grid>
    </Section>
  );
};

export default CollectionSection;
