'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

export default function ProductGallery({
  slug,
  primaryUrl,
  alt,
}: {
  slug: string;
  primaryUrl: string;
  alt: string;
}) {
  const [images, setImages] = useState([primaryUrl]);
  const [selected, setSelected] = useState(primaryUrl);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    async function loadImages() {
      try {
        const response = await fetch(`/catalog-assets/${encodeURIComponent(slug)}/gallery`);
        if (!response.ok) throw new Error(`Product gallery returned HTTP ${response.status}.`);
        const result = (await response.json()) as string[];
        if (active && result.length > 0) {
          setImages(result);
          setSelected(result[0] ?? primaryUrl);
        }
      } catch (error) {
        console.error(`Unable to load local gallery for "${slug}".`, error);
      }
    }
    void loadImages();
    return () => {
      active = false;
    };
  }, [primaryUrl, slug]);

  return (
    <div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-xl overflow-hidden rounded-[2rem] border border-brand-plum/10 bg-white">
        <button
          aria-label="Phóng to hình sản phẩm"
          className="absolute inset-0 z-10 cursor-zoom-in"
          onClick={() => dialogRef.current?.showModal()}
          type="button"
        />
        <Image
          src={selected}
          alt={alt}
          fill
          priority
          unoptimized
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 ? (
        <div
          className="mx-auto mt-3 flex max-w-xl gap-3 overflow-x-auto pb-2"
          aria-label="Hình ảnh sản phẩm"
          role="group"
        >
          {images.map((image, index) => (
            <button
              aria-label={`Chọn hình ${index + 1}`}
              aria-pressed={selected === image}
              className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${
                selected === image ? 'border-brand-plum' : 'border-transparent'
              }`}
              key={image}
              onClick={() => setSelected(image)}
              type="button"
            >
              <Image src={image} alt="" fill unoptimized sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <dialog
        aria-label="Hình sản phẩm phóng to"
        className="m-auto max-h-[92dvh] max-w-[min(92vw,56rem)] rounded-3xl bg-white p-3 shadow-2xl backdrop:bg-black/75"
        ref={dialogRef}
      >
        <div className="relative grid max-h-[84dvh] min-h-64 min-w-64 place-items-center sm:min-h-96 sm:min-w-96">
          <button
            aria-label="Đóng hình phóng to"
            className="absolute right-2 top-2 z-10 grid size-11 place-items-center rounded-full bg-white text-xl shadow"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            ×
          </button>
          <Image
            src={selected}
            alt={alt}
            width={1000}
            height={1250}
            unoptimized
            className="max-h-[84dvh] w-auto max-w-[86vw] object-contain"
          />
        </div>
      </dialog>
    </div>
  );
}
