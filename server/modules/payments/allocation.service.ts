/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PaymentAllocation } from '../../../src/types/index.ts';
import { withTransaction, type DbClient } from '../../config/prisma.ts';
import { NotFoundError } from '../../shared/errors/app-error.ts';
import { round2, toDecimal } from '../../shared/utils/decimal.ts';
import { deriveShipmentPaymentStatus } from '../shipments/shipment.calculator.ts';
import { validateAllocationAgainstBalances } from './payment.calculator.ts';
import { paymentsRepository } from './payments.repository.ts';

export const allocationService = {
  async allocateWithTx(
    tx: DbClient,
    input: { paymentId: string; shipmentId: string; allocatedAmountUsd: number; notes?: string },
    actorUserId: string
  ): Promise<PaymentAllocation> {
    const amount = round2(input.allocatedAmountUsd);

    const { payment, shipment } = await paymentsRepository.lockPaymentAndShipmentForAllocation(
      input.paymentId,
      input.shipmentId,
      tx
    );

    if (!payment) throw new NotFoundError('Payment record not found.');
    if (!shipment) throw new NotFoundError('Shipment record not found.');

    const [totalAllocatedOnPayment, totalAllocatedToShipment] = await Promise.all([
      paymentsRepository.sumAllocationsForPayment(payment.id, tx),
      paymentsRepository.sumAllocationsForShipment(shipment.id, tx),
    ]);

    const availablePaymentBalance = round2(toDecimal(payment.verifiedAmount).minus(totalAllocatedOnPayment));
    const invoiceBalanceDue = round2(toDecimal(shipment.invoiceValueUsd).minus(totalAllocatedToShipment));

    validateAllocationAgainstBalances({
      requestedAmountUsd: amount,
      availablePaymentBalance,
      invoiceBalanceDue,
      irmNumber: payment.irmNumber,
      invoiceNumber: shipment.invoiceNumber,
    });

    const allocation = await paymentsRepository.createAllocation(
      {
        paymentId: payment.id,
        shipmentId: shipment.id,
        allocatedAmountUsd: amount,
        notes: input.notes,
        allocatedByUserId: actorUserId,
      },
      tx
    );

    const newTotalPaid = round2(toDecimal(totalAllocatedToShipment).plus(amount));
    const newStatus = deriveShipmentPaymentStatus(shipment.invoiceValueUsd, newTotalPaid);

    await tx.shipment.update({
      where: { id: shipment.id },
      data: { paymentStatus: newStatus },
    });

    return allocation;
  },

  async allocate(
    input: { paymentId: string; shipmentId: string; allocatedAmountUsd: number; notes?: string },
    actorUserId: string
  ): Promise<PaymentAllocation> {
    return withTransaction((tx) => this.allocateWithTx(tx, input, actorUserId));
  },

  async deallocate(allocationId: string): Promise<{ success: boolean }> {
    return withTransaction(async (tx) => {
      const initial = await paymentsRepository.findAllocationById(allocationId, tx);
      if (!initial) throw new NotFoundError('Allocation not found.');

      const { payment, shipment } = await paymentsRepository.lockPaymentAndShipmentForAllocation(
        initial.paymentId,
        initial.shipmentId,
        tx
      );
      if (!payment) throw new NotFoundError('Linked payment not found.');
      if (!shipment) throw new NotFoundError('Linked shipment not found.');

      const existing = await paymentsRepository.findAllocationById(allocationId, tx);
      if (!existing) throw new NotFoundError('Allocation not found.');

      await paymentsRepository.deleteAllocation(allocationId, tx);

      const remainingPaid = await paymentsRepository.sumAllocationsForShipment(shipment.id, tx);
      const newStatus = deriveShipmentPaymentStatus(shipment.invoiceValueUsd, remainingPaid);
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { paymentStatus: newStatus },
      });

      return { success: true };
    });
  },
};
