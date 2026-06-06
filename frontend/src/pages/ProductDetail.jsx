import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  ArrowLeft, ShoppingCart, Plus, Minus, X, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Truck, ShieldCheck, Heart,
} from 'lucide-react';
import { catalogueService } from '../services/catalogue';
import { useCart } from '../context/CartContext';
import {
  BsPage, BsPill, BsButton, BsCard, BsMono,
} from '../styles/birdsoc';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import SafeHtml from '../components/SafeHtml';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency, getImageUrl, isProductInStock, getStockStatus } from '../utils/helpers';
import { trackViewItem, trackAddToCart } from '../utils/analytics';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 2rem 4rem;

  @media (max-width: 768px) {
    padding: 0.5rem 1rem 7rem; /* leave room for sticky bottom on mobile */
  }
`;

const Breadcrumb = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--bs-mono);
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-bottom: 1.75rem;

  a {
    color: inherit;
    text-decoration: none;
    transition: color 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  a:hover { color: var(--bs-text); }
`;

const Crumb = styled.span`
  color: ${(p) => p.$current ? 'var(--bs-text)' : 'inherit'};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 3.5rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
`;

const GalleryWrap = styled.div``;

const MainImage = styled.div`
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);
  aspect-ratio: 1 / 1;
  cursor: ${(p) => p.$hasImage ? 'zoom-in' : 'default'};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const MainBadges = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const ZoomFab = styled.button`
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--bs-body);
  border: 1px solid var(--bs-rule);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--bs-text);
  cursor: pointer;

  &:hover { background: var(--bs-panel-hi); }
`;

const Dots = styled.div`
  display: none;
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  gap: 4px;
  justify-content: center;

  @media (max-width: 900px) {
    display: flex;
  }
`;

const Dot = styled.div`
  width: ${(p) => p.$active ? 18 : 6}px;
  height: 6px;
  border-radius: 999px;
  background: ${(p) => p.$active ? 'var(--bs-accent)' : 'rgba(255,255,255,0.65)'};
`;

const Thumbs = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 12px;

  @media (max-width: 900px) {
    display: none;
  }
`;

const Thumb = styled.button`
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid ${(p) => p.$active ? 'var(--bs-accent)' : 'transparent'};
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);
  cursor: pointer;
  padding: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const Info = styled.div``;

const Overline = styled.div`
  font-family: var(--bs-mono);
  font-size: 11.5px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--bs-accent-dim);
  font-weight: 700;
  margin-bottom: 12px;
`;

const Title = styled.h1`
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1.1;
  margin: 0;
  color: var(--bs-text);

  @media (max-width: 768px) {
    font-size: 1.5rem;
    letter-spacing: -0.6px;
  }
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-top: 1.1rem;
  flex-wrap: wrap;
`;

const Price = styled.div`
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--bs-accent);
  letter-spacing: -0.6px;

  @media (max-width: 768px) {
    font-size: 1.4rem;
    letter-spacing: -0.4px;
  }
`;

const CrossedOut = styled.span`
  font-size: 1rem;
  color: var(--bs-text-mute);
  text-decoration: line-through;
`;

const DescBlock = styled.div`
  font-size: 0.9rem;
  color: var(--bs-text-dim);
  line-height: 1.7;
  margin-top: 1.4rem;
`;

const VariantSection = styled.div`
  margin-top: 1.75rem;
`;

const VariantHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
`;

const VariantLabel = styled.div`
  font-family: var(--bs-sans);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.2px;
  text-transform: uppercase;
`;

const VariantPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const VariantPill = styled.button`
  min-width: 42px;
  height: 40px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1.5px solid ${(p) => p.$active ? 'var(--bs-accent)' : 'var(--bs-rule)'};
  background: ${(p) => p.$active ? 'var(--bs-accent-tint)' : 'var(--bs-panel)'};
  color: ${(p) => p.$active ? 'var(--bs-accent-dim)' : 'var(--bs-text)'};
  font-family: var(--bs-sans);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.2px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) { border-color: var(--bs-accent); }
  &:disabled { opacity: 0.35; cursor: not-allowed; background: var(--bs-panel); color: var(--bs-muted); border-color: var(--bs-rule); }
`;

