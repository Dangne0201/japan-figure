'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

interface Suggestion {
  slug: string;
  name: string;
  characterName: string;
}

export default function SearchBar({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setItems([]);
      setOpen(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/catalog/suggestions?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Suggestion request failed: ${response.status}`);
        const suggestions = (await response.json()) as Suggestion[];
        setItems(suggestions);
        setOpen(true);
        setError(false);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        console.error('Unable to load catalog search suggestions.', requestError);
        setItems([]);
        setOpen(false);
        setError(true);
      }
    }, 220);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (active >= 0 && items[active]) {
      event.preventDefault();
      router.push(`/products/${items[active].slug}`);
    }
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <form action="/products" className="relative w-full" onSubmit={submit} role="search">
      <label className="sr-only" htmlFor="catalog-search">
        Tìm sản phẩm
      </label>
      <div className="flex min-h-11 items-center gap-2 rounded-full border border-brand-plum/15 bg-white px-4 focus-within:ring-2 focus-within:ring-brand-plum/40">
        <span aria-hidden="true" className="text-brand-plum">
          ⌕
        </span>
        <input
          ref={inputRef}
          id="catalog-search"
          name="q"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder="Tìm nhân vật, series..."
          role="combobox"
          aria-autocomplete="list"
          aria-controls={open && items.length > 0 ? 'catalog-suggestions' : undefined}
          aria-expanded={open && items.length > 0}
          aria-activedescendant={open && active >= 0 ? `catalog-suggestion-${active}` : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-brand-ink/45"
        />
        <button className="text-sm font-semibold text-brand-plum" type="submit">
          Tìm
        </button>
      </div>
      {error && (
        <p className="sr-only" role="status">
          Chưa tải được gợi ý tìm kiếm.
        </p>
      )}
      {open && items.length > 0 && (
        <ul
          id="catalog-suggestions"
          role="listbox"
          aria-label="Gợi ý sản phẩm"
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-brand-plum/10 bg-white p-2 shadow-soft"
        >
          {items.map((item, index) => (
            <li
              key={item.slug}
              id={`catalog-suggestion-${index}`}
              role="option"
              aria-selected={index === active}
            >
              <Link
                href={`/products/${item.slug}`}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3 py-2 text-sm hover:bg-brand-cream ${index === active ? 'bg-brand-cream' : ''}`}
              >
                <span className="block font-semibold">{item.characterName}</span>
                <span className="block text-xs text-brand-ink/60">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
