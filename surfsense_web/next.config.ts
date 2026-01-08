import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Create the next-intl plugin
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
	output: "standalone",
	// Disable StrictMode for BlockNote compatibility with React 19/Next 15
	reactStrictMode: false,
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
		],
	},
	// Mark BlockNote server packages as external
	serverExternalPackages: ["@blocknote/server-util"],

	// Configure webpack to handle blocknote packages
	webpack: (config, { isServer }) => {
		if (isServer) {
			// Don't bundle these packages on the server
			config.externals = [...(config.externals || []), "@blocknote/server-util"];
		}
		return config;
	},

	// PostHog reverse proxy configuration
	// This helps bypass ad blockers by routing requests through your domain
	async rewrites() {
		// For Docker: Next.js server proxies to backend using container name
		// Browser makes direct requests to localhost:8000
		const backendInternalUrl = "http://backend:8000";
		
		return [
			// Backend API proxy - Next.js server proxies these to backend
			{
				source: "/auth/:path*",
				destination: `${backendInternalUrl}/auth/:path*`,
			},
			{
				source: "/users/:path*",
				destination: `${backendInternalUrl}/users/:path*`,
			},
			{
				source: "/api/:path*", 
				destination: `${backendInternalUrl}/api/:path*`,
			},
			{
				source: "/verify-token",
				destination: `${backendInternalUrl}/verify-token`,
			},
			// PostHog reverse proxy
			{
				source: "/ingest/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/ingest/:path*",
				destination: "https://us.i.posthog.com/:path*",
			},
			{
				source: "/ingest/decide",
				destination: "https://us.i.posthog.com/decide",
			},
		];
	},
	// Required for PostHog reverse proxy to work correctly
	skipTrailingSlashRedirect: true,
};

// Wrap the config with MDX and next-intl plugins
const withMDX = createMDX({});

export default withNextIntl(withMDX(nextConfig));
