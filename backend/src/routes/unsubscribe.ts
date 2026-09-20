import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const unsubscribeRouter = Router();

function validSignature(communicationId: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(communicationId).digest('hex');
  const supplied = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

unsubscribeRouter.post('/unsubscribe/:communicationId/:signature', async (req, res) => {
  const { communicationId, signature } = req.params;
  if (!validSignature(communicationId, signature)) return res.sendStatus(404);
  const communication = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { campaign: { select: { id: true, companyId: true } } },
  });
  if (!communication || communication.channel !== 'Email') return res.sendStatus(404);
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: communication.customerId },
      data: { emailMarketingConsent: false, emailUnsubscribedAt: new Date() },
    }),
    prisma.campaignAuditEvent.create({
      data: {
        companyId: communication.campaign.companyId,
        campaignId: communication.campaignId,
        eventType: 'UNSUBSCRIBED',
        metadata: { communicationId },
      },
    }),
  ]);
  res.sendStatus(204);
});
