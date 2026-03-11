"use client";

import { useEffect, useRef, useState } from "react";

interface AddressResult {
  address: string;
  city: string;
  province: string;
  cap: string;
}

interface Props {
  value: string;
  onChange: (result: AddressResult) => void;
  placeholder?: string;
  required?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleMaps = any;

declare global {
  interface Window {
    google: GoogleMaps;
    initGoogleMaps?: () => void;
  }
}

export function AddressAutocomplete({ value, onChange, placeholder = "Indirizzo", required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { setLoaded(false); return; }

    if (window.google?.maps?.places) { setLoaded(true); return; }

    window.initGoogleMaps = () => setLoaded(true);

    const existing = document.getElementById("google-maps-script");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&language=it&region=IT`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !inputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "it" },
      fields: ["address_components", "formatted_address"],
      types: ["address"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      if (!place.address_components) return;

      let streetNumber = "";
      let route = "";
      let city = "";
      let province = "";
      let cap = "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const comp of place.address_components as any[]) {
        const types: string[] = comp.types;
        if (types.includes("street_number")) streetNumber = comp.long_name;
        if (types.includes("route")) route = comp.long_name;
        if (types.includes("locality")) city = comp.long_name;
        if (types.includes("administrative_area_level_2")) province = comp.short_name;
        if (types.includes("postal_code")) cap = comp.long_name;
      }

      const address = route ? `${route}${streetNumber ? " " + streetNumber : ""}` : (place.formatted_address ?? "");
      setInputValue(address);
      onChange({ address, city, province, cap });
    });
  }, [loaded, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        // se l'utente digita manualmente (senza scegliere suggerimento)
        if (!loaded) onChange({ address: e.target.value, city: "", province: "", cap: "" });
      }}
      placeholder={placeholder}
      required={required}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  );
}

export function AddressAutocomplete({ value, onChange, placeholder = "Indirizzo", required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoaded(false);
      return;
    }

    // Already loaded
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    window.initGoogleMaps = () => setLoaded(true);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&language=it&region=IT`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // cleanup
    };
  }, []);

  useEffect(() => {
    if (!loaded || !inputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "it" },
      fields: ["address_components", "formatted_address"],
      types: ["address"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place.address_components) return;

      let streetNumber = "";
      let route = "";
      let city = "";
      let province = "";
      let cap = "";

      for (const comp of place.address_components) {
        const types = comp.types;
        if (types.includes("street_number")) streetNumber = comp.long_name;
        if (types.includes("route")) route = comp.long_name;
        if (types.includes("locality")) city = comp.long_name;
        if (types.includes("administrative_area_level_2")) province = comp.short_name;
        if (types.includes("postal_code")) cap = comp.long_name;
      }

      const address = route ? `${route}${streetNumber ? " " + streetNumber : ""}` : place.formatted_address ?? "";
      setInputValue(address);
      onChange({ address, city, province, cap });
    });
  }, [loaded, onChange]);

  // If no API key, fallback to plain input
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange({ address: e.target.value, city: "", province: "", cap: "" });
        }}
        placeholder={placeholder}
        required={required}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
    />
  );
}
