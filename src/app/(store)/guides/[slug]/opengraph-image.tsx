import { ImageResponse } from "next/og";
import { getGuide, getGuides, GUIDE_SECTION_LABELS } from "@/lib/guides";
import { site } from "@/lib/site";

// A guide's share image (1200x630 PNG): the brand's dark background, the section and the guide's title. Made at
// build time for each guide, and on first request for guides published since.

export const alt = "TraceCoreLab setup guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const guides = await getGuides();
  // Same params as the page; the placeholder (no guides yet) gets the generic image.
  return guides.length ? guides.map((g) => ({ slug: g.slug })) : [{ slug: "__none__" }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  const title = guide?.title ?? "Setup guides and hardware explainers";
  const kicker = guide ? `Guides / ${GUIDE_SECTION_LABELS[guide.section]}` : "Guides";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#060304",
          backgroundImage: "radial-gradient(circle at 92% 0%, rgba(255, 61, 0, 0.32), transparent 55%)",
          color: "#f7f2ef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 26, letterSpacing: 5, textTransform: "uppercase", color: "#b4aaa7" }}>
          <div style={{ width: 44, height: 6, backgroundImage: "linear-gradient(90deg, #ff0f0f, #ff3a00, #ff7300)" }} />
          <span>{kicker}</span>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 60 : 72, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1, maxWidth: 1040 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28 }}>
          <span style={{ fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{site.name}</span>
          <span style={{ color: "#857b79" }}>{`${site.domain}/guides`}</span>
        </div>
      </div>
    ),
    size,
  );
}
