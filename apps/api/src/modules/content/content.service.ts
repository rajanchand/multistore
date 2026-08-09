import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import type {
  CreateFaqInput,
  CreatePaymentMethodInput,
  UpdateFaqInput,
  UpdatePaymentMethodInput,
  UpsertAboutInput,
} from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listFaqs(includeUnpublished = false) {
    return this.prisma.faq.findMany({
      where: { deletedAt: null, ...(includeUnpublished ? {} : { isPublished: true }) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createFaq(user: AuthenticatedUser, input: CreateFaqInput, ctx: RequestContext) {
    const faq = await this.prisma.faq.create({ data: input });
    await this.audit.log({
      actorUserId: user.id,
      action: 'FAQ_CREATED',
      resourceType: 'Faq',
      resourceId: faq.id,
      newValue: { question: faq.question },
      requestId: ctx.requestId,
    });
    return faq;
  }

  async updateFaq(user: AuthenticatedUser, id: string, input: UpdateFaqInput, ctx: RequestContext) {
    const existing = await this.prisma.faq.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('FAQ');
    const faq = await this.prisma.faq.update({ where: { id }, data: input });
    await this.audit.log({
      actorUserId: user.id,
      action: 'FAQ_UPDATED',
      resourceType: 'Faq',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return faq;
  }

  async archiveFaq(user: AuthenticatedUser, id: string, ctx: RequestContext) {
    const existing = await this.prisma.faq.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('FAQ');
    const faq = await this.prisma.faq.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'FAQ_ARCHIVED',
      resourceType: 'Faq',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return faq;
  }

  listAbout() {
    return this.prisma.aboutContent.findMany({ orderBy: [{ sortOrder: 'asc' }, { sectionKey: 'asc' }] });
  }

  async upsertAbout(user: AuthenticatedUser, input: UpsertAboutInput, ctx: RequestContext) {
    const about = await this.prisma.aboutContent.upsert({
      where: { sectionKey: input.sectionKey },
      create: input,
      update: {
        title: input.title,
        body: input.body,
        isPublished: input.isPublished,
        sortOrder: input.sortOrder,
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'ABOUT_UPSERTED',
      resourceType: 'AboutContent',
      resourceId: about.id,
      newValue: { sectionKey: about.sectionKey },
      requestId: ctx.requestId,
    });
    return about;
  }

  listPaymentMethods(includeDisabled = true) {
    return this.prisma.paymentMethodConfig.findMany({
      where: { deletedAt: null, ...(includeDisabled ? {} : { isEnabled: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createPaymentMethod(user: AuthenticatedUser, input: CreatePaymentMethodInput, ctx: RequestContext) {
    const conflict = await this.prisma.paymentMethodConfig.findFirst({
      where: { code: input.code, deletedAt: null },
    });
    if (conflict) throw Errors.conflict('PAYMENT_METHOD_EXISTS', 'Payment method code already exists.');
    const method = await this.prisma.paymentMethodConfig.create({
      data: {
        ...input,
        config: (input.config ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'PAYMENT_METHOD_CREATED',
      resourceType: 'PaymentMethodConfig',
      resourceId: method.id,
      newValue: { code: method.code },
      requestId: ctx.requestId,
    });
    return method;
  }

  async updatePaymentMethod(
    user: AuthenticatedUser,
    id: string,
    input: UpdatePaymentMethodInput,
    ctx: RequestContext,
  ) {
    const existing = await this.prisma.paymentMethodConfig.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('Payment method');
    const method = await this.prisma.paymentMethodConfig.update({
      where: { id },
      data: {
        ...input,
        config: (input.config ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'PAYMENT_METHOD_UPDATED',
      resourceType: 'PaymentMethodConfig',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return method;
  }

  async archivePaymentMethod(user: AuthenticatedUser, id: string, ctx: RequestContext) {
    const existing = await this.prisma.paymentMethodConfig.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('Payment method');
    const method = await this.prisma.paymentMethodConfig.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'PAYMENT_METHOD_ARCHIVED',
      resourceType: 'PaymentMethodConfig',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return method;
  }
}
