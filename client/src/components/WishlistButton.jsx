import {
  Heart
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import {
  useLocation,
  useNavigate
} from 'react-router-dom';

import toast from 'react-hot-toast';

import {
  useAuth
} from '../features/auth/AuthContext';

import {
  api
} from '../services/api';

export default function WishlistButton({
  vehicleId,
  className = '',
  onChanged
}) {
  const {
    user,
    isAuthenticated
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [
    isSaved,
    setIsSaved
  ] = useState(false);

  const [
    checking,
    setChecking
  ] = useState(false);

  const [
    busy,
    setBusy
  ] = useState(false);

  const isCustomer =
    user?.role === 'Customer';

  useEffect(() => {
    let active = true;

    const checkWishlist = async () => {
      if (
        !vehicleId ||
        !isAuthenticated ||
        !isCustomer
      ) {
        setIsSaved(false);
        return;
      }

      setChecking(true);

      try {
        const response = await api.get(
          `/wishlist/${vehicleId}/check`
        );

        if (active) {
          setIsSaved(
            Boolean(
            response.data.data?.saved
      )
          );
        }
      } catch (error) {
        if (active) {
          setIsSaved(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    checkWishlist();

    return () => {
      active = false;
    };
  }, [
    vehicleId,
    isAuthenticated,
    isCustomer
  ]);

  const handleWishlist = async (
    event
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      toast.error(
        'Please log in to save vehicles'
      );

      navigate('/login', {
        state: {
          from:
            location.pathname +
            location.search
        }
      });

      return;
    }

    if (!isCustomer) {
      toast.error(
        'Wishlists are available to customer accounts'
      );
      return;
    }

    if (checking || busy) {
      return;
    }

    setBusy(true);

    try {
      if (isSaved) {
        await api.delete(
          `/wishlist/${vehicleId}`
        );

        setIsSaved(false);

        toast.success(
          'Vehicle removed from your wishlist'
        );

        onChanged?.({
          vehicleId,
          isSaved: false
        });
      } else {
        await api.post(
          `/wishlist/${vehicleId}`
        );

        setIsSaved(true);

        toast.success(
          'Vehicle added to your wishlist'
        );

        onChanged?.({
          vehicleId,
          isSaved: true
        });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not update your wishlist'
      );
    } finally {
      setBusy(false);
    }
  };

  const label = checking
    ? 'Checking wishlist'
    : isSaved
      ? 'Remove from wishlist'
      : 'Add to wishlist';

  return (
    <button
      className={[
        'wishlist-button',
        isSaved ? 'saved' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      onClick={handleWishlist}
      disabled={checking || busy}
      aria-label={label}
      aria-pressed={isSaved}
      title={label}
    >
      <Heart
        size={20}
        fill={
          isSaved
            ? 'currentColor'
            : 'none'
        }
      />

      <span>
        {busy
          ? 'Updating…'
          : isSaved
            ? 'Saved'
            : 'Save'}
      </span>
    </button>
  );
}