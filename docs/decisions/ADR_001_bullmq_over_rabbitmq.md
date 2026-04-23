# ADR 001 — BullMQ over RabbitMQ

Date: April 2026
Status: Accepted

## Decision

Use BullMQ (Redis-backed) for all background job processing.

## Reasons

- Redis is already required for API response caching
- BullMQ runs inside NestJS as @nestjs/bullmq — no extra service
- RabbitMQ would require a 5th Docker service
- BullMQ covers all v1 use cases: delayed jobs, retry, priorities, queues

## Trade-offs

- Redis is a single point of failure for both cache and queues
- RabbitMQ is better for multi-service enterprise pub/sub (v3 consideration)
