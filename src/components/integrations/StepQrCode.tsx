"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageCircle, RefreshCw, Smartphone } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { WHATSAPP_QR_POLL_INTERVAL_MS } from "@/lib/constants";

interface StepQrCodeProps {
  integrationId: string;
  onConnected: () => void;
  onBack: () => void;
}

type QrState = "loading" | "qr_ready" | "connecting" | "connected" | "error";

export function StepQrCode({ integrationId, onConnected, onBack }: StepQrCodeProps) {
  const { t } = useTranslation();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrState, setQrState] = useState<QrState>("loading");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQr = async () => {
    try {
      const res = await fetch(`/api/integrations/${integrationId}/qr`);
      if (!res.ok) {
        setQrState("error");
        setError(t("integration.qrError"));
        return;
      }

      const data = await res.json();

      if (data.ready) {
        setQrState("connected");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimeout(() => onConnected(), 1500);
        return;
      }

      if (data.qrCode) {
        setQrCode(data.qrCode);
        setQrState("qr_ready");
        setError(null);
      } else if (data.status === "connecting") {
        setQrState("connecting");
      } else {
        setQrState("loading");
      }
    } catch {
      setQrState("error");
      setError(t("integration.qrError"));
    }
  };

  useEffect(() => {
    fetchQr();
    intervalRef.current = setInterval(fetchQr, WHATSAPP_QR_POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        {qrState === "connected" ? (
          <>
            <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-sm font-semibold text-success mb-1">
              {t("integration.qrConnected")}
            </h2>
          </>
        ) : (
          <>
            <MessageCircle className="h-10 w-10 text-[#25D366] mx-auto mb-3" />
            <h2 className="text-sm font-semibold text-text-primary mb-1">
              {t("integration.qrTitle")}
            </h2>
            <p className="text-xs text-text-secondary mb-5 max-w-sm mx-auto">
              {t("integration.qrDescription")}
            </p>

            {/* QR Code Display */}
            <div className="flex items-center justify-center mb-4">
              {qrState === "loading" || qrState === "connecting" ? (
                <div className="h-64 w-64 rounded-2xl bg-surface-alt border border-border flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 text-accent animate-spin" />
                  <p className="text-xs text-text-secondary">
                    {qrState === "connecting" ? t("integration.qrConnecting") : t("integration.qrWaiting")}
                  </p>
                </div>
              ) : qrState === "qr_ready" && qrCode ? (
                <div className="p-4 bg-white rounded-2xl">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=${encodeURIComponent(qrCode)}`}
                    alt="WhatsApp QR Code"
                    width={224}
                    height={224}
                    className="rounded-lg"
                  />
                </div>
              ) : (
                <div className="h-64 w-64 rounded-2xl bg-error/5 border border-error/20 flex flex-col items-center justify-center gap-3">
                  <Smartphone className="h-8 w-8 text-error" />
                  <p className="text-xs text-error">{error || t("integration.qrError")}</p>
                </div>
              )}
            </div>

            {/* Status indicator */}
            {qrState === "qr_ready" && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                <p className="text-xs text-text-secondary">{t("integration.qrWaiting")}</p>
              </div>
            )}

            {/* Refresh button */}
            {(qrState === "error" || qrState === "qr_ready") && (
              <button
                onClick={() => { setQrState("loading"); fetchQr(); }}
                className="h-9 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2 mx-auto cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("integration.qrRefresh")}
              </button>
            )}
          </>
        )}
      </div>

      {qrState !== "connected" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            {t("common.back")}
          </button>
        </div>
      )}
    </div>
  );
}
