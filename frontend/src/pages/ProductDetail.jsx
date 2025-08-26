import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { ArrowLeft, ShoppingCart, Plus, Minus } from 'lucide-react';
import { catalogueService } from '../services/catalogue';
import { useCart } from '../context/CartContext';
import { Button, Card, Badge } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import SafeHtml from '../components/SafeHtml';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency, getImageUrl, isProductInStock, getStockStatus } from '../utils/helpers';

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

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
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

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ProductInfo = styled.div``;

const ProductTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--dark);
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

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const productData = await catalogueService.getProduct(id);
        setProduct(productData);
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
    if (!product) return;
    
    setAddingToCart(true);
    await addToCart(product.id, quantity);
    setAddingToCart(false);
  };

  const incrementQuantity = () => {
    if (product && quantity < product.stock?.num_in_stock) {
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

  const stockStatus = getStockStatus(product);
  const inStock = isProductInStock(product);
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
          <MainImage>
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
                  onClick={() => setSelectedImageIndex(index)}
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
              {formatCurrency(product.price?.incl_tax, product.price?.currency)}
            </Price>
          </PriceSection>

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
              {product.stock?.num_in_stock && (
                <span style={{ fontSize: '0.9rem', color: '#666' }}>
                  {product.stock.num_in_stock} available
                </span>
              )}
            </StockInfo>
          </StockSection>

          {inStock && (
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
                    disabled={quantity >= product.stock?.num_in_stock}
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
