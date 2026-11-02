import { Request } from "express";
import developmentLogger from "./development";

export const getLogDataFromReqObject = (req: Request): string => {
  try {
    if (!req) return "(request object data Not Found)";
    const ip = req.headers?.["x-forwarded-for"] || req.ip || req.socket["remoteAddress"];
    const userId = req.user?.id;
    const path = req.path;

    // Safely access params and query to avoid Express 5 getter issues
    let params = "(unavailable)";
    let query = "(unavailable)";
    try {
      params = JSON.stringify(req.params || {});
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Ignore errors accessing params
    }
    try {
      // Create a copy of query to avoid getter issues in Express 5
      const queryObj = req.query ? { ...req.query } : {};
      query = JSON.stringify(queryObj);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Ignore errors accessing query (Express 5 compatibility)
    }

    const body = { ...req.body };
    delete body?.password; //sensitive data which should not be logged
    delete body?.secretKey; //sensitive data which should not be logged
    delete body?.confirmPassword; //sensitive data which should not be logged
    delete body?.token; //sensitive data which should not be logged
    delete body?.authProviderToken; //sensitive data which should not be logged
    delete body?.credentials; //payment gateway secrets (key_secret, secret_key, webhook_secret)
    delete body["g-recaptcha-response"]; //not needed
    return `IP - ${ip}, UserId - ${userId}, Path - ${path}, Body - ${JSON.stringify(body)}, Params - ${params}, Query - ${query}`;
  } catch (error) {
    logger.error(`getLogDataFromReqObject function error - ${error}`);
    return "(request object data Not Found)";
  }
};

const logger = developmentLogger;
export default logger;