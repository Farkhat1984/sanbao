"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { IntegrationForm } from "@/components/integrations/IntegrationForm";
import type { Integration } from "@/types/integration";

export default function EditIntegrationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/integrations/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setIntegration)
      .catch(() => router.push("/integrations"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!integration) return null;

  return <IntegrationForm integration={integration} />;
}
