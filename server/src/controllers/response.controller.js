/*
|--------------------------------------------------------------------------
| VIVA-HEADER – H.F. Naaziq – Customer Enquiry
| CRUD resource 2: Enquiry Responses (table `enquiry_responses`)
|--------------------------------------------------------------------------
|   CREATE  createResponse       POST /api/v1/enquiries/:enquiryId/responses
|   READ    listResponses        GET /api/v1/enquiries/:enquiryId/responses
|   UPDATE  updateResponse       PUT /api/v1/enquiry-responses/:id
|   UPDATE  sendResponse         POST /api/v1/enquiry-responses/:id/send
|   DELETE  deleteResponse       DELETE /api/v1/enquiry-responses/:id
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import {
  Enquiry,
  Response,
  sequelize
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import {
  enquiryTag,
  sendMail,
  withTag
} from '../services/mail.service.js';

import {
  logActivity
} from '../services/activity.service.js';

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

// VIVA CRUD READ – drafts and sent replies (GET /api/v1/enquiries/:enquiryId/responses)
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

// VIVA CRUD CREATE – new draft reply (POST /api/v1/enquiries/:enquiryId/responses)
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

// VIVA CRUD UPDATE – edit a draft (PUT /api/v1/enquiry-responses/:id)
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

// VIVA CRUD UPDATE – email it; becomes Sent only if SMTP accepts (POST /api/v1/enquiry-responses/:id/send)
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
    await sendMail(
      {
        to:
          enquiry.customerEmail,
        subject: withTag(
          response.subject,
          enquiryTag(enquiry.enquiryId)
        ),
        heading:
          response.subject,
        text:
          response.responseBody
      },
      {
        // One response is delivered once, even if Send is clicked twice.
        messageKey:
          `enquiry-response-${response.responseId}`,
        template: 'enquiry-response',
        relatedType: 'Enquiry',
        relatedId: enquiry.enquiryId,
        createdBy: req.user.userId
      }
    );

  /*
   * A preview means the message was not
   * delivered to the customer. The response
   * must remain a Draft.
   */
  if (!mailResult.delivered) {
    return res.status(503).json({
      success: false,
      message: mailResult.preview
        ? 'SMTP is not configured, so the email was not sent. The response remains saved as a Draft.'
        : `The mail server did not accept the email${
            mailResult.error ? ` (${mailResult.error})` : ''
          }. The response remains saved as a Draft.`,
      errors: [],
      meta: {
        emailStatus: mailResult.status
      }
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

  await logActivity(
    req,
    'enquiry.response_sent',
    'Enquiry',
    enquiry.enquiryId,
    `Response "${response.subject}" accepted by the mail server for enquiry #${enquiry.enquiryId}`
  );

  return ok(
    res,
    'Response accepted by the mail server and marked Sent',
    response,
    {
      emailStatus: mailResult.status
    }
  );
}

/*
|--------------------------------------------------------------------------
| Admin Deletes Draft Response
|--------------------------------------------------------------------------
*/

// VIVA CRUD DELETE – delete a draft (DELETE /api/v1/enquiry-responses/:id)
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