import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { bannerService } from '../services/misc';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const BannerItem = styled.div`
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
`;

const BannerImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const BannerGrid = ({ type = null }) => {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    bannerService.getBanners(type).then(setBanners).catch(() => {});
  }, [type]);

  if (banners.length === 0) return null;

  return (
    <Grid>
      {banners.map((banner) => (
        <BannerItem key={banner.id}>
          <BannerImg
            src={banner.thumbnail || banner.image}
            srcSet={banner.thumbnail && banner.image
              ? `${banner.thumbnail} 900w, ${banner.image} 1800w`
              : undefined}
            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
            alt=""
          />
        </BannerItem>
      ))}
    </Grid>
  );
};

export default BannerGrid;
