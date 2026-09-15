import {
  Vehicle,
  VehicleImage,
  Wishlist
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

/*
|--------------------------------------------------------------------------
| List Customer Wishlist
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
| Check if a Vehicle is Saved
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
| Add Vehicle to Wishlist
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
        vehicle.vehicleId
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
| Remove Vehicle from Wishlist
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