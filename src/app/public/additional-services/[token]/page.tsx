import { getPublicAuthorizationByToken } from "@/lib/public/additional-service";
import { AdditionalServiceDocument } from "@/components/additional-services/additional-service-document";
import { AcceptanceCard } from "@/components/public/acceptance-card";
import "@/styles/public.css";

export default async function PublicAuthorizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { authorization, company } = await getPublicAuthorizationByToken(token);

  return (
    <main className="public-shell">
      <AdditionalServiceDocument authorization={authorization} company={company} />

      <AcceptanceCard
        actionUrl={`/api/public/additional-services/${token}/accept`}
        buttonText="Accept Additional Service"
      />
    </main>
  );
}
