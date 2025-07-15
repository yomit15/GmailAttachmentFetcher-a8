// app/api/get-logs/route.ts

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const userEmail = "user@example.com"; // Replace with actual user email or get from session

  const fastapiUrl = `http://localhost:8000/logs/?user_email=${encodeURIComponent(userEmail)}`;

  const res = await fetch(fastapiUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
