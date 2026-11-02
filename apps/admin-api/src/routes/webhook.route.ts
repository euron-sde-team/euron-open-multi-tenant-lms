import { Router } from "express";

import { asyncHandler } from "../utils/asynchandler";
import * as webhookController from "../controllers/webhook.controller";

const router: Router = Router();

router.post(
  "/razorpay/subscription",
  asyncHandler(webhookController.razorpaySubscriptionWebhook)
);

router.post(
  "/stripe/subscription",
  asyncHandler(webhookController.stripeSubscriptionWebhook)
);

export default router;
