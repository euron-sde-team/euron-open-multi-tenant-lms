import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { certificateDesignerService } from "../services/certificate-designer.service";
import { uploadCertificateAsset } from "../services/certificate-designer.s3.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function tenantId(req: Request): string {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  return req.tenantId;
}

export const listDesigns = async (req: Request, res: Response<IResponseFormat>) => {
  const templates = await certificateDesignerService.list(tenantId(req));
  sendSuccessResponse({
    res,
    data: { templates },
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate templates retrieved",
  });
};

export const getDesign = async (req: Request, res: Response<IResponseFormat>) => {
  const template = await certificateDesignerService.get(tenantId(req), String(req.params.id));
  sendSuccessResponse({ res, data: { template }, statusCode: HttpSuccessStatus.OK });
};

export const createDesign = async (req: Request, res: Response<IResponseFormat>) => {
  const body = req.body ?? {};
  const template = await certificateDesignerService.create(tenantId(req), {
    name: body.name,
    page_size: body.pageSize,
    orientation: body.orientation,
    background_asset_url: body.backgroundAssetUrl ?? null,
    layout: body.layout ?? { elements: [] },
    is_default: body.isDefault === true,
    status: body.status,
  });
  sendSuccessResponse({
    res,
    data: { template },
    statusCode: HttpSuccessStatus.CREATED,
    message: "Certificate template created",
  });
};

export const updateDesign = async (req: Request, res: Response<IResponseFormat>) => {
  const body = req.body ?? {};
  const template = await certificateDesignerService.update(
    tenantId(req),
    String(req.params.id),
    {
      name: body.name,
      page_size: body.pageSize,
      orientation: body.orientation,
      background_asset_url: body.backgroundAssetUrl,
      layout: body.layout,
      status: body.status,
    },
  );
  sendSuccessResponse({
    res,
    data: { template },
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate template updated",
  });
};

export const deleteDesign = async (req: Request, res: Response<IResponseFormat>) => {
  await certificateDesignerService.remove(tenantId(req), String(req.params.id));
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate template deleted",
  });
};

export const setDefaultDesign = async (req: Request, res: Response<IResponseFormat>) => {
  const template = await certificateDesignerService.setDefault(
    tenantId(req),
    String(req.params.id),
  );
  sendSuccessResponse({
    res,
    data: { template },
    statusCode: HttpSuccessStatus.OK,
    message: "Default certificate template set",
  });
};

export const uploadDesignAsset = async (req: Request, res: Response<IResponseFormat>) => {
  const tId = tenantId(req);
  const file = req.file;
  if (!file) throw new BadRequestError("No file uploaded");
  const kindRaw = String(req.body?.kind ?? "background");
  const kind =
    kindRaw === "signature" || kindRaw === "logo" ? kindRaw : "background";
  const url = await uploadCertificateAsset(
    tId,
    { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname },
    kind,
  );
  sendSuccessResponse({
    res,
    data: { url },
    statusCode: HttpSuccessStatus.CREATED,
    message: "Asset uploaded",
  });
};
