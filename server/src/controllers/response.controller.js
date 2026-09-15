import {
  Enquiry,
  Response,
  sequelize
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import {
  sendMail
} from '../services/mail.service.js';

/*
|--------------------------------------------------------------------------
| Access Helpers
|--------------------------------------------------------------------------
*/

const findEnquiry = async (
  enquiryId
) => {
  const enquiry =
    await Enquiry.findByPk(
      enquiryId
    );

  if (!enquiry) {
    throw Object.assign(
      new Error(
        'Enquiry not found'
      ),
      {
        status: 404
      }
    );
  }

  return enquiry;
};

const verifyEnquiryAccess = (
  enquiry,
  user
) => {
  if (
    user.role === 'Staff' &&
    enquiry.assignedTo !==
      user.userId
  ) {
    throw Object.assign(
      new Error(
        'This enquiry is not assigned to you'
      ),
      {
        status: 403
      }
    );
  }
};

const findAccessibleResponse =
  async (
    responseId,
    user
  ) => {
    const response =
      await Response.findByPk(
        responseId
      );

    if (!response) {
      throw Object.assign(
        new Error(
          'Response not found'
        ),
        {
          status: 404
        }
      );
    }

    const enquiry =
      await findEnquiry(
        response.enquiryId
      );

    verifyEnquiryAccess(
      enquiry,
      user
    );

    return {
      response,
      enquiry
    };
  };

/*
|--------------------------------------------------------------------------
| List Responses
|--------------------------------------------------------------------------
*/

export async function listResponses(
  req,
  res
) {
  const enquiry =
    await findEnquiry(
      req.params.enquiryId
    );

  verifyEnquiryAccess(
    enquiry,
    req.user
  );

  const responses =
    await Response.findAll({
      where: {
        enquiryId:
          enquiry.enquiryId
      },

      order: [
        ['createdAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Responses retrieved',
    responses
  );
}

/*
|--------------------------------------------------------------------------
| Create Draft Response
|--------------------------------------------------------------------------
*/

export async function createResponse(
  req,
  res
) {
  const enquiry =
    await findEnquiry(
      req.params.enquiryId
    );

  verifyEnquiryAccess(
    enquiry,
    req.user
  );

  if (
    enquiry.status ===
    'Archived'
  ) {
    return res.status(422).json({
      success: false,

      message:
        'A response cannot be created for an archived enquiry',

      errors: []
    });
  }

  const response =
    await Response.create({
      enquiryId:
        enquiry.enquiryId,

      adminId:
        req.user.userId,

      subject:
        req.validated.body
          .subject,

      responseBody:
        req.validated.body
          .responseBody,

      /*
       * Every new response begins as
       * a Draft.
       */
      status: 'Draft',
      sentAt: null
    });

  return res.status(201).json({
    success: true,

    message:
      'Draft response created',

    data: response,
    meta: {}
  });
}

/*
|--------------------------------------------------------------------------
| Update Draft Response
|--------------------------------------------------------------------------
*/

export async function updateResponse(
  req,
  res
) {
  const {
    response
  } =
    await findAccessibleResponse(
      req.params.id,
      req.user
    );

  if (
    response.status !==
    'Draft'
  ) {
    return res.status(422).json({
      success: false,

      message:
        'Only draft responses can be updated',

      errors: []
    });
  }

  await response.update({
    subject:
      req.validated.body
        .subject,

    responseBody:
      req.validated.body
        .responseBody
  });

  return ok(
    res,
    'Draft response updated',
    response
  );
}

/*
|--------------------------------------------------------------------------
| Send Response
|--------------------------------------------------------------------------
*/

export async function sendResponse(
  req,
  res
) {
  const {
    response,
    enquiry
  } =
    await findAccessibleResponse(
      req.params.id,
      req.user
    );

  if (
    response.status !==
    'Draft'
  ) {
    return res.status(422).json({
      success: false,

      message:
        'Only draft responses can be sent',

      errors: []
    });
  }

  /*
   * Email delivery happens before any
   * database status is changed.
   */
  const mailResult =
    await sendMail({
      to:
        enquiry.customerEmail,

      subject:
        response.subject,

      text:
        response.responseBody
    });

  /*
   * A preview means the message was not
   * delivered to the customer. The response
   * must remain a Draft.
   */
  if (!mailResult.delivered) {
    return res.status(503).json({
      success: false,

      message:
        'The email was not delivered. The response remains saved as a Draft.',

      errors: []
    });
  }

  const sentAt =
    new Date();

  await sequelize.transaction(
    async (transaction) => {
      await response.update(
        {
          status: 'Sent',
          sentAt
        },
        {
          transaction
        }
      );

      await enquiry.update(
        {
          status: 'Responded',
          respondedAt: sentAt,

          respondedBy:
            req.user.userId
        },
        {
          transaction
        }
      );
    }
  );

  return ok(
    res,
    'Response sent successfully',
    response
  );
}

/*
|--------------------------------------------------------------------------
| Admin Deletes Draft Response
|--------------------------------------------------------------------------
*/

export async function deleteResponse(
  req,
  res
) {
  const response =
    await Response.findByPk(
      req.params.id
    );

  if (!response) {
    return res.status(404).json({
      success: false,
      message:
        'Response not found',
      errors: []
    });
  }

  if (
    response.status !==
    'Draft'
  ) {
    return res.status(422).json({
      success: false,

      message:
        'Only draft responses can be deleted',

      errors: []
    });
  }

  await response.destroy();

  return ok(
    res,
    'Draft response deleted'
  );
}