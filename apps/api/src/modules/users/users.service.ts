import { Injectable } from "@nestjs/common";
import type {
  User,
  UpdateProfileInput,
  UpdateUserSettingsInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileInput): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        avatarUrl: dto.avatarUrl === "" ? null : dto.avatarUrl,
      },
    });
    return this.toPublicUser(user);
  }

  async getSettings(userId: string) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsInput) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    role: User["role"];
    isEmailVerified: boolean;
    passwordHash: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      hasPassword: !!user.passwordHash,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
