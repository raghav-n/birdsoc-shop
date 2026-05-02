import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GlobalStyle } from './styles/GlobalStyles';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ShopConfigProvider, useShopConfig } from './context/ShopConfigContext';
import Layout from './components/Layout';

// Pages
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import OrderSuccess from './pages/OrderSuccess';
import Login from './pages/Login';
import Register from './pages/Register';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import Refund from './pages/Refund';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import OnsitePurchase from './pages/OnsitePurchase';
import Console from './pages/Console';
import OrderLookup from './pages/OrderLookup';
import EventManagement from './pages/EventManagement';
import EventManagementDetail from './pages/EventManagementDetail';
import EventManagementEdit from './pages/EventManagementEdit';
import GuideEventDetail from './pages/GuideEventDetail';
import Donate from './pages/Donate';
import DonationSuccess from './pages/DonationSuccess';
import { trackPageView } from './utils/analytics';
import { buildLoginRedirectPath } from './utils/authRedirect';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const PageViewTracker = () => {
  const { pathname } = useLocation();
  React.useEffect(() => { trackPageView(pathname); }, [pathname]);
  return null;
};

const ShopOpenOnly = ({ children }) => {
  const { shopOpen } = useShopConfig();
  if (!shopOpen) return <Navigate to="/" replace />;
  return children;
};

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={buildLoginRedirectPath(next)} replace />;
  }
  return children;
};

const StaffOnly = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={buildLoginRedirectPath(next)} replace />;
  }
  if (!user.is_staff) return <Navigate to="/" replace />;
  return children;
};

const SuperuserOnly = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={buildLoginRedirectPath(next)} replace />;
  }
  if (!user.is_superuser) return <Navigate to="/" replace />;
  return children;
};

const EventsGroupOnly = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={buildLoginRedirectPath(next)} replace />;
  }
  const allowed = user.is_superuser || (user.groups && user.groups.includes('Events'));
  if (!allowed) return <Navigate to="/console" replace />;
  return children;
};

const MerchandiseGroupOnly = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={buildLoginRedirectPath(next)} replace />;
  }
  const allowed = user.is_superuser || (user.groups && user.groups.includes('Merchandise'));
  if (!allowed) return <Navigate to="/console" replace />;
  return children;
};

function App() {
  return (
    <Router>
        <ScrollToTop />
        <PageViewTracker />
        <GlobalStyle />
        <ShopConfigProvider>
        <AuthProvider>
          <CartProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<ShopOpenOnly><Cart /></ShopOpenOnly>} />
                <Route path="/checkout" element={<ShopOpenOnly><Checkout /></ShopOpenOnly>} />
                <Route path="/orders" element={<ShopOpenOnly><RequireAuth><Orders /></RequireAuth></ShopOpenOnly>} />
                <Route path="/orders/:orderNumber" element={<ShopOpenOnly><RequireAuth><OrderDetail /></RequireAuth></ShopOpenOnly>} />
                <Route path="/order-success" element={<ShopOpenOnly><OrderSuccess /></ShopOpenOnly>} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<ShopOpenOnly><Register /></ShopOpenOnly>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/events" element={<EventsGroupOnly><Events /></EventsGroupOnly>} />
                <Route path="/events/:id" element={<EventsGroupOnly><EventDetail /></EventsGroupOnly>} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/donate/success" element={<DonationSuccess />} />
                <Route path="/console" element={<StaffOnly><Console /></StaffOnly>} />
                <Route path="/console/analytics" element={<SuperuserOnly><Dashboard /></SuperuserOnly>} />
                <Route path="/console/onsite-purchase" element={<MerchandiseGroupOnly><OnsitePurchase /></MerchandiseGroupOnly>} />
                <Route path="/console/order-lookup" element={<MerchandiseGroupOnly><OrderLookup /></MerchandiseGroupOnly>} />
                <Route path="/console/order-lookup/:number" element={<MerchandiseGroupOnly><OrderLookup /></MerchandiseGroupOnly>} />
                <Route path="/console/events" element={<EventsGroupOnly><EventManagement /></EventsGroupOnly>} />
                <Route path="/console/events/new" element={<EventsGroupOnly><EventManagementEdit /></EventsGroupOnly>} />
                <Route path="/console/events/:id" element={<EventsGroupOnly><EventManagementDetail /></EventsGroupOnly>} />
                <Route path="/console/events/:id/edit" element={<EventsGroupOnly><EventManagementEdit /></EventsGroupOnly>} />
                <Route path="/guide/:token" element={<GuideEventDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#333',
                  border: '1px solid #e1e1e1',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                },
                success: {
                  iconTheme: {
                    primary: 'var(--success)',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'var(--danger)',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </CartProvider>
        </AuthProvider>
        </ShopConfigProvider>
      </Router>
  );
}

export default App;
