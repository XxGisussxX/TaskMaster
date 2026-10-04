import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const status = this.redisService.status;

    const isHealthy = status.healthy;

    const result = this.getStatus(key, isHealthy, {
      degradedSince: status.degradedSince,
      degradedOperations: status.degradedOperations,
      lastError: status.lastError,
    });

    if (!isHealthy) {
      throw new HealthCheckError("Redis check failed", result);
    }

    return result;
  }
}
