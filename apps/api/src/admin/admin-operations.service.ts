import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ReviewStatus,
  ReturnStatus,
  UserRole,
  VoucherType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { releaseOrderCommitments, transitionOrder } from '../commerce/order-lifecycle';
import type {
  AdminAuditListDto,
  AdminBannerFieldsDto,
  AdminCustomerListDto,
  AdminOrderListDto,
  AdminReviewListDto,
  AdminVoucherFieldsDto,
  UpdateReviewStatusDto,
  SetCustomerDisabledDto,
} from './admin-operations.dto';

const adminOrderInclude = {
  user: { select: { id: true, email: true, name: true } },
  payment: { select: { method: true, status: true, amountVnd: true, expiresAt: true } },
  items: { select: { productName: true, variantName: true, quantity: true, unitPriceVnd: true } },
  returnRequest: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(query: AdminOrderListDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { recipientName: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
              { user: { name: { contains: query.q, mode: 'insensitive' } } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: adminOrderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async cancelOrder(actorUserId: string, orderId: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('Hãy nhập lý do hủy đơn.');
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const order = await transaction.order.findUnique({
            where: { id: orderId },
            include: { payment: true },
          });
          if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
          if (!order.payment)
            throw new ConflictException('Đơn hàng không có phương thức thanh toán.');
          const pendingTransfer =
            order.status === OrderStatus.PENDING_PAYMENT &&
            order.payment.method === PaymentMethod.MOCK_TRANSFER &&
            order.payment.status === PaymentStatus.PENDING;
          const preparingCod =
            order.status === OrderStatus.PROCESSING &&
            order.payment.method === PaymentMethod.MOCK_COD &&
            order.payment.status === PaymentStatus.PENDING;
          if (!pendingTransfer && !preparingCod) {
            throw new ConflictException(
              'Chỉ có thể hủy đơn chuyển khoản đang chờ hoặc COD đang chuẩn bị.',
            );
          }

          await transaction.payment.update({
            where: { id: order.payment.id },
            data: { status: PaymentStatus.CANCELLED },
          });
          await transitionOrder(transaction, order, OrderStatus.CANCELLED, {
            actorUserId,
            reason: `Quản trị viên hủy đơn: ${normalizedReason}`,
          });
          await releaseOrderCommitments(transaction, order);
          await transaction.adminAuditLog.create({
            data: {
              actorUserId,
              action: 'ORDER_CANCELLED',
              entityType: 'order',
              entityId: order.id,
              details: { reason: normalizedReason, previousStatus: order.status },
            },
          });
          return transaction.order.findUniqueOrThrow({
            where: { id: order.id },
            include: adminOrderInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Đơn hàng vừa thay đổi. Hãy tải lại và thử lại.');
      }
      throw error;
    }
  }

  async resolveReturn(
    actorUserId: string,
    orderId: string,
    status: 'COMPLETED' | 'REJECTED',
    reason: string,
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('Hãy nhập ghi chú xử lý yêu cầu.');
    return this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { id: orderId },
          include: { returnRequest: true },
        });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
        if (order.status !== OrderStatus.RETURN_REQUESTED || !order.returnRequest) {
          throw new ConflictException('Đơn hàng không có yêu cầu trả hàng đang chờ xử lý.');
        }
        const nextOrderStatus =
          status === ReturnStatus.COMPLETED ? OrderStatus.RETURNED : OrderStatus.DELIVERED;
        await transaction.returnRequest.update({
          where: { id: order.returnRequest.id },
          data: { status, completedAt: new Date() },
        });
        await transitionOrder(transaction, order, nextOrderStatus, {
          actorUserId,
          reason: `Quản trị viên ${status === ReturnStatus.COMPLETED ? 'hoàn tất' : 'từ chối'} yêu cầu trả hàng: ${normalizedReason}`,
          preserveDeliveredAt: status === ReturnStatus.REJECTED,
        });
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: status === ReturnStatus.COMPLETED ? 'RETURN_COMPLETED' : 'RETURN_REJECTED',
            entityType: 'order',
            entityId: order.id,
            details: { reason: normalizedReason, returnRequestId: order.returnRequest.id },
          },
        });
        return transaction.order.findUniqueOrThrow({
          where: { id: order.id },
          include: adminOrderInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listVouchers() {
    return this.prisma.voucher.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: [{ startsAt: 'desc' }, { code: 'asc' }],
    });
  }

  async createVoucher(actorUserId: string, input: AdminVoucherFieldsDto) {
    const data = this.validateVoucher(input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const voucher = await transaction.voucher.create({ data });
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'VOUCHER_CREATED',
            entityType: 'voucher',
            entityId: voucher.id,
            details: { code: voucher.code, type: voucher.type },
          },
        });
        return voucher;
      });
    } catch (error) {
      this.handleUniqueConflict(error, 'Mã ưu đãi đã tồn tại.');
    }
  }

  async updateVoucher(
    actorUserId: string,
    voucherId: string,
    input: Partial<AdminVoucherFieldsDto>,
  ) {
    const current = await this.prisma.voucher.findUnique({ where: { id: voucherId } });
    if (!current) throw new NotFoundException('Không tìm thấy mã ưu đãi.');
    const candidate: AdminVoucherFieldsDto = {
      code: input.code ?? current.code,
      type: input.type ?? current.type,
      value: input.value ?? current.value,
      minSubtotalVnd: input.minSubtotalVnd ?? current.minSubtotalVnd,
      maxDiscountVnd:
        input.maxDiscountVnd === undefined ? current.maxDiscountVnd : input.maxDiscountVnd,
      startsAt: input.startsAt ?? current.startsAt.toISOString(),
      expiresAt: input.expiresAt ?? current.expiresAt.toISOString(),
      totalLimit: input.totalLimit === undefined ? current.totalLimit : input.totalLimit,
      perUserLimit: input.perUserLimit === undefined ? current.perUserLimit : input.perUserLimit,
      isStackable: input.isStackable ?? current.isStackable,
    };
    const data = this.validateVoucher(candidate);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const voucher = await transaction.voucher.update({ where: { id: voucherId }, data });
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'VOUCHER_UPDATED',
            entityType: 'voucher',
            entityId: voucher.id,
            details: { fields: Object.keys(input) },
          },
        });
        return voucher;
      });
    } catch (error) {
      this.handleUniqueConflict(error, 'Mã ưu đãi đã tồn tại.');
    }
  }

  async listBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createBanner(actorUserId: string, input: AdminBannerFieldsDto) {
    this.validateBanner(input);
    return this.prisma.$transaction(async (transaction) => {
      const banner = await transaction.banner.create({
        data: { ...input, createdById: actorUserId, description: input.description ?? '' },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          action: 'BANNER_CREATED',
          entityType: 'banner',
          entityId: banner.id,
          details: { title: banner.title },
        },
      });
      return banner;
    });
  }

  async updateBanner(actorUserId: string, bannerId: string, input: Partial<AdminBannerFieldsDto>) {
    const current = await this.prisma.banner.findUnique({ where: { id: bannerId } });
    if (!current) throw new NotFoundException('Không tìm thấy banner.');
    this.validateBanner({ ...current, ...input });
    return this.prisma.$transaction(async (transaction) => {
      const banner = await transaction.banner.update({
        where: { id: bannerId },
        data: input,
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          action: 'BANNER_UPDATED',
          entityType: 'banner',
          entityId: banner.id,
          details: { fields: Object.keys(input) },
        },
      });
      return banner;
    });
  }

  async deleteBanner(actorUserId: string, bannerId: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id: bannerId },
      select: { id: true, title: true },
    });
    if (!banner) throw new NotFoundException('Không tìm thấy banner.');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.banner.delete({ where: { id: bannerId } });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          action: 'BANNER_DELETED',
          entityType: 'banner',
          entityId: banner.id,
          details: { title: banner.title },
        },
      });
    });
    return { deleted: true };
  }

  async listReviews(query: AdminReviewListDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.ReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { body: { contains: query.q, mode: 'insensitive' } },
              { product: { name: { contains: query.q, mode: 'insensitive' } } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, slug: true } },
          orderItem: { select: { orderId: true, sku: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async updateReviewStatus(actorUserId: string, reviewId: string, input: UpdateReviewStatusDto) {
    const current = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true, rating: true, productId: true },
    });
    if (!current) throw new NotFoundException('Không tìm thấy đánh giá.');
    if (current.status !== ReviewStatus.PENDING) {
      throw new ConflictException('Chỉ có thể duyệt hoặc từ chối đánh giá đang chờ.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.review.updateMany({
        where: { id: current.id, status: ReviewStatus.PENDING },
        data: { status: input.status },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Đánh giá vừa được xử lý. Hãy tải lại danh sách.');
      }
      const review = await transaction.review.findUniqueOrThrow({
        where: { id: current.id },
        select: { id: true, status: true, rating: true, body: true },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          action: input.status === ReviewStatus.APPROVED ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
          entityType: 'review',
          entityId: current.id,
          details: { previousStatus: current.status, rating: current.rating },
        },
      });
      return review;
    });
  }

  async listCustomers(query: AdminCustomerListDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.UserWhereInput = {
      role: UserRole.USER,
      ...(query.state === 'active' ? { disabledAt: null } : {}),
      ...(query.state === 'disabled' ? { disabledAt: { not: null } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          disabledAt: true,
          createdAt: true,
          _count: { select: { orders: true, reviews: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async setCustomerDisabled(
    actorUserId: string,
    customerId: string,
    input: SetCustomerDisabledDto,
  ) {
    if (actorUserId === customerId) {
      throw new BadRequestException('Không thể khóa chính tài khoản quản trị đang đăng nhập.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.user.findFirst({
        where: { id: customerId, role: UserRole.USER },
        select: { id: true, name: true, email: true, disabledAt: true },
      });
      if (!customer) throw new NotFoundException('Không tìm thấy tài khoản khách hàng.');
      const disabledAt = input.disabled ? (customer.disabledAt ?? new Date()) : null;
      const updated = await transaction.user.update({
        where: { id: customer.id },
        data: { disabledAt },
        select: { id: true, name: true, email: true, disabledAt: true },
      });
      if (input.disabled) {
        await transaction.refreshSession.updateMany({
          where: { userId: customer.id, revokedAt: null },
          data: { revokedAt: disabledAt },
        });
      }
      await transaction.adminAuditLog.create({
        data: {
          actorUserId,
          action: input.disabled ? 'CUSTOMER_DISABLED' : 'CUSTOMER_ENABLED',
          entityType: 'user',
          entityId: customer.id,
          details: { email: customer.email },
        },
      });
      return updated;
    });
  }

  async listAuditLogs(query: AdminAuditListDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.q
        ? {
            OR: [
              { entityType: { contains: query.q, mode: 'insensitive' } },
              { entityId: { contains: query.q, mode: 'insensitive' } },
              { actor: { email: { contains: query.q, mode: 'insensitive' } } },
              { action: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.adminAuditLog.count({ where }),
      this.prisma.adminAuditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  private validateVoucher(input: AdminVoucherFieldsDto): Prisma.VoucherUncheckedCreateInput {
    const startsAt = new Date(input.startsAt);
    const expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime())) {
      throw new BadRequestException('Thời hạn mã ưu đãi không hợp lệ.');
    }
    if (expiresAt <= startsAt) {
      throw new BadRequestException('Thời điểm hết hạn phải sau thời điểm bắt đầu.');
    }
    if (input.type === VoucherType.PERCENT && (input.value < 1 || input.value > 100)) {
      throw new BadRequestException('Mã phần trăm phải nằm trong khoảng 1–100.');
    }
    if (input.type === VoucherType.FIXED && input.value < 1) {
      throw new BadRequestException('Mã giảm giá cố định phải có giá trị lớn hơn 0.');
    }
    if (input.type === VoucherType.FREE_SHIPPING && input.value !== 0) {
      throw new BadRequestException('Mã miễn phí vận chuyển phải có giá trị bằng 0.');
    }
    if (input.type === VoucherType.FREE_SHIPPING && input.maxDiscountVnd != null) {
      throw new BadRequestException('Mã miễn phí vận chuyển không dùng mức giảm tối đa.');
    }
    if (
      input.perUserLimit != null &&
      input.totalLimit != null &&
      input.perUserLimit > input.totalLimit
    ) {
      throw new BadRequestException('Giới hạn mỗi khách không thể lớn hơn tổng lượt sử dụng.');
    }
    return {
      code: input.code.trim().toUpperCase(),
      type: input.type,
      value: input.value,
      minSubtotalVnd: input.minSubtotalVnd,
      maxDiscountVnd: input.maxDiscountVnd ?? null,
      startsAt,
      expiresAt,
      totalLimit: input.totalLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      isStackable: input.isStackable,
    };
  }

  private validateBanner(input: { startsAt: string | Date; endsAt: string | Date }): void {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException('Thời hạn banner không hợp lệ.');
    }
  }

  private handleUniqueConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}
