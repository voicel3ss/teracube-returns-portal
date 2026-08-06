import type { PrismaClient } from "@/generated/prisma/client";
import type { StaffDirectory, StaffDirectoryUser } from "@/auth/staff-authentication";

export class PrismaStaffDirectory implements StaffDirectory {
  constructor(private readonly client: PrismaClient) {}

  async findByEmail(normalizedEmail: string): Promise<StaffDirectoryUser | null> {
    return this.client.staffUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, active: true },
    });
  }

  async linkGoogleIdentity(staffUserId: string, subject: string): Promise<void> {
    await this.client.staffIdentity.upsert({
      where: { provider_providerSubject: { provider: "google", providerSubject: subject } },
      update: { staffUserId },
      create: { staffUserId, provider: "google", providerSubject: subject },
    });
  }
}
