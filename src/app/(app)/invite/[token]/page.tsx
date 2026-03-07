"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, AlertCircle } from "lucide-react";

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    setStatus("accepting");
    params.then(({ token }) => {
      fetch("/api/organizations/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setStatus("success");
            setOrgName(data.org?.name || "");
            setTimeout(() => {
              router.push(data.org?.id ? `/organizations/${data.org.id}` : "/organizations");
            }, 2000);
          } else {
            setStatus("error");
            setMessage(data.error || "Ошибка принятия приглашения");
          }
        })
        .catch(() => {
          setStatus("error");
          setMessage("Ошибка сети");
        });
    });
  }, [params, router]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-sm w-full mx-4 text-center">
        {status === "accepting" && (
          <>
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <Building2 className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary mb-2">
              Принимаем приглашение...
            </h1>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-5">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary mb-2">
              Вы присоединились{orgName ? ` к "${orgName}"` : ""}!
            </h1>
            <p className="text-sm text-text-muted">Перенаправляем...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-16 w-16 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="h-8 w-8 text-error" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary mb-2">
              Ошибка
            </h1>
            <p className="text-sm text-text-muted mb-6">{message}</p>
            <button
              onClick={() => router.push("/organizations")}
              className="h-10 px-6 rounded-xl bg-accent text-white text-sm font-medium cursor-pointer"
            >
              К организациям
            </button>
          </>
        )}
      </div>
    </div>
  );
}
