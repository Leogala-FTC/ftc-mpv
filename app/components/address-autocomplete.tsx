"use client";

import { useState, useEffect, useRef } from "react";

type AddressResult = {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    hamlet?: string;
    county?: string;
    state?: string;
  };
};

type ParsedAddress = {
  street: string;       // via + civico
  cap: string;          // CAP
  city: string;         // città
  province: string;     // provincia/contea
  fullAddress: string;  // indirizzo completo formattato
};

interface Props {
  onSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
  defaultValue?: string;
}

export default function AddressAutocomplete({ onSelect, placeholder = "Cerca indirizzo...", defaultValue = "" }: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 4) { setResults([]); setOpen(false); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=it`;
        const res = await fetch(url, { headers: { "Accept-Language": "it" } });
        const data: AddressResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function parseAddress(r: AddressResult): ParsedAddress {
    const a = r.address;
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? "";
    const cap = a.postcode ?? "";
    const province = a.county ?? a.state ?? "";
    // Formato leggibile per il display_name (prendi solo le prime 3 parti)
    const fullAddress = r.display_name.split(",").slice(0, 3).join(",").trim();
    return { street, cap, city, province, fullAddress };
  }

  function handleSelect(r: AddressResult) {
    const parsed = parseAddress(r);
    setQuery(parsed.fullAddress);
    setOpen(false);
    onSelect(parsed);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
        />
        {loading && (
          <div className="absolute right-2 top-2.5">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((r, i) => {
            const parsed = parseAddress(r);
            return (
              <li
                key={i}
                onMouseDown={() => handleSelect(r)}
                className="px-3 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
              >
                <p className="text-sm font-medium text-gray-800">
                  {parsed.street || r.display_name.split(",")[0]}
                </p>
                <p className="text-xs text-gray-500">
                  {[parsed.cap, parsed.city, parsed.province].filter(Boolean).join(" · ")}
                </p>
              </li>
            );
          })}
          <li className="px-3 py-1.5 text-xs text-gray-300 text-right">
            © OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  );
}
