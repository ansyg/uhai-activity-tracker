import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f6f50",
          borderRadius: 8,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path d="M8 6v10.5a8 8 0 0 0 16 0V6" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="16" cy="27" r="2" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
