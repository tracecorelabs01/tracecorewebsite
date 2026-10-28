"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { deleteImage, moveImage, updateImageAlt, uploadProductImages } from "@/actions/admin/products";
import { ActionForm, ConfirmButton, Input, SubmitButton } from "./forms";
import { Card } from "./ui";

type Img = { id: number; url: string; alt: string; width: number | null; height: number | null };

export function ImageManager({ productId, images }: { productId: number; images: Img[] }) {
  return (
    <Card title="Photos" description="The first photo is the main image. JPG, PNG or WebP up to 10 MB — converted to WebP automatically.">
      {images.length > 0 && (
        <ul className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-line bg-ink-950">
              <div className="relative aspect-square">
                <Image src={img.url} alt={img.alt} fill unoptimized className="object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Main</span>}
              </div>
              <div className="space-y-2 p-3">
                <ActionForm action={updateImageAlt.bind(null, img.id)} className="flex gap-2" showStatus={false}>
                  <Input name="alt" defaultValue={img.alt} placeholder="Alt text" className="h-8 text-xs" aria-label="Alt text" />
                  <SubmitButton variant="secondary" size="sm">
                    Save
                  </SubmitButton>
                </ActionForm>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <ConfirmButton action={() => moveImage(img.id, -1)} variant="ghost" className={i === 0 ? "invisible" : undefined}>
                      <ArrowLeft className="size-3.5" />
                      <span className="sr-only">Move earlier</span>
                    </ConfirmButton>
                    <ConfirmButton action={() => moveImage(img.id, 1)} variant="ghost" className={i === images.length - 1 ? "invisible" : undefined}>
                      <ArrowRight className="size-3.5" />
                      <span className="sr-only">Move later</span>
                    </ConfirmButton>
                  </div>
                  <ConfirmButton action={() => deleteImage(img.id)} confirm="Delete this photo?" variant="danger">
                    <Trash2 className="size-3.5" /> Delete
                  </ConfirmButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={uploadProductImages.bind(null, productId)} resetOnSuccess className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong p-4 sm:flex-row sm:items-center">
        <ImagePlus className="hidden size-5 text-blaze sm:block" />
        <input
          type="file"
          name="images"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="flex-1 text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-ink-700"
        />
        <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
      </ActionForm>
    </Card>
  );
}
