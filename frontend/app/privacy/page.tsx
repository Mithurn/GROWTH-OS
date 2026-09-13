export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] px-6 py-16">
      <article className="max-w-2xl mx-auto text-[#1A1A1A]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-3">GrowthOS</p>
        <h1 className="text-3xl font-bold mb-2">Privacy policy</h1>
        <p className="text-sm text-[#6B7280] mb-10">Last updated 13 September 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-[#374151]">
          <p>
            GrowthOS is a retail growth workspace. This page explains what we collect when you
            sign in and use the product.
          </p>
          <section>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-2">Google sign-in</h2>
            <p>
              If you continue with Google, we receive your name and email so we can create a
              workspace account. We do not ask Google for your contacts, files, or Gmail.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-2">Workspace data</h2>
            <p>
              Customer lists, campaigns, and analytics you upload or generate stay in your
              company workspace. We use that data to find opportunities and send messages you
              approve. We do not sell it.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-2">Contact</h2>
            <p>
              Questions:{' '}
              <a href="mailto:mithurnjeromme172@gmail.com" className="text-[#5B4FFF] hover:underline">
                mithurnjeromme172@gmail.com
              </a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
