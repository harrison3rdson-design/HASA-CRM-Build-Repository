import Link from "next/link";
import { redirect } from "next/navigation";
import { AdditionalServiceDocument } from "@/components/additional-services/additional-service-document";
import { AcceptancePreviewCard } from "@/components/public/acceptance-preview-card";
import { getCurrentUser } from "@/lib/auth/server";
import { getCompanySettings } from "@/lib/data/app-data";
import { getAdditionalServiceDetail } from "@/lib/data/detail-data";
import "@/styles/public.css";

export default async function AdditionalServicePreviewPage({
  params,
}: {
  params: Promise<{ authorizationId: string }>;
}) {
  const { authorizationId } = await params;
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ authorization }, company] = await Promise.all([
    getAdditionalServiceDetail(authorizationId),
    getCompanySettings(),
  ]);

  return (
    <main className="public-shell public-preview-shell">
      <aside className="public-preview-notice" aria-label="Customer preview status">
        <div>
          <strong>Customer View Preview</strong>
          <span>This is the authorization exactly as the customer will see it.</span>
        </div>
        <Link className="public-preview-back" href={`/additional-services/${authorizationId}`}>
          Back to Authorization Work Area
        </Link>
      </aside>

      <AdditionalServiceDocument authorization={authorization} company={company} />
      <AcceptancePreviewCard buttonText="Accept Additional Service" />
    </main>
  );
}

