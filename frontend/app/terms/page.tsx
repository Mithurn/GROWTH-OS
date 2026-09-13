export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] px-6 py-16">
      <article className="max-w-2xl mx-auto text-[#1A1A1A]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-3">GrowthOS</p>
        <h1 className="text-3xl font-bold mb-2">Terms of service</h1>
        <p className="text-sm text-[#6B7280] mb-10">Last updated 13 September 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-[#374151]">
          <p>
            GrowthOS is provided for running retail growth workspaces. By signing in you agree
            to use the product for your own business data and to keep account access to people
            in your company.
          </p>
          <section>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-2">Your data</h2>
            <p>
              You own the customer and campaign data you upload. You are responsible for having
              the right to contact those customers.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-2">The service</h2>
            <p>
              Opportunity estimates and generated copy are decision support, not a guarantee of
              revenue. You approve campaigns before anything is sent.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-2">Contact</h2>
            <p>
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
