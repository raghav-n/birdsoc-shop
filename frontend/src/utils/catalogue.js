import { catalogueService } from '../services/catalogue';

export const normalizeCollectionData = (responseData) => responseData?.results || responseData || [];

export const fetchCatalogueSnapshot = async (params = {}) => {
  const [productsRes, categoriesRes] = await Promise.all([
    catalogueService.getProducts(params),
    catalogueService.getCategories(true),
  ]);

  return {
    products: normalizeCollectionData(productsRes),
    categories: normalizeCollectionData(categoriesRes),
  };
};

export const buildCollections = (products, categories, categoryFilter = '') => {
  const filteredCategories = categoryFilter
    ? categories.filter((category) => category.slug === categoryFilter)
    : categories;

  const grouped = filteredCategories
    .map((category) => ({
      ...category,
      products: products.filter(
        (product) => product.category_slugs && product.category_slugs.includes(category.slug)
      ),
    }))
    .filter((collection) => collection.products.length > 0);

  if (categoryFilter) {
    return grouped;
  }

  const categorisedProductIds = new Set(
    categories.flatMap((category) =>
      products
        .filter((product) => product.category_slugs && product.category_slugs.includes(category.slug))
        .map((product) => product.id)
    )
  );

  const uncategorised = products.filter((product) => !categorisedProductIds.has(product.id));
  if (uncategorised.length > 0) {
    grouped.push({
      id: 'uncategorised',
      name: 'Other',
      slug: 'other',
      description: '',
      image: null,
      products: uncategorised,
    });
  }

  return grouped;
};
