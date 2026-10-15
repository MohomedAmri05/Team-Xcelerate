/*
|--------------------------------------------------------------------------
| VIVA – M.R.M. Amri – Vehicle Inventory module
| CRUD resource 3: Wishlists (table `wishlists`)
|--------------------------------------------------------------------------
|   CREATE  addToWishlist        POST   /api/v1/wishlist/:vehicleId
|   READ    listWishlist         GET    /api/v1/wishlist
|           checkWishlist        GET    /api/v1/wishlist/:vehicleId/check
|   UPDATE  updateWishlistNote   PATCH  /api/v1/wishlist/:vehicleId
|   DELETE  removeFromWishlist   DELETE /api/v1/wishlist/:vehicleId
| Customers only; every query is scoped to the signed-in customer.
*/

import {
  Vehicle,
  VehicleImage,
  Wishlist
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import { logActivity } from '../services/activity.service.js';

const NOTE_MAX = 255;

// Trims the note; an empty note is stored as NULL.
function cleanNote(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text ? text.slice(0, NOTE_MAX) : null;
}

/*
|--------------------------------------------------------------------------
| READ – List Customer Wishlist
|--------------------------------------------------------------------------
*/

export async function listWishlist(
  req,
  res
) {
  const wishlistItems =
    await Wishlist.findAll({
      where: {
        customerId:
          req.user.userId
      },

      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          required: false,

          include: [
            {
              model: VehicleImage,
              as: 'images',
              required: false
            }
          ]
        }
      ],

      order: [
        ['createdAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Wishlist retrieved',
    wishlistItems
  );
}

/*
|--------------------------------------------------------------------------
| READ – Check if a Vehicle is Saved
|--------------------------------------------------------------------------
*/

export async function checkWishlist(
  req,
  res
) {
  const vehicleId =
    Number(req.params.vehicleId);

  const wishlistItem =
    await Wishlist.findOne({
      where: {
        customerId:
          req.user.userId,

        vehicleId
      }
    });

  return ok(
    res,
    'Wishlist status retrieved',
    {
      saved: Boolean(wishlistItem),

      wishlistId:
        wishlistItem?.wishlistId || null
    }
  );
}

/*
|--------------------------------------------------------------------------
| CREATE – Add Vehicle to Wishlist
|--------------------------------------------------------------------------
*/

export async function addToWishlist(
  req,
  res
) {
  const vehicleId =
    Number(req.params.vehicleId);

  if (
    !Number.isInteger(vehicleId) ||
    vehicleId <= 0
  ) {
    return res.status(422).json({
      success: false,
      message: 'Invalid vehicle ID',
      errors: []
    });
  }

  const vehicle = await Vehicle.findOne({
    where: {
      vehicleId,
      status: 'Available'
    }
  });

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message:
        'This vehicle is not available',
      errors: []
    });
  }

  const [
    wishlistItem,
    created
  ] = await Wishlist.findOrCreate({
    where: {
      customerId:
        req.user.userId,

      vehicleId:
        vehicle.vehicleId
    },

    defaults: {
      customerId:
        req.user.userId,

      vehicleId:
        vehicle.vehicleId,

      // Optional private note sent with the CREATE request.
      note: cleanNote(req.body?.note)
    }
  });

  return res
    .status(created ? 201 : 200)
    .json({
      success: true,

      message: created
        ? 'Vehicle added to your wishlist'
        : 'Vehicle is already in your wishlist',

      data: wishlistItem,
      meta: {}
    });
}

/*
|--------------------------------------------------------------------------
| DELETE – Remove Vehicle from Wishlist
|--------------------------------------------------------------------------
*/

export async function removeFromWishlist(
  req,
  res
) {
  const vehicleId =
    Number(req.params.vehicleId);

  const wishlistItem =
    await Wishlist.findOne({
      where: {
        customerId:
          req.user.userId,

        vehicleId
      }
    });

  if (!wishlistItem) {
    return res.status(404).json({
      success: false,
      message:
        'Vehicle is not in your wishlist',
      errors: []
    });
  }

  await wishlistItem.destroy();

  return ok(
    res,
    'Vehicle removed from your wishlist'
  );
}

/*
|--------------------------------------------------------------------------
| UPDATE – Edit the private note on a saved vehicle
|--------------------------------------------------------------------------
| PATCH /api/v1/wishlist/:vehicleId   body: { note: "..." }
| Writes wishlists.note for the signed-in customer's own row only.
*/

export async function updateWishlistNote(
  req,
  res
) {
  const vehicleId =
    Number(req.params.vehicleId);

  const wishlistItem =
    await Wishlist.findOne({
      where: {
        customerId:
          req.user.userId,

        vehicleId
      }
    });

  if (!wishlistItem) {
    return res.status(404).json({
      success: false,
      message:
        'Vehicle is not in your wishlist',
      errors: []
    });
  }

  await wishlistItem.update({
    note: req.validated.body.note ? req.validated.body.note : null
  });

  await logActivity(req, 'wishlist.note_updated', 'Wishlist', wishlistItem.wishlistId, `Wishlist note updated for vehicle #${vehicleId}`);

  return ok(
    res,
    'Wishlist note saved',
    wishlistItem
  );
}
