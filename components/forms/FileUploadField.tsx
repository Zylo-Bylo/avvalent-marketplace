"use client";

import { useRef, useState } from "react";

type FileUploadFieldProps = {
  label: string;
  purpose:
    | "product"
    | "dispatch-proof"
    | "delivery-proof"
    | "return-evidence"
    | "vendor-logo"
    | "kyc"
    | "profile"
    | "homepage-banner";
  accept?: string;
  onUploaded: (url: string) => void;
};

export default function FileUploadField({
  label,
  purpose,
  accept = "image/*,application/pdf",
  onUploaded,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", purpose);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Upload failed.");
        return;
      }

      onUploaded(data.url);
      setMessage("Uploaded");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      setMessage("Upload service is not responding.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          {message && (
            <p
              className={`mt-1 text-xs ${
                message === "Uploaded" ? "text-green-700" : "text-red-700"
              }`}
            >
              {message}
            </p>
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          {uploading ? "Uploading..." : "Choose file"}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                upload(file);
              }
            }}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}
