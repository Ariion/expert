import { siteImage, OG_SIZE } from "@/components/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Upstream Status";

export default function Image() {
  return siteImage("en");
}
