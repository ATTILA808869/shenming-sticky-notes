"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export function ImageField({ name, defaultValue = "", label = "圖片網址" }: { name: string; defaultValue?: string | null; label?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const data = (await response.json()) as { url?: string };
    if (data.url) setValue(data.url);
    setUploading(false);
  }

  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <div className="flex gap-2">
        <input className="input" name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://... 或 /uploads/..." />
        <button className="btn-secondary shrink-0" type="button" onClick={() => fileRef.current?.click()}>
          <Upload size={16} />
          {uploading ? "上傳中" : "上傳"}
        </button>
      </div>
      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </label>
  );
}
