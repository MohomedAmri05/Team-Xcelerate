import fs from 'fs/promises';
import path from 'path';

import {
  sequelize,
  Vehicle,
  VehicleImage
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

function localImagePath(url) {
  if (
    !url ||
    !url.startsWith('/uploads/')
  ) {
    return null;
  }

  return path.resolve(
    'uploads',
    path.basename(url)
  );
}

async function deleteUploadedFiles(
  files = []
) {
  await Promise.all(
    files.map((file) =>
      fs.unlink(file.path).catch(
        () => {}
      )
    )
  );
}

export async function listImages(
  req,
  res
) {
  const vehicle =
    await Vehicle.findByPk(
      req.params.vehicleId,
      {
        paranoid: false
      }
    );

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  const images =
    await VehicleImage.findAll({
      where: {
        vehicleId:
          vehicle.vehicleId
      },

      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

  return ok(
    res,
    'Gallery retrieved',
    images
  );
}

export async function uploadImages(
  req,
  res
) {
  const files =
    req.files || [];

  if (!files.length) {
    return res.status(422).json({
      success: false,
      message:
        'Select at least one image to upload',
      errors: []
    });
  }

  const vehicle =
    await Vehicle.findByPk(
      req.params.vehicleId
    );

  if (!vehicle) {
    await deleteUploadedFiles(files);

    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  try {
    const images =
      await sequelize.transaction(
        async (transaction) => {
          const existingCount =
            await VehicleImage.count({
              where: {
                vehicleId:
                  vehicle.vehicleId
              },

              transaction
            });

          const rows = [];

          for (
            let index = 0;
            index < files.length;
            index += 1
          ) {
            const file =
              files[index];

            const image =
              await VehicleImage.create(
                {
                  vehicleId:
                    vehicle.vehicleId,

                  url:
                    `/uploads/${file.filename}`,

                  altText:
                    req.body.altText?.trim() ||
                    `${vehicle.make} ${vehicle.model}`,

                  isPrimary:
                    existingCount === 0 &&
                    index === 0,

                  sortOrder:
                    existingCount + index
                },
                {
                  transaction
                }
              );

            rows.push(image);
          }

          return rows;
        }
      );

    return res.status(201).json({
      success: true,
      message: 'Images uploaded',
      data: images,
      meta: {}
    });
  } catch (error) {
    await deleteUploadedFiles(files);
    throw error;
  }
}

export async function updateImage(
  req,
  res
) {
  const image =
    await VehicleImage.findByPk(
      req.params.id
    );

  if (!image) {
    return res.status(404).json({
      success: false,
      message: 'Image not found',
      errors: []
    });
  }

  const changes = {};

  if (
    req.validated.body.altText !==
    undefined
  ) {
    changes.altText =
      req.validated.body.altText;
  }

  if (
    req.validated.body.sortOrder !==
    undefined
  ) {
    changes.sortOrder =
      req.validated.body.sortOrder;
  }

  if (
    req.validated.body.isPrimary !==
    undefined
  ) {
    changes.isPrimary =
      req.validated.body.isPrimary;
  }

  await sequelize.transaction(
    async (transaction) => {
      if (
        changes.isPrimary === true
      ) {
        await VehicleImage.update(
          {
            isPrimary: false
          },
          {
            where: {
              vehicleId:
                image.vehicleId
            },

            transaction
          }
        );
      }

      await image.update(
        changes,
        {
          transaction
        }
      );
    }
  );

  return ok(
    res,
    'Image updated',
    image
  );
}

export async function deleteImage(
  req,
  res
) {
  const image =
    await VehicleImage.findByPk(
      req.params.id
    );

  if (!image) {
    return res.status(404).json({
      success: false,
      message: 'Image not found',
      errors: []
    });
  }

  const {
    vehicleId,
    isPrimary,
    url
  } = image;

  const storedPath =
    localImagePath(url);

  if (storedPath) {
    await fs.unlink(
      storedPath
    ).catch((error) => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  }

  await sequelize.transaction(
    async (transaction) => {
      await image.destroy({
        transaction
      });

      if (isPrimary) {
        const replacement =
          await VehicleImage.findOne({
            where: {
              vehicleId
            },

            order: [
              ['sortOrder', 'ASC'],
              ['createdAt', 'ASC']
            ],

            transaction
          });

        if (replacement) {
          await replacement.update(
            {
              isPrimary: true
            },
            {
              transaction
            }
          );
        }
      }
    }
  );

  return ok(
    res,
    'Image deleted'
  );
}