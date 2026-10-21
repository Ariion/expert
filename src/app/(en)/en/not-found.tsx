import type { Metadata } from "next";
import { NotFoundBody } from "@/components/pages/NotFoundBody";
import { dict } from "@/lib/i18n";

export const metadata: Metadata = {
  title: dict("en").notFound.metaTitle,
  description: dict("en").notFound.metaDescription,
};

export default function NotFound() {
  return <NotFoundBody locale="en" />;
}
