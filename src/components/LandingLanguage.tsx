"use client";
import { useEffect } from "react";
import { rememberLanguage } from "@/lib/language";
import type { Locale } from "@/lib/types";
export function LandingLanguage({ locale }: { locale: Locale }) {
  useEffect(() => {
    rememberLanguage(locale);
  }, [locale]);
  return null;
}
