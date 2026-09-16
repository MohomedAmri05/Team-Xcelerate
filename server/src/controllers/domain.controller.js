import bcrypt from 'bcrypt';

import {
  sequelize,
  User,
  Session,
  Content,
  Finance
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import {
  crud
} from '../services/resource.service.js';

/*
|--------------------------------------------------------------------------
| Generic Content and Finance CRUD Helpers
|--------------------------------------------------------------------------
*/

const basic = (
  model,
  label
) => {
  const resource =
    crud(model);

  return {
    list: async (req, res) => {
      return ok(
        res,
        `${label} retrieved`,
        await resource.list(
          req.query
        )
      );
    },

    one: async (req, res) => {
      const record =
        await resource.one(
          req.params.id
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            `${label} not found`,
          errors: []
        });
      }

      return ok(
        res,
        `${label} retrieved`,
        record
      );
    },

    create: async (req, res) => {
      const record =
        await resource.create(
          req.validated?.body ||
          req.body
        );

      return res.status(201).json({
        success: true,
        message:
          `${label} created`,
        data: record,
        meta: {}
      });
    },

    update: async (req, res) => {
      const record =
        await resource.update(
          req.params.id,

          req.validated?.body ||
          req.body
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            `${label} not found`,
          errors: []
        });
      }

      return ok(
        res,
        `${label} updated`,
        record
      );
    },

    remove: async (req, res) => {
      const record =
        await resource.one(
          req.params.id
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            `${label} not found`,
          errors: []
        });
      }

      await resource.remove(
        req.params.id
      );

      return ok(
        res,
        `${label} deleted`
      );
    }
  };
};

export const contents =
  basic(
    Content,
    'Content'
  );

export const finances =
  basic(
    Finance,
    'Finance configuration'
  );

/*
|--------------------------------------------------------------------------
| Company Content
|--------------------------------------------------------------------------
*/

export async function listContent(
  req,
  res
) {
  const where =
    req.user
      ? {}
      : {
          isPublished: true
        };

  const content =
    await Content.findAll({
      where,

      order: [
        ['displayOrder', 'ASC']
      ]
    });

  return ok(
    res,
    'Content retrieved',
    content
  );
}

/*
|--------------------------------------------------------------------------
| Financing Configurations
|--------------------------------------------------------------------------
*/

export async function createFinance(
  req,
  res
) {
  const data =
    req.validated.body;

  const finance =
    await sequelize.transaction(
      async (transaction) => {
        if (data.isActive) {
          await Finance.update(
            {
              isActive: false
            },
            {
              where: {},
              transaction
            }
          );
        }

        return Finance.create(
          data,
          {
            transaction
          }
        );
      }
    );

  return res.status(201).json({
    success: true,

    message:
      'Finance configuration created',

    data: finance,
    meta: {}
  });
}

export async function activateFinance(
  req,
  res
) {
  const configuration =
    await Finance.findByPk(
      req.params.id
    );

  if (!configuration) {
    return res.status(404).json({
      success: false,

      message:
        'Financing configuration not found',

      errors: []
    });
  }

  const data =
    req.validated.body;

  const result =
    await sequelize.transaction(
      async (transaction) => {
        if (data.isActive) {
          await Finance.update(
            {
              isActive: false
            },
            {
              where: {},
              transaction
            }
          );
        }

        await configuration.update(
          data,
          {
            transaction
          }
        );

        return configuration;
      }
    );

  return ok(
    res,
    'Finance configuration updated',
    result
  );
}

export async function deleteFinance(
  req,
  res
) {
  const configuration =
    await Finance.findByPk(
      req.params.id
    );

  if (!configuration) {
    return res.status(404).json({
      success: false,

      message:
        'Financing configuration not found',

      errors: []
    });
  }

  if (configuration.isActive) {
    return res.status(409).json({
      success: false,

      message:
        'The active financing configuration cannot be deleted. Activate another configuration first.',

      errors: []
    });
  }

  await configuration.destroy();

  return ok(
    res,
    'Financing configuration deleted'
  );
}

/*
|--------------------------------------------------------------------------
| User Management
|--------------------------------------------------------------------------
*/

export async function listUsers(
  req,
  res
) {
  const users =
    await User.findAll({
      order: [
        ['createdAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Users retrieved',
    users
  );
}

export async function getUser(
  req,
  res
) {
  const user =
    await User.findByPk(
      req.params.id
    );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: []
    });
  }

  return ok(
    res,
    'User retrieved',
    user
  );
}