const StockCard = styled(BsCard)`
  margin-top: 1.75rem;
  padding: 20px;
`;

const StockHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
`;

const StockDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) =>
    p.$state === 'out' ? 'var(--bs-danger)' :
    p.$state === 'low' ? 'var(--bs-warn)' :
    'var(--bs-accent)'};
`;

const StockLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--bs-text);
`;

const ActionRow = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: 480px) {
    gap: 8px;
  }
`;

const Qty = styled.div`
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--bs-rule);
  border-radius: 10px;
  background: var(--bs-body);
  overflow: hidden;
`;

const QtyBtn = styled.button`
  width: 44px;
  height: 48px;
  background: transparent;
  border: none;
  color: var(--bs-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: var(--bs-panel-hi);
  }

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const QtyDisp = styled.div`
  width: 40px;
  font-family: var(--bs-mono);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
`;

const TrustRow = styled.div`
  display: flex;
  gap: 18px;
  margin-top: 16px;
  font-family: var(--bs-mono);
  font-size: 11.5px;
  color: var(--bs-text-dim);
  letter-spacing: 0.3px;
  text-transform: uppercase;
  flex-wrap: wrap;
`;

const TrustItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const AttrSection = styled.div`
  margin-top: 1.875rem;
`;

const AttrTitle = styled.div`
  font-family: var(--bs-sans);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin-bottom: 12px;
`;

const AttrTable = styled.div`
  border: 1px solid var(--bs-rule-soft);
  border-radius: 12px;
  overflow: hidden;
`;

const AttrRow = styled.div`
  display: grid;
  grid-template-columns: 160px 1fr;
  padding: 12px 16px;
  font-size: 0.85rem;
  border-top: ${(p) => p.$first ? 'none' : '1px solid var(--bs-rule-soft)'};
  background: ${(p) => p.$even ? 'var(--bs-panel)' : 'transparent'};

  @media (max-width: 480px) {
    grid-template-columns: 100px 1fr;
    padding: 11px 14px;
  }
`;

const AttrName = styled.div`
  color: var(--bs-text-mute);
  font-family: var(--bs-mono);
  font-size: 11.5px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  align-self: center;
`;

const AttrValue = styled.div`
  color: var(--bs-text);
`;

const StickyBottom = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 12px 16px;
    background: var(--bs-body);
    border-top: 1px solid var(--bs-rule-soft);
    gap: 10px;
    align-items: center;
  }
`;

const DesktopOnlyAdd = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(31, 45, 38, 0.9);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalContent = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const ModalImage = styled.img`
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  transform: scale(${(p) => p.$zoom}) translate(${(p) => p.$dx}px, ${(p) => p.$dy}px);
  transform-origin: center center;
  transition: ${(p) => p.$dragging ? 'none' : 'transform 0.1s ease'};
  cursor: ${(p) => p.$zoom > 1 ? (p.$dragging ? 'grabbing' : 'grab') : 'zoom-in'};
  user-select: none;
`;

const ModalIconBtn = styled.button`
  position: fixed;
  background: rgba(250, 246, 236, 0.15);
  border: none;
  color: var(--bs-on-accent);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2001;

  &:hover { background: rgba(250, 246, 236, 0.25); }

  &:disabled { opacity: 0.35; }
`;

const ModalControls = styled.div`
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.5);
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  z-index: 2001;
`;

const ZoomLevel = styled.span`
  color: white;
  font-family: var(--bs-mono);
  font-size: 0.78rem;
  min-width: 3rem;
  text-align: center;
  letter-spacing: 0.3px;
`;

const getVariantLabel = (child, parentTitle) => {
  if (child.attributes && child.attributes.length > 0) {
    return child.attributes.map((a) => a.value).join(' / ');
  }
  return child.title.replace(parentTitle, '').replace(/^\s*[-–—]\s*/, '').trim() || child.title;
};

