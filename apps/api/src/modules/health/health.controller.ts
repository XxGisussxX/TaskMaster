import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisHealthIndicator } from "./redis-health.indicator";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get("live")
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Public()
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck("database", this.prisma),
      () => this.redisHealth.isHealthy("redis"),
    ]);
  }

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.readiness();
  }
}
