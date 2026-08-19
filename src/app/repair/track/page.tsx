import Link from "next/link";
import { CustomerTokenService } from "@/auth/customer-token";
import { BrandHeader } from "@/components/brand-header";
import { PrismaCustomerTokenRepository } from "@/db/auth-repositories";
import { prisma } from "@/db/prisma";
import { getCustomerTrackingView } from "@/domain/customer-tracking";
import { CustomerConversation } from "./customer-conversation";
import { PaymentDue } from "./payment-due";

export const dynamic = "force-dynamic";

const milestones = ["Request confirmed", "Verification", "Shipping", "Complete"];

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const access = await new CustomerTokenService(new PrismaCustomerTokenRepository(prisma)).authenticate(token);

  if (!access) {
    return (
      <main className="min-h-screen bg-[#f7f8f5]">
        <BrandHeader quietLabel="Request tracking" />
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">This tracking link isn’t available.</h1>
          <p className="mt-4 leading-7 text-black/55">It may have expired or been replaced. Contact support for a fresh link.</p>
          <Link href="/repair/start" className="mt-7 inline-flex rounded-xl bg-black px-6 py-3 font-semibold text-white">Start a new request</Link>
        </div>
      </main>
    );
  }

  const [order, config] = await Promise.all([prisma.replacementOrder.findFirst({
    where: { id: access.replacementOrderId, customerId: access.customerId },
    include: {
      processType: true,
      returnedDevice: { include: { model: true } },
      shipments: { orderBy: { createdAt: "asc" } },
      messages: { include: { attachments: true }, orderBy: { createdAt: "asc" } },
    },
  }), prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } })]);

  if (!order) return null;
  const inboundShipment = [...order.shipments].reverse().find((shipment) => shipment.type === "inbound");
  const outboundShipment = [...order.shipments].reverse().find((shipment) => shipment.type === "outbound");
  const view = getCustomerTrackingView(order.status, order.processType?.flow, { inboundStatus: inboundShipment?.status, outboundStatus: outboundShipment?.status });
  const returnComplete = inboundShipment?.status === "received" || order.status === "closed";
  const labelReady = Boolean(inboundShipment && ["label_ready", "in_transit", "delivered"].includes(inboundShipment.status));
  const balanceDueInCents = order.processType ? Math.max(0, order.processType.feeInCents + order.processType.depositInCents - order.amountPaidInCents) : 0;
  const messages = order.messages.map((message) => ({ id: message.id, senderKind: message.senderKind, body: message.body, sentAt: message.createdAt.toISOString(), photos: message.attachments.map((photo) => ({ id: photo.id, name: photo.filename, dataUrl: `data:${photo.contentType};base64,${Buffer.from(photo.data).toString("base64")}` })) }));

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[var(--ink)]">
      <BrandHeader quietLabel={`Order #${String(order.orderNumber).padStart(4, "0")}`} />
      <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6 sm:py-14">
        <section className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-[0_20px_60px_rgba(20,30,22,0.07)]">
          <div className={`p-7 sm:p-10 ${view.tone === "attention" ? "bg-amber-50" : view.tone === "complete" ? "bg-[var(--mint)]/35" : "bg-white"}`}>
            <p className="text-sm font-semibold text-[var(--green-strong)]">Latest update</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{view.headline}</h1>
            <p className="mt-4 max-w-xl leading-7 text-black/55">{view.detail}</p>
          </div>

          <div className="border-t border-black/10 p-7 sm:p-10">
            {balanceDueInCents > 0 ? <PaymentDue token={token} balanceInCents={balanceDueInCents} /> : null}
            <CustomerConversation token={token} messages={messages} />

            <ol className="grid grid-cols-4 gap-2">
              {milestones.map((milestone, index) => {
                const number = index + 1;
                const complete = number < view.activeMilestone || view.tone === "complete";
                const active = number === view.activeMilestone && view.tone !== "complete";
                return (
                  <li key={milestone} className="relative text-center">
                    {index > 0 ? <div className={`absolute right-1/2 top-4 h-0.5 w-full ${number <= view.activeMilestone ? "bg-[var(--green)]" : "bg-black/10"}`} /> : null}
                    <span className={`relative mx-auto grid size-8 place-items-center rounded-full text-xs font-bold ${complete ? "bg-[var(--green)] text-white" : active ? "bg-black text-white ring-4 ring-[var(--mint)]" : "bg-black/8 text-black/35"}`}>
                      {complete ? "✓" : number}
                    </span>
                    <span className="mt-3 block text-[11px] font-medium leading-4 text-black/55 sm:text-xs">{milestone}</span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl border border-black/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">Your return</p>
                <p className="mt-3 text-lg font-semibold">{view.returnStatus}</p>
                <p className="mt-2 text-sm text-black/45">{order.returnedDevice?.model.name ?? "Device identification pending"}</p>
              </article>
              <article className="rounded-2xl border border-black/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">Your replacement</p>
                <p className="mt-3 text-lg font-semibold">{view.replacementStatus}</p>
                <p className="mt-2 text-sm text-black/45">Different refurbished unit</p>
              </article>
            </div>

            {!returnComplete ? <div className="mt-6 rounded-2xl bg-[#f7f8f5] p-5 sm:p-6">
              <h2 className="font-semibold">Before returning your device</h2>
              <p className="mt-3 text-sm leading-6 text-black/55">{config.returnInstructions}</p>
              {labelReady ? <div className="mt-5 flex flex-wrap items-center gap-3">
                <a href={`/api/repair/label?token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white">Open return label</a>
                {inboundShipment?.trackingNumber ? <span className="font-mono text-xs text-black/50">Tracking: {inboundShipment.trackingNumber}</span> : null}
              </div> : <p className="mt-4 text-xs text-black/40">Your return label will appear here after Support verifies the request.</p>}
            </div> : null}
          </div>
        </section>
        <p className="mt-6 text-center text-sm text-black/45">Need help? Send a message above so everything stays with this request.</p>
      </div>
    </main>
  );
}
