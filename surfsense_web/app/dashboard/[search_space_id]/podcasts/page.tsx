"use client";

import { PodcastGenerator } from "@/components/podcasts/podcast-generator";
import { PodcastHistory } from "@/components/podcasts/podcast-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function PodcastsPage() {
	const t = useTranslations("nav_menu.podcast");
	const params = useParams();
	const searchSpaceId = Number(params.search_space_id);
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Callback when new podcast is generated
	const handlePodcastGenerated = (podcastId: number) => {
		// Trigger history list refresh
		setRefreshTrigger((prev) => prev + 1);
	};

	return (
		<div className="container mx-auto py-6 px-4 max-w-7xl">
			{/* Page Header */}
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<div className="p-2 bg-primary/10 rounded-lg">
						<Mic2 className="h-6 w-6 text-primary" />
					</div>
					<div>
						<h1 className="text-3xl font-bold">{t("studio")}</h1>
						<p className="text-muted-foreground">
							{t("studio_desc")}
						</p>
					</div>
				</div>
			</div>

			{/* Main Content - Responsive Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left Column: Podcast Generator */}
				<div className="lg:col-span-1">
					<Card className="h-fit sticky top-6">
						<CardHeader>
							<CardTitle>{t("generate_podcast")}</CardTitle>
							<CardDescription>
								{t("create_podcast_desc")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<PodcastGenerator
								searchSpaceId={searchSpaceId}
								onPodcastGenerated={handlePodcastGenerated}
							/>
						</CardContent>
					</Card>
				</div>

				{/* Right Column: Podcast History */}
				<div className="lg:col-span-1">
					<PodcastHistory searchSpaceId={searchSpaceId} refreshTrigger={refreshTrigger} />
				</div>
			</div>
		</div>
	);
}
