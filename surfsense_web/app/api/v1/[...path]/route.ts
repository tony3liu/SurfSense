import { NextRequest, NextResponse } from "next/server";

/**
 * API Proxy Route
 *
 * This route proxies all /api/v1/* requests to the FastAPI backend.
 * This solves the Docker networking issue where:
 * - Browser (on host) needs to use localhost:8000
 * - Next.js SSR (in container) needs to use backend:8000
 *
 * By using a proxy, both can use the same relative URL (/api/v1/...)
 */

// Get backend URL from environment, with fallback
// In Docker: BACKEND_URL should be http://backend:8000
// In local dev: BACKEND_URL should be http://localhost:8000
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL || "http://localhost:8000";

async function handler(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> }
) {
	try {
		const params = await context.params;
		const path = params.path.join("/");
		const searchParams = request.nextUrl.searchParams.toString();
		const backendUrl = `${BACKEND_URL}/api/v1/${path}${searchParams ? `?${searchParams}` : ""}`;

		// Clone headers, removing host-related headers
		const headers = new Headers();
		request.headers.forEach((value, key) => {
			// Skip headers that should not be forwarded
			if (!["host", "connection", "content-length"].includes(key.toLowerCase())) {
				headers.set(key, value);
			}
		});

		// Prepare request body if present
		let body: BodyInit | null = null;
		if (request.method !== "GET" && request.method !== "HEAD") {
			// For FormData, pass it directly
			const contentType = request.headers.get("content-type");
			if (contentType?.includes("multipart/form-data")) {
				body = await request.blob();
			} else if (contentType?.includes("application/json")) {
				body = await request.text();
			} else {
				body = await request.blob();
			}
		}

		// Make request to backend
		const backendResponse = await fetch(backendUrl, {
			method: request.method,
			headers,
			body,
			// Important: Include credentials for authentication
			credentials: "include",
		});

		// Clone response headers
		const responseHeaders = new Headers();
		backendResponse.headers.forEach((value, key) => {
			responseHeaders.set(key, value);
		});

		// Handle cookies specially to ensure they're passed through
		const cookies = backendResponse.headers.get("set-cookie");
		if (cookies) {
			responseHeaders.set("set-cookie", cookies);
		}

		// Return response with same status and headers
		return new NextResponse(backendResponse.body, {
			status: backendResponse.status,
			statusText: backendResponse.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error("API Proxy Error:", error);
		return NextResponse.json(
			{ error: "Failed to proxy request to backend" },
			{ status: 502 }
		);
	}
}

// Export handlers for all HTTP methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
