import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { ArrowLeft, ShoppingCart, Plus, Minus, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogueService } from '../services/catalogue';
import { useCart } from '../context/CartContext';
import { Button, Card, Badge } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import SafeHtml from '../components/SafeHtml';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency, getImageUrl, isProductInStock, getStockStatus } from '../utils/helpers';
import { trackViewItem, trackAddToCart } from '../utils/analytics';

const ProductContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--link-text);
  text-decoration: none;
  margin-bottom: 2rem;
  font-weight: 500;

  &:hover {
    color: var(--link-text-hover);
  }
`;

const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
`;

const ImageSection = styled.div``;

const MainImage = styled.div`
  width: 100%;
  height: 400px;
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.$hasImage ? 'zoom-in' : 'default'};

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
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
  transform: scale(${props => props.$zoom}) translate(${props => props.$dx}px, ${props => props.$dy}px);
  transform-origin: center center;
  transition: ${props => props.$dragging ? 'none' : 'transform 0.1s ease'};
  cursor: ${props => props.$zoom > 1 ? (props.$dragging ? 'grabbing' : 'grab') : 'zoom-in'};
  user-select: none;
  -webkit-user-drag: none;
`;

const ModalClose = styled.button`
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  &:hover { background: rgba(255,255,255,0.25); }
`;

const ModalControls = styled.div`
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0,0,0,0.5);
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  z-index: 1001;
`;

const ModalControlBtn = styled.button`
  background: none;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  &:hover { background: rgba(255,255,255,0.15); }
  &:disabled { opacity: 0.35; cursor: default; }
`;

const ZoomLevel = styled.span`
  color: white;
  font-size: 0.85rem;
  min-width: 3rem;
  text-align: center;
`;

const ModalNav = styled.button`
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  ${props => props.$side === 'left' ? 'left: 1rem;' : 'right: 1rem;'}
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  &:hover { background: rgba(255,255,255,0.25); }
`;

const ImagePlaceholder = styled.div`
  color: #666;
  font-size: 1rem;
`;

const ThumbnailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
`;

const Thumbnail = styled.div`
  width: 80px;
  height: 80px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid ${props => props.active ? 'var(--link-text)' : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`;

const ProductInfo = styled.div``;

const ProductTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--dark);
  line-height: 1.15;
`;

const ProductDescription = styled.div`
  font-size: 1rem;
  line-height: 1.6;
  color: #666;
  margin-bottom: 1.5rem;
`;

const PriceSection = styled.div`
  margin-bottom: 2rem;
`;

const Price = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: var(--link-text);
  margin-bottom: 0.5rem;
`;

const CrossedOutPrice = styled.span`
  font-size: 1.25rem;
  font-weight: 400;
  color: #999;
  text-decoration: line-through;
  margin-left: 0.75rem;
`;

const StockSection = styled.div`
  margin-bottom: 2rem;
`;

const StockInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const QuantitySection = styled.div`
  margin-bottom: 2rem;
`;

const QuantityLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--dark);
`;

const QuantityControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const QuantityButton = styled.button`
  background: var(--page-header-background);
  border: 1px solid #ddd;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--link-text);
    color: white;
    border-color: var(--link-text);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const QuantityDisplay = styled.div`
  min-width: 60px;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  background: white;
`;

const AddToCartSection = styled.div`
  margin-bottom: 2rem;
`;

const AttributesSection = styled.div`
  margin-top: 2rem;
`;

const AttributesTitle = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: var(--dark);
`;

const AttributesList = styled.div`
  display: grid;
  gap: 0.5rem;
`;

const AttributeItem = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;

  &:last-child {
    border-bottom: none;
  }
`;

const AttributeName = styled.div`
  font-weight: 500;
  color: var(--dark);
`;

const AttributeValue = styled.div`
  color: #666;
`;

const VariantLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--dark);
`;

const VariantBadgesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const VariantBadge = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 2px solid ${props => props.$active ? 'var(--link-text)' : '#e1e1e1'};
  background: ${props => props.$active ? 'var(--link-text)' : 'white'};
  color: ${props => props.$active ? 'white' : 'var(--dark)'};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--link-text);
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
    if (product && quantity < displayStock?.num_in_stock) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  if (loading) return <Loading text="Loading product details..." />;

  if (error) {
    return (
      <ProductContainer>
        <BackLink to="/products">
          <ArrowLeft size={20} />
          Back to Products
        </BackLink>
        <Alert variant="error">
          {error}
        </Alert>
      </ProductContainer>
    );
  }

  if (!product) {
    return (
      <ProductContainer>
        <BackLink to="/products">
          <ArrowLeft size={20} />
          Back to Products
        </BackLink>
        <Alert variant="error">
          Product not found
        </Alert>
      </ProductContainer>
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

  return (
    <ProductContainer>
      <BackLink to="/products">
        <ArrowLeft size={20} />
        Back to Products
      </BackLink>

      <ProductGrid>
        <ImageSection>
          <MainImage
            $hasImage={!!selectedImage}
            onClick={() => selectedImage && openModal(selectedImageIndex)}
          >
            {selectedImage ? (
              <img
                src={getImageUrl(selectedImage.original)}
                alt={sanitizeText(selectedImage.caption || product.title)}
              />
            ) : (
              <ImagePlaceholder>
                No Image Available
              </ImagePlaceholder>
            )}
          </MainImage>

          {images.length > 1 && (
            <ThumbnailGrid>
              {images.map((image, index) => (
                <Thumbnail
                  key={index}
                  active={index === selectedImageIndex}
                  onClick={() => { setSelectedImageIndex(index); openModal(index); }}
                >
                  <img
                    src={getImageUrl(image.original)}
                    alt={sanitizeText(image.caption || `${product.title} ${index + 1}`)}
                  />
                </Thumbnail>
              ))}
            </ThumbnailGrid>
          )}
        </ImageSection>

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

            <ModalClose onClick={closeModal}><X size={20} /></ModalClose>

            {images.length > 1 && (
              <>
                <ModalNav $side="left" onClick={e => { e.stopPropagation(); modalNav(-1, images.length); }}>
                  <ChevronLeft size={24} />
                </ModalNav>
                <ModalNav $side="right" onClick={e => { e.stopPropagation(); modalNav(1, images.length); }}>
                  <ChevronRight size={24} />
                </ModalNav>
              </>
            )}

            <ModalControls onClick={e => e.stopPropagation()}>
              <ModalControlBtn onClick={() => changeZoom(-0.5)} disabled={zoom <= 1}><ZoomOut size={18} /></ModalControlBtn>
              <ZoomLevel>{Math.round(zoom * 100)}%</ZoomLevel>
              <ModalControlBtn onClick={() => changeZoom(0.5)} disabled={zoom >= 5}><ZoomIn size={18} /></ModalControlBtn>
              <ModalControlBtn onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} disabled={zoom === 1} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Reset</ModalControlBtn>
            </ModalControls>
          </ModalOverlay>
        )}

        <ProductInfo>
          <ProductTitle>{sanitizeText(product.title)}</ProductTitle>

          {product.description && (
            <SafeHtml 
              html={product.description}
              tag="div"
              className="product-description"
              style={{
                fontSize: '1rem',
                lineHeight: '1.6',
                color: '#666',
                marginBottom: '1.5rem'
              }}
            />
          )}

          <PriceSection>
            <Price>
              {formatCurrency(displayPrice?.incl_tax, displayPrice?.currency)}
              {displayPrice?.crossed_out_price && (
                <CrossedOutPrice>{formatCurrency(displayPrice.crossed_out_price, displayPrice.currency)}</CrossedOutPrice>
              )}
            </Price>
          </PriceSection>

          {isParent && (
            <div style={{ marginBottom: '1.5rem' }}>
              <VariantLabel>Size</VariantLabel>
              <VariantBadgesContainer>
                {product.children.map((child) => (
                  <VariantBadge
                    key={child.id}
                    $active={child.id === selectedChildId}
                    onClick={() => {
                      setSelectedChildId(child.id);
                      setQuantity(1);
                    }}
                  >
                    {getVariantLabel(child, product.title)}
                  </VariantBadge>
                ))}
              </VariantBadgesContainer>
            </div>
          )}

          <StockSection>
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
          </StockSection>

          {inStock && shopOpen && (
            <>
              <QuantitySection>
                <QuantityLabel>Quantity</QuantityLabel>
                <QuantityControls>
                  <QuantityButton
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <Minus size={16} />
                  </QuantityButton>
                  <QuantityDisplay>{quantity}</QuantityDisplay>
                  <QuantityButton
                    onClick={incrementQuantity}
                    disabled={quantity >= displayStock?.num_in_stock}
                  >
                    <Plus size={16} />
                  </QuantityButton>
                </QuantityControls>
              </QuantitySection>

              <AddToCartSection>
                <Button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !inStock}
                  size="large"
                  fullWidth
                >
                  <ShoppingCart size={20} />
                  {addingToCart ? 'Adding to Cart...' : 'Add to Cart'}
                </Button>
              </AddToCartSection>
            </>
          )}

          {product.attributes && product.attributes.length > 0 && (
            <AttributesSection>
              <AttributesTitle>Product Details</AttributesTitle>
              <Card>
                <AttributesList>
                  {product.attributes.map((attribute, index) => (
                    <AttributeItem key={index}>
                      <AttributeName>{sanitizeText(attribute.name)}</AttributeName>
                      <AttributeValue>{sanitizeText(attribute.value)}</AttributeValue>
                    </AttributeItem>
                  ))}
                </AttributesList>
              </Card>
            </AttributesSection>
          )}
        </ProductInfo>
      </ProductGrid>
    </ProductContainer>
  );
};

export default ProductDetail;
