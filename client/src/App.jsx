import {
  Navigate,
  Route,
  Routes
} from 'react-router-dom';

import PublicLayout
  from './layouts/PublicLayout';

import Home
  from './pages/Home';

import Inventory
  from './pages/Inventory';

import VehicleDetails
  from './pages/VehicleDetails';

import ContentPage
  from './pages/ContentPage';

import Contact
  from './pages/Contact';

import Login
  from './pages/Login';

import Register
  from './pages/Register';

import MyEnquiries
  from './pages/MyEnquiries';

import Wishlist
  from './pages/Wishlist';

import Profile
  from './pages/Profile';

import Admin
  from './pages/Admin';

import NotFound
  from './pages/NotFound';

import ProtectedRoute
  from './features/auth/ProtectedRoute';

import MyBookings
  from './pages/MyBookings';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          index
          element={<Home />}
        />

        <Route
          path="inventory"
          element={<Inventory />}
        />

        <Route
          path="vehicles/:id"
          element={<VehicleDetails />}
        />

        <Route
          path="about"
          element={
            <ContentPage
              slug="about"
              title="Our story"
            />
          }
        />

        <Route
          path="services"
          element={
            <ContentPage
              slug="services"
              title="Our services"
            />
          }
        />

        <Route
          path="faq"
          element={
            <ContentPage
              slug="faq"
              title="Frequently asked questions"
            />
          }
        />

        <Route
          path="contact"
          element={<Contact />}
        />

        <Route
          path="my-enquiries"
          element={
            <ProtectedRoute
              allowedRoles={['Customer']}
            >
              <MyEnquiries />
            </ProtectedRoute>
          }
        />

        <Route
          path="wishlist"
          element={
            <ProtectedRoute
              allowedRoles={['Customer']}
            >
              <Wishlist />
            </ProtectedRoute>
          }
        />

        <Route
          path="my-bookings"
          element={
            <ProtectedRoute
              allowedRoles={['Customer']}
            >
              <MyBookings />
            </ProtectedRoute>
          }
        />

        <Route
          path="profile"
          element={
            <ProtectedRoute
              allowedRoles={[
                'Admin',
                'Staff',
                'Customer'
              ]}
            >
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<NotFound />}
        />
      </Route>

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/admin/login"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute
            allowedRoles={[
              'Admin',
              'Staff'
            ]}
          >
            <Admin />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}