import { NotFoundException } from '@nestjs/common';
import dataset from '../src/addresses/data/administrative-units.json';
import { AddressesService } from '../src/addresses/addresses.service';
import type { PrismaService } from '../src/database/prisma.service';

describe('AddressesService', () => {
  it('exposes the bundled current province and commune reference', () => {
    const service = new AddressesService({} as PrismaService);
    const result = service.getReferenceData();

    expect(result.provinces).toHaveLength(34);
    expect(result.communes).toHaveLength(3321);
    expect(new Set(result.communes.map((commune) => commune.code)).size).toBe(3321);
    expect(
      result.communes.every((commune) =>
        result.provinces.some((province) => province.code === commune.provinceCode),
      ),
    ).toBe(true);
    expect(result.retrievedAt).toBe('2026-11-07');
  });

  it('rejects a commune code paired with a different province', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new AddressesService(prisma as unknown as PrismaService);
    const commune = dataset.communes[0];
    if (!commune) throw new Error('Test data needs at least one commune.');
    const otherProvince = dataset.provinces.find(
      (province) => province.code !== commune.provinceCode,
    );
    if (!otherProvince) throw new Error('Test data needs at least two provinces.');

    await expect(
      service.create('user-1', {
        label: 'Nhà',
        recipientName: 'Người nhận',
        phone: '0912345678',
        streetAddress: 'Số 1',
        provinceCode: otherProvince.code,
        communeCode: commune.code,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
