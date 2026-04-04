# BirdSoc SG Shop Frontend

A modern React frontend for the BirdSoc SG Shop e-commerce platform, built with Vite and styled-components.

## Features

- 🛍️ **Product Catalog** - Browse and search products with filtering and sorting
- 🛒 **Shopping Cart** - Add products to cart with quantity management  
- 👤 **User Authentication** - Login, register, and profile management
- 📱 **Responsive Design** - Mobile-first design that works on all devices
- 🎨 **Modern UI** - Clean, minimalistic design with light theme
- 🔍 **Search** - Real-time product search functionality
- 💳 **Checkout Process** - Streamlined checkout with PayNow integration
- 📋 **Order Management** - View order history and details

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Styled Components** - CSS-in-JS styling
- **React Hook Form** - Form management
- **React Query** - Data fetching and caching
- **Axios** - HTTP client
- **React Hot Toast** - Toast notifications
- **Lucide React** - Icon library

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- BirdSoc SG Shop backend API running on http://localhost:8000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.jsx      # Navigation header
│   ├── Footer.jsx      # Site footer
│   ├── Layout.jsx      # Page layout wrapper
│   ├── ProductCard.jsx # Product display card
│   ├── Loading.jsx     # Loading spinner
│   └── Alert.jsx       # Alert/notification component
├── pages/              # Page components
│   ├── Home.jsx        # Homepage
│   ├── Products.jsx    # Product listing
│   ├── ProductDetail.jsx # Product detail page
│   ├── Cart.jsx        # Shopping cart
│   ├── Login.jsx       # Login page
│   └── Register.jsx    # Registration page
├── context/            # React context providers
│   ├── AuthContext.jsx # Authentication state
│   └── CartContext.jsx # Shopping cart state
├── services/           # API service functions
│   ├── api.js          # Base API configuration
│   ├── auth.js         # Authentication services
│   ├── catalogue.js    # Product catalog services
│   ├── basket.js       # Shopping cart services
│   ├── checkout.js     # Checkout services
│   ├── orders.js       # Order management
│   └── misc.js         # Miscellaneous services
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
│   └── helpers.js      # Common helper functions
├── styles/             # Styled components and global styles
│   └── GlobalStyles.js # Global styles and reusable components
├── App.jsx             # Main app component
└── main.jsx           # App entry point
```

## API Integration

The frontend integrates with the BirdSoc SG Shop Django REST API. Key features include:

- **JWT Authentication** - Secure token-based authentication
- **Guest Cart Support** - Shopping cart for non-authenticated users
- **Automatic Token Refresh** - Seamless session management
- **Error Handling** - Graceful error handling with user feedback

## Styling

The application maintains the original BirdSoc SG Shop design system:

- **Color Scheme**: 
  - Background: `#f8f4f9` (light purple-gray)
  - Header: `#ededed` (light gray)
  - Primary text: `#5c4760` (dark purple-gray)
  - Links: `#4c7a2d` (green) with `#8bc662` hover
- **Typography**: 
  - Headers: "Libre Franklin"
  - Body: "Noto Sans"
- **Design**: Clean, minimalistic with subtle shadows and rounded corners

## Key Components

### Authentication
- Persistent login state with JWT tokens
- Automatic token refresh
- Protected routes for authenticated users

### Shopping Cart
- Guest cart support with localStorage
- Cart merging for user login
- Real-time cart updates

### Product Catalog
- Advanced filtering and search
- Responsive grid layout
- Product image galleries
- Stock status indicators

## Environment Configuration

The app automatically proxies API requests to `http://localhost:8000` during development. For production, update the API base URL in `src/services/api.js`.

## Contributing

1. Follow the existing code style and component patterns
2. Use TypeScript-style prop validation where appropriate
3. Maintain responsive design principles
4. Test components across different screen sizes

## License

This project is part of the BirdSoc SG Shop platform.