export async function createUser(
  req,
  res
) {
  const body =
    req.validated.body;

  if (!body.password) {
    return res.status(422).json({
      success: false,
      message:
        'Password is required',
      errors: []
    });
  }

  const passwordHash =
    await bcrypt.hash(
      body.password,
      12
    );

  const user =
    await User.create({
      name: body.name.trim(),

      email:
        body.email
          .trim()
          .toLowerCase(),

      role: body.role,

      isActive:
        body.isActive ?? true,

      passwordHash
    });

  const safeUser =
    user.toJSON();

  delete safeUser.passwordHash;

  return res.status(201).json({
    success: true,
    message: 'User created',
    data: safeUser,
    meta: {}
  });
}

export async function updateUser(
  req,
  res
) {
  const user =
    await User.unscoped().findByPk(
      req.params.id
    );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: []
    });
  }

  const body = {
    ...req.validated.body
  };

  const removesActiveAdmin =
    user.role === 'Admin' &&
    user.isActive &&
    (
      body.role !== 'Admin' ||
      body.isActive === false
    );

  if (removesActiveAdmin) {
    const activeAdminCount =
      await User.count({
        where: {
          role: 'Admin',
          isActive: true
        }
      });

    if (activeAdminCount <= 1) {
      return res.status(409).json({
        success: false,

        message:
          'The final active Admin cannot be deactivated or changed to another role',

        errors: []
      });
    }
  }

  if (body.password) {
    body.passwordHash =
      await bcrypt.hash(
        body.password,
        12
      );
  }

  delete body.password;

  await user.update(body);

  if (!user.isActive) {
    await Session.update(
      {
        revokedAt: new Date()
      },
      {
        where: {
          userId: user.userId,
          revokedAt: null
        }
      }
    );
  }

  const safeUser =
    user.toJSON();

  delete safeUser.passwordHash;

  return ok(
    res,
    'User updated',
    safeUser
  );
}

export async function userStatus(
  req,
  res
) {
  const user =
    await User.findByPk(
      req.params.id
    );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: []
    });
  }

  if (
    typeof req.body.isActive !==
    'boolean'
  ) {
    return res.status(422).json({
      success: false,

      message:
        'isActive must be true or false',

      errors: []
    });
  }

  if (
    user.role === 'Admin' &&
    user.isActive &&
    req.body.isActive === false
  ) {
    const activeAdminCount =
      await User.count({
        where: {
          role: 'Admin',
          isActive: true
        }
      });

    if (activeAdminCount <= 1) {
      return res.status(409).json({
        success: false,

        message:
          'The final active Admin cannot be deactivated',

        errors: []
      });
    }
  }

  await user.update({
    isActive:
      req.body.isActive
  });

  if (!user.isActive) {
    await Session.update(
      {
        revokedAt: new Date()
      },
      {
        where: {
          userId: user.userId,
          revokedAt: null
        }
      }
    );
  }

  return ok(
    res,
    user.isActive
      ? 'User activated'
      : 'User deactivated',
    user
  );
}

export async function deleteUser(
  req,
  res
) {
  req.body.isActive = false;

  return userStatus(
    req,
    res
  );
}

/*
|--------------------------------------------------------------------------
| Session Management
|--------------------------------------------------------------------------
*/

export async function listSessions(
  req,
  res
) {
  const sessionRecords =
    await Session.findAll({
      where: {
        userId:
          req.user.userId,

        revokedAt: null
      },

      attributes: {
        exclude: [
          'refreshTokenHash'
        ]
      },

      order: [
        ['createdAt', 'DESC']
      ]
    });

  const sessions =
    sessionRecords.map(
      (session) => ({
        ...session.toJSON(),

        isCurrent:
          session.sessionId ===
          req.sessionId
      })
    );

  return ok(
    res,
    'Sessions retrieved',
    sessions
  );
}

export async function revokeSession(
  req,
  res
) {
  const [
    affectedRows
  ] = await Session.update(
    {
      revokedAt: new Date()
    },
    {
      where: {
        sessionId:
          req.params.id,

        userId:
          req.user.userId,

        revokedAt: null
      }
    }
  );

  if (!affectedRows) {
    return res.status(404).json({
      success: false,

      message:
        'Active session not found',

      errors: []
    });
  }

  return ok(
    res,
    'Session revoked'
  );
}

export async function revokeAll(
  req,
  res
) {
  const {
    Op
  } = await import('sequelize');

  await Session.update(
    {
      revokedAt: new Date()
    },
    {
      where: {
        userId:
          req.user.userId,

        sessionId: {
          [Op.ne]:
            req.sessionId
        },

        revokedAt: null
      }
    }
  );

  return ok(
    res,
    'All other sessions revoked'
  );
}