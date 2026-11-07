import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Address } from '@prisma/client';
import dataset from './data/administrative-units.json';
import { PrismaService } from '../database/prisma.service';
import type { AddressInputDto } from './addresses.dto';

const provinces = new Map(dataset.provinces.map((province) => [province.code, province]));
const communes = new Map(dataset.communes.map((commune) => [commune.code, commune]));

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  getReferenceData() {
    return {
      source: dataset.source,
      retrievedAt: dataset.retrievedAt,
      provinces: dataset.provinces,
      communes: dataset.communes,
    };
  }

  list(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, input: AddressInputDto): Promise<Address> {
    const place = this.resolvePlace(input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const hasAddress = await transaction.address.count({ where: { userId } });
        const makeDefault = input.isDefault === true || hasAddress === 0;
        if (makeDefault) {
          await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } });
        }
        return transaction.address.create({
          data: { ...input, ...place, isDefault: makeDefault, userId },
        });
      });
    } catch (error) {
      this.throwDefaultConflict(error);
      throw error;
    }
  }

  async update(userId: string, id: string, input: AddressInputDto): Promise<Address> {
    const place = this.resolvePlace(input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.address.findFirst({ where: { id, userId } });
        if (!existing) throw new NotFoundException('Không tìm thấy địa chỉ.');
        if (input.isDefault) {
          await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } });
        }
        const updated = await transaction.address.update({
          where: { id },
          data: { ...input, ...place, isDefault: input.isDefault ?? existing.isDefault },
        });
        if (existing.isDefault && !updated.isDefault) {
          const next = await transaction.address.findFirst({
            where: { userId, id: { not: id } },
            orderBy: { createdAt: 'asc' },
          });
          if (next)
            await transaction.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
        return updated;
      });
    } catch (error) {
      this.throwDefaultConflict(error);
      throw error;
    }
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const address = await transaction.address.findFirst({ where: { id, userId } });
        if (!address) throw new NotFoundException('Không tìm thấy địa chỉ.');
        await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } });
        return transaction.address.update({ where: { id }, data: { isDefault: true } });
      });
    } catch (error) {
      this.throwDefaultConflict(error);
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const address = await transaction.address.findFirst({ where: { id, userId } });
      if (!address) throw new NotFoundException('Không tìm thấy địa chỉ.');
      await transaction.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await transaction.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (next)
          await transaction.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  private resolvePlace(input: AddressInputDto) {
    const province = provinces.get(input.provinceCode);
    const commune = communes.get(input.communeCode);
    if (!province || !commune || commune.provinceCode !== input.provinceCode) {
      throw new NotFoundException('Tỉnh/thành hoặc xã/phường không thuộc danh mục hiện hành.');
    }
    return {
      provinceCode: province.code,
      provinceName: province.name,
      communeCode: commune.code,
      communeName: commune.name,
      communeType: commune.type,
    };
  }

  private throwDefaultConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(
        'Địa chỉ mặc định vừa được cập nhật. Vui lòng tải lại danh sách.',
      );
    }
  }
}
