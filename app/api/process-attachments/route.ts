import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: Request) {
  // You can get these from the request body, session, or hardcode for testing
  const { user_email, file_type, date_from, file_name_filter } = await request.json();

  const params = new URLSearchParams({
    user_email,
    file_type,
    date_from,
  });
  if (file_name_filter) params.append("file_name_filter", file_name_filter);

  const fastapiUrl = `http://localhost:8000/attachments/process/?${params.toString()}`;

  try {
    const response = await axios.post(fastapiUrl);
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
