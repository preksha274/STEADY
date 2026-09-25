"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FreezeAssistModal } from "@/components/FreezeAssistModal";

export default function FreezeAssistPage() {
  const router = useRouter();

  return (
    <FreezeAssistModal
      isOpen={true}
      onClose={() => router.push("/today")}
    />
  );
}
