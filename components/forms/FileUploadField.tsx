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

  async function readError(response: Response, fallback: string) {
    const text = await response.text().catch(() => "");

    if (!text) {
      return fallback;
    }

    try {
      const data = JSON.parse(text) as { error?: string };
      return data.error || fallback;
    } catch {
      return text.slice(0, 180) || fallback;
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setMessage("");

    try {
      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          purpose,
        }),
      });

      if (!signResponse.ok) {
        setMessage(await readError(signResponse, "Upload sign failed."));
        return;
      }

      const signedUpload = (await signResponse.json()) as {
        signedUrl?: string;
        url?: string;
      };

      if (!signedUpload.signedUrl || !signedUpload.url) {
        setMessage("Upload sign response is invalid.");
        return;
      }

      const uploadData = new FormData();
      uploadData.append("cacheControl", "3600");
      uploadData.append("", file);

      const uploadResponse = await fetch(signedUpload.signedUrl, {
        method: "PUT",
        headers: {
          "x-upsert": "false",
        },
        body: uploadData,
      });

      if (!uploadResponse.ok) {
        setMessage(await readError(uploadResponse, "Upload failed."));
        return;
      }

      onUploaded(signedUpload.url);
      setMessage("Uploaded");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Upload failed: ${error.message}`
          : "Upload service is not responding.",
      );
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
