import { IAdminRepository } from "../repositories/admin.repository";
import { ICryptoService } from "../services/crypto.service";
import { AdminRole } from "../models/admin.model";
import { ISuperAdminSeedConfig } from "../config/env";

export async function seedSuperAdmin(
  adminRepository: IAdminRepository,
  cryptoService: ICryptoService,
  config: ISuperAdminSeedConfig
): Promise<void> {
  if (!config.email || !config.password) return;

  const existingAdmin = await adminRepository.findByEmail(config.email);
  if (existingAdmin) return;

  await adminRepository.create({
    firstName: config.name,
    lastName: config.name,
    email: config.email,
    password: await cryptoService.hash(config.password),
    role: AdminRole.SUPER_ADMIN,
  });
}
