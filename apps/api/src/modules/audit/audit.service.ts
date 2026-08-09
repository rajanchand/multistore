import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';

const REDACTED = '[REDACTED]';
/** Keys whose values must never reach the audit log. */
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|cvv|cardnumber|card_number|authorization|apikey|api_key|mfa/i;

export interface AuditEntry {
  actorUserId?: string | null;
  branchId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Append-only audit writer. Redacts secrets; failures never break the business operation. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          branchId: entry.branchId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          oldValue: redact(entry.oldValue) as Prisma.InputJsonValue,
          newValue: redact(entry.newValue) as Prisma.InputJsonValue,
          metadata: redact(entry.metadata) as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent?.slice(0, 500) ?? null,
          requestId: entry.requestId ?? null,
        },
      });
    } catch (error) {
      // Auditing must not take down the business operation; log loudly instead.
      this.logger.error(`Failed to write audit log for ${entry.action}: ${String(error)}`);
    }
  }
}

/** Recursively redact sensitive keys from any JSON-safe value. */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 8) return value ?? undefined;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}
