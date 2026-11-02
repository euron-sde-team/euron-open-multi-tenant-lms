import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import certificateDesignerRepository, {
  CertificateTemplateInput,
  CertificateTemplateUpdate,
} from "../repositories/certificate-designer.repository";

const PAGE_SIZES = ["A4", "LETTER"];
const ORIENTATIONS = ["LANDSCAPE", "PORTRAIT"];
const STATUSES = ["DRAFT", "PUBLISHED"];

class CertificateDesignerService {
  list(tenantId: string) {
    return certificateDesignerRepository.listByTenant(tenantId);
  }

  async get(tenantId: string, id: string) {
    const row = await certificateDesignerRepository.findById(tenantId, id);
    if (!row) throw new NotFoundError("Certificate template not found");
    return row;
  }

  async create(tenantId: string, input: CertificateTemplateInput) {
    this.validate(input);
    const id = await certificateDesignerRepository.create(tenantId, input);
    if (input.is_default) {
      await certificateDesignerRepository.setDefault(tenantId, id);
    }
    return this.get(tenantId, id);
  }

  async update(
    tenantId: string,
    id: string,
    input: CertificateTemplateUpdate,
  ) {
    await this.get(tenantId, id);
    if (input.page_size && !PAGE_SIZES.includes(input.page_size)) {
      throw new BadRequestError("Invalid page size");
    }
    if (input.orientation && !ORIENTATIONS.includes(input.orientation)) {
      throw new BadRequestError("Invalid orientation");
    }
    if (input.status && !STATUSES.includes(input.status)) {
      throw new BadRequestError("Invalid status");
    }
    await certificateDesignerRepository.update(tenantId, id, input);
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await certificateDesignerRepository.remove(tenantId, id);
  }

  async setDefault(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await certificateDesignerRepository.setDefault(tenantId, id);
    return this.get(tenantId, id);
  }

  private validate(input: CertificateTemplateInput) {
    if (!input.name || !input.name.trim()) {
      throw new BadRequestError("Template name is required");
    }
    if (input.page_size && !PAGE_SIZES.includes(input.page_size)) {
      throw new BadRequestError("Invalid page size");
    }
    if (input.orientation && !ORIENTATIONS.includes(input.orientation)) {
      throw new BadRequestError("Invalid orientation");
    }
    if (input.status && !STATUSES.includes(input.status)) {
      throw new BadRequestError("Invalid status");
    }
  }
}

export const certificateDesignerService = new CertificateDesignerService();