const isChildInStock = (c) => c.stock?.is_available && (c.stock?.num_in_stock == null || c.stock.num_in_stock > 0);

const pickDefaultChild = (children) => {
  if (!children || children.length === 0) return null;
  const available = children.filter(isChildInStock);
  const pool = available.length > 0 ? available : children;
  const mChild = pool.find((c) => getVariantLabel(c, '').toUpperCase() === 'M');
  return mChild || pool[0];
};

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const { addToCart, shopOpen } = useCart();
  const [isNarrow, setIsNarrow] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const openModal = useCallback((index) => {
    setModalIndex(index);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const modalNav = useCallback((dir, totalImages) => {
    setModalIndex(i => (i + dir + totalImages) % totalImages);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const changeZoom = useCallback((delta) => {
    setZoom(z => Math.min(5, Math.max(1, parseFloat((z + delta).toFixed(1)))));
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    changeZoom(e.deltaY < 0 ? 0.2 : -0.2);
  }, [changeZoom]);

  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !dragStart.current) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const productData = await catalogueService.getProduct(id);
        setProduct(productData);
        if (productData.structure === 'parent' && productData.children?.length > 0) {
          const defaultChild = pickDefaultChild(productData.children);
          setSelectedChildId(defaultChild?.id);
          trackViewItem(productData, defaultChild);
        } else {
          trackViewItem(productData);
        }
      } catch (err) {
        setError('Failed to load product details');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) return <BsPage><Container><Loading text="Loading product details..." /></Container></BsPage>;

  if (error || !product) {
    return (
      <BsPage>
        <Container>
          <Breadcrumb>
            <Link to="/products"><ArrowLeft size={11} strokeWidth={1.7} /> Back to shop</Link>
          </Breadcrumb>
          <Alert variant="error">{error || 'Product not found'}</Alert>
        </Container>
      </BsPage>
    );
  }

  const isParent = product.structure === 'parent' && product.children?.length > 0;
  const selectedChild = isParent
    ? product.children.find((c) => c.id === selectedChildId)
    : null;
  const displayPrice = selectedChild?.price || product.price;
  const displayStock = selectedChild?.stock || product.stock;
  const cartProductId = isParent ? selectedChildId : product.id;

  const stockStatus = getStockStatus({ stock: displayStock });
  const inStock = isProductInStock({ stock: displayStock });
  const images = product.images || [];
  const selectedImage = images[selectedImageIndex];

  const handleAddToCart = async () => {
    if (!cartProductId) return;
    setAddingToCart(true);
    const result = await addToCart(cartProductId, quantity);
    if (result?.success) {
      trackAddToCart(product, selectedChild, quantity, displayPrice);
    }
    setAddingToCart(false);
  };

  const incrementQuantity = () => {
    if (displayStock?.num_in_stock == null || quantity < displayStock.num_in_stock) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const stockState = !inStock ? 'out' : stockStatus === 'Low Stock' ? 'low' : 'ok';

  const collectionName = product.category_names?.[0];
  const hasCrossedOut = !!displayPrice?.crossed_out_price;
  const savePercent = hasCrossedOut
    ? Math.round((1 - displayPrice.incl_tax / displayPrice.crossed_out_price) * 100)
    : 0;

  return (
    <BsPage>
      <Container>
        <Breadcrumb>
          <Link to="/products">Shop</Link>
          {collectionName && (
            <>
              <ChevronRight size={11} strokeWidth={1.7} />
              <Link to={`/products?category=${product.category_slugs?.[0] || ''}`}>
                {sanitizeText(collectionName)}
              </Link>
            </>
          )}
        </Breadcrumb>

        <Grid>
          <GalleryWrap>
            <MainImage
              $hasImage={!!selectedImage}
              onClick={() => selectedImage && openModal(selectedImageIndex)}
            >
              {selectedImage ? (
                <img
                  src={getImageUrl(selectedImage.original)}
                  alt={sanitizeText(selectedImage.caption || product.title)}
                />
              ) : null}
              <MainBadges>
                {hasCrossedOut && savePercent > 0 && (
                  <BsPill $tone="coral">Save {savePercent}%</BsPill>
                )}
                {stockState === 'low' && <BsPill $tone="amber">Low stock</BsPill>}
              </MainBadges>
              {selectedImage && (
                <ZoomFab
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openModal(selectedImageIndex); }}
                  aria-label="Zoom"
                >
                  <ZoomIn size={16} strokeWidth={1.7} />
                </ZoomFab>
              )}
              {images.length > 1 && (
                <Dots>
                  {images.map((_, i) => <Dot key={i} $active={i === selectedImageIndex} />)}
                </Dots>
              )}
            </MainImage>

            {images.length > 1 && (
              <Thumbs>
                {images.slice(0, 5).map((image, index) => (
                  <Thumb
                    key={index}
                    $active={index === selectedImageIndex}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <img
                      src={getImageUrl(image.thumbnail || image.original)}
                      alt={sanitizeText(image.caption || `${product.title} ${index + 1}`)}
                    />
                  </Thumb>
                ))}
              </Thumbs>
            )}
          </GalleryWrap>

          {modalOpen && (
            <ModalOverlay onClick={closeModal}>
              <ModalContent
                onClick={e => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <ModalImage
                  src={getImageUrl(images[modalIndex].original)}
                  alt={sanitizeText(images[modalIndex].caption || product.title)}
                  $zoom={zoom}
                  $dx={pan.x / zoom}
                  $dy={pan.y / zoom}
                  $dragging={dragging}
                  onClick={() => zoom < 5 && changeZoom(0.5)}
                  draggable={false}
                />
              </ModalContent>

              <ModalIconBtn onClick={closeModal} style={{ top: '1rem', right: '1rem' }} aria-label="Close">
                <X size={20} strokeWidth={1.7} />
              </ModalIconBtn>

              {images.length > 1 && (
                <>
                  <ModalIconBtn
                    style={{ top: '50%', left: '1rem', transform: 'translateY(-50%)', width: 44, height: 44 }}
                    onClick={e => { e.stopPropagation(); modalNav(-1, images.length); }}
                    aria-label="Previous"
                  >
                    <ChevronLeft size={24} strokeWidth={1.7} />
                  </ModalIconBtn>
                  <ModalIconBtn
                    style={{ top: '50%', right: '1rem', transform: 'translateY(-50%)', width: 44, height: 44 }}
                    onClick={e => { e.stopPropagation(); modalNav(1, images.length); }}
                    aria-label="Next"
                  >
                    <ChevronRight size={24} strokeWidth={1.7} />
                  </ModalIconBtn>
                </>
              )}

              <ModalControls onClick={e => e.stopPropagation()}>
                <ModalIconBtn
                  style={{ position: 'static', width: 32, height: 32, background: 'transparent' }}
                  onClick={() => changeZoom(-0.5)}
                  disabled={zoom <= 1}
                >
                  <ZoomOut size={18} strokeWidth={1.7} />
                </ModalIconBtn>
                <ZoomLevel>{Math.round(zoom * 100)}%</ZoomLevel>
                <ModalIconBtn
                  style={{ position: 'static', width: 32, height: 32, background: 'transparent' }}
                  onClick={() => changeZoom(0.5)}
                  disabled={zoom >= 5}
                >
                  <ZoomIn size={18} strokeWidth={1.7} />
                </ModalIconBtn>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.72rem', cursor: 'pointer', padding: '0.25rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  disabled={zoom === 1}
                >
                  Reset
                </button>
              </ModalControls>
            </ModalOverlay>
          )}

          <Info>
            {collectionName && (
              <Overline>
                {sanitizeText(collectionName)}
                {product.upc && <> · SKU {sanitizeText(product.upc)}</>}
              </Overline>
            )}
            <Title>{sanitizeText(product.title)}</Title>

            <PriceRow>
              <Price>{formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}</Price>
              {hasCrossedOut && (
                <CrossedOut>
                  {formatCurrency(displayPrice.crossed_out_price, displayPrice.currency)}
                </CrossedOut>
              )}
              {hasCrossedOut && savePercent > 0 && (
                <BsPill $tone="coral">Save {savePercent}%</BsPill>
              )}
            </PriceRow>

            {product.description && (
              <DescBlock>
                <SafeHtml html={product.description} tag="div" />
              </DescBlock>
            )}

            {isParent && (
              <VariantSection>
                <VariantHead>
                  <VariantLabel>Size</VariantLabel>
                </VariantHead>
                <VariantPills>
                  {product.children.map((child) => {
                    const childOos = !child.stock?.is_available || (child.stock?.num_in_stock != null && child.stock.num_in_stock <= 0);
                    return (
                      <VariantPill
                        key={child.id}
                        $active={child.id === selectedChildId}
                        aria-pressed={child.id === selectedChildId}
                        disabled={childOos}
                        onClick={() => {
                          setSelectedChildId(child.id);
                          setQuantity(1);
                        }}
                      >
                        {getVariantLabel(child, product.title)}
                      </VariantPill>
                    );
                  })}
                </VariantPills>
              </VariantSection>
            )}

            <StockCard>
              <StockHead>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StockDot $state={stockState} />
                  <StockLabel>
                    <span>{stockStatus}</span>
                  </StockLabel>
                </div>
              </StockHead>

              {inStock && shopOpen && (
                <DesktopOnlyAdd>
                  <ActionRow>
                    <Qty>
                      <QtyBtn onClick={decrementQuantity} disabled={quantity <= 1} aria-label="Decrease quantity">
                        <Minus size={14} strokeWidth={2} />
                      </QtyBtn>
                      <QtyDisp>{quantity}</QtyDisp>
                      <QtyBtn
                        onClick={incrementQuantity}
                        disabled={displayStock?.num_in_stock != null && quantity >= displayStock.num_in_stock}
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} strokeWidth={2} />
                      </QtyBtn>
                    </Qty>
                    <BsButton
                      $primary
                      $size="lg"
                      $full
                      style={{ flex: 1 }}
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                    >
                      <ShoppingCart size={16} strokeWidth={1.7} />
                      {addingToCart ? 'Adding…' : `Add to cart · ${formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}`}
                    </BsButton>
                  </ActionRow>
                </DesktopOnlyAdd>
              )}

              {!shopOpen && (
                <div style={{ fontSize: '0.84rem', color: 'var(--bs-text-mute)' }}>
                  Shop is currently closed.
                </div>
              )}
            </StockCard>

            {product.attributes && product.attributes.length > 0 && (
              <AttrSection>
                <AttrTitle>Details</AttrTitle>
                <AttrTable>
                  {product.attributes.map((attribute, index) => (
                    <AttrRow key={index} $first={index === 0} $even={index % 2 === 0}>
                      <AttrName>{sanitizeText(attribute.name)}</AttrName>
                      <AttrValue>{sanitizeText(attribute.value)}</AttrValue>
                    </AttrRow>
                  ))}
                </AttrTable>
              </AttrSection>
            )}
          </Info>
        </Grid>

        {inStock && shopOpen && isNarrow && (
          <StickyBottom>
            <Qty>
              <QtyBtn onClick={decrementQuantity} disabled={quantity <= 1} aria-label="Decrease quantity">
                <Minus size={13} strokeWidth={2} />
              </QtyBtn>
              <QtyDisp>{quantity}</QtyDisp>
              <QtyBtn
                onClick={incrementQuantity}
                disabled={displayStock?.num_in_stock != null && quantity >= displayStock.num_in_stock}
                aria-label="Increase quantity"
              >
                <Plus size={13} strokeWidth={2} />
              </QtyBtn>
            </Qty>
            <BsButton
              $primary
              $size="lg"
              $full
              style={{ flex: 1 }}
              onClick={handleAddToCart}
              disabled={addingToCart}
            >
              <ShoppingCart size={16} strokeWidth={1.7} />
              {addingToCart ? 'Adding…' : `Add · ${formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}`}
            </BsButton>
          </StickyBottom>
        )}
      </Container>
    </BsPage>
  );
};

export default ProductDetail;
