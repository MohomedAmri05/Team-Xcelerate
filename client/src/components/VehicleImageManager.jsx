import {
  Image as ImageIcon,
  Star,
  Trash2,
  Upload
} from 'lucide-react';

import {
  useEffect,
  useState
} from 'react';

import toast from 'react-hot-toast';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

import {
  mediaUrl
} from '../utils/mediaUrl';

export default function VehicleImageManager() {
  const {
    user
  } = useAuth();

  const [
    vehicles,
    setVehicles
  ] = useState([]);

  const [
    selectedVehicleId,
    setSelectedVehicleId
  ] = useState('');

  const [
    images,
    setImages
  ] = useState([]);

  const [
    files,
    setFiles
  ] = useState([]);

  const [
    altText,
    setAltText
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    uploading,
    setUploading
  ] = useState(false);

  const [
    inputKey,
    setInputKey
  ] = useState(0);

  const isAdmin =
    user?.role === 'Admin';

  const loadVehicles = async () => {
    try {
      const response =
        await api.get('/vehicles', {
          params: {
            limit: 50
          }
        });

      const records =
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : [];

      setVehicles(records);

      setSelectedVehicleId(
        (current) =>
          current ||
          String(
            records[0]?.vehicleId ||
            ''
          )
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load vehicles'
      );
    }
  };

  const loadImages = async (
    vehicleId =
      selectedVehicleId
  ) => {
    if (!vehicleId) {
      setImages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response =
        await api.get(
          `/vehicles/${vehicleId}/images`
        );

      setImages(
        Array.isArray(
          response.data.data
        )
          ? response.data.data
          : []
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not load vehicle images'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    loadImages(
      selectedVehicleId
    );
  }, [selectedVehicleId]);

  const uploadImages = async (
    event
  ) => {
    event.preventDefault();

    if (!selectedVehicleId) {
      toast.error(
        'Select a vehicle'
      );
      return;
    }

    if (!files.length) {
      toast.error(
        'Select at least one image'
      );
      return;
    }

    const formData =
      new FormData();

    [...files].forEach(
      (file) => {
        formData.append(
          'images',
          file
        );
      }
    );

    if (altText.trim()) {
      formData.append(
        'altText',
        altText.trim()
      );
    }

    setUploading(true);

    try {
      await api.post(
        `/vehicles/${selectedVehicleId}/images`,
        formData
      );

      toast.success(
        'Vehicle images uploaded'
      );

      setFiles([]);
      setAltText('');

      setInputKey(
        (current) =>
          current + 1
      );

      await loadImages();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not upload images'
      );
    } finally {
      setUploading(false);
    }
  };

  const updateImage = async (
    image,
    changes
  ) => {
    try {
      await api.patch(
        `/vehicle-images/${image.imageId}`,
        {
          altText:
            changes.altText ??
            image.altText ??
            '',

          sortOrder:
            changes.sortOrder ??
            image.sortOrder ??
            0,

          isPrimary:
            changes.isPrimary ??
            image.isPrimary
        }
      );

      toast.success(
        changes.isPrimary
          ? 'Primary image updated'
          : 'Image details updated'
      );

      await loadImages();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not update the image'
      );
    }
  };

  const deleteImage = async (
    image
  ) => {
    const confirmed =
      window.confirm(
        'Permanently delete this image and its stored file?'
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/vehicle-images/${image.imageId}`
      );

      toast.success(
        'Image permanently deleted'
      );

      await loadImages();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not delete the image'
      );
    }
  };

  return (
    <section className="image-manager">
      <div className="admin-head">
        <div>
          <p className="eyebrow">
            GALLERY CONTROL
          </p>

          <h2>Vehicle Images</h2>

          <p>
            Upload, describe, order and select
            the primary image for each vehicle.
          </p>
        </div>

        <label>
          Vehicle

          <select
            value={selectedVehicleId}
            onChange={(event) => {
              setSelectedVehicleId(
                event.target.value
              );
            }}
          >
            {vehicles.length === 0 && (
              <option value="">
                No vehicles available
              </option>
            )}

            {vehicles.map(
              (vehicle) => (
                <option
                  value={
                    vehicle.vehicleId
                  }
                  key={
                    vehicle.vehicleId
                  }
                >
                  #{vehicle.vehicleId}{' '}
                  {vehicle.year}{' '}
                  {vehicle.make}{' '}
                  {vehicle.model}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      <form
        className="image-upload-panel"
        onSubmit={uploadImages}
      >
        <label>
          Select images

          <input
            key={inputKey}
            type="file"
            multiple
            required
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFiles(
                event.target.files
              );
            }}
          />
        </label>

        <label>
          Alternative text

          <input
            type="text"
            maxLength="180"
            placeholder="Example: Front view of Toyota Corolla"
            value={altText}
            onChange={(event) => {
              setAltText(
                event.target.value
              );
            }}
          />
        </label>

        <button
          className="button"
          type="submit"
          disabled={
            uploading ||
            !selectedVehicleId
          }
        >
          <Upload size={17} />

          {uploading
            ? 'Uploading…'
            : 'Upload images'}
        </button>
      </form>

      {loading && (
        <div className="state">
          Loading gallery…
        </div>
      )}

      {!loading &&
        images.length === 0 && (
          <div className="image-empty-state">
            <ImageIcon size={38} />

            <h3>
              This vehicle has no images
            </h3>

            <p>
              Upload at least one image before
              publishing it as Available.
            </p>
          </div>
        )}

      <div className="managed-image-grid">
        {images.map((image) => (
          <ImageRecord
            key={image.imageId}
            image={image}
            isAdmin={isAdmin}
            onUpdate={updateImage}
            onDelete={deleteImage}
          />
        ))}
      </div>
    </section>
  );
}

function ImageRecord({
  image,
  isAdmin,
  onUpdate,
  onDelete
}) {
  const [
    localAltText,
    setLocalAltText
  ] = useState(
    image.altText || ''
  );

  const [
    localOrder,
    setLocalOrder
  ] = useState(
    Number(image.sortOrder) || 0
  );

  useEffect(() => {
    setLocalAltText(
      image.altText || ''
    );

    setLocalOrder(
      Number(image.sortOrder) || 0
    );
  }, [image]);

  return (
    <article className="managed-image-card">
      <div className="managed-image-preview">
        <img
          src={mediaUrl(image.url)}
          alt={
            image.altText ||
            'Vehicle image'
          }
        />

        {image.isPrimary && (
          <span>
            <Star
              size={15}
              fill="currentColor"
            />
            Primary
          </span>
        )}
      </div>

      <label>
        Alternative text

        <input
          type="text"
          maxLength="180"
          value={localAltText}
          onChange={(event) => {
            setLocalAltText(
              event.target.value
            );
          }}
        />
      </label>

      <label>
        Display order

        <input
          type="number"
          min="0"
          value={localOrder}
          onChange={(event) => {
            setLocalOrder(
              Number(
                event.target.value
              )
            );
          }}
        />
      </label>

      <div className="actions">
        <button
          type="button"
          onClick={() => {
            onUpdate(image, {
              altText:
                localAltText,
              sortOrder:
                localOrder
            });
          }}
        >
          Save details
        </button>

        {!image.isPrimary && (
          <button
            type="button"
            onClick={() => {
              onUpdate(image, {
                altText:
                  localAltText,
                sortOrder:
                  localOrder,
                isPrimary: true
              });
            }}
          >
            <Star size={16} />
            Make primary
          </button>
        )}

        {isAdmin && (
          <button
            className="danger"
            type="button"
            onClick={() => {
              onDelete(image);
            }}
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
