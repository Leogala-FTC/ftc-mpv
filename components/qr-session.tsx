"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function SessionQr({ sessionId }: { sessionId: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(sessionId).then(setSrc);
  }, [sessionId]);

  if (!src) return <p>Generazione QR...</p>;
  return <img alt="QR sessione" src={src} className="h-52 w-52 rounded-xl border bg-white p-2" />;
}
