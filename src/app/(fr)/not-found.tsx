import type { Metadata } from "next";
import { NotFoundBody } from "@/components/pages/NotFoundBody";
import { dict } from "@/lib/i18n";

export const metadata: Metadata = {
  title: dict("fr").notFound.metaTitle,
  description: dict("fr").notFound.metaDescription,
};

export default function NotFound() {
  return <NotFoundBody locale="fr" />;
}
