import { Global, Module } from "@nestjs/common";
import {
  PrismaLifecycle,
  PrismaService,
  createPrismaClient,
} from "./prisma.service";

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: createPrismaClient,
    },
    PrismaLifecycle,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
