export default function OpportunityDetailLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return <>{children}</>;
}
