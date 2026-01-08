"use client";

import { podcastsApiService } from "@/lib/apis/podcasts-api.service";
import type { Podcast } from "@/contracts/types/podcast.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Download, Play, Clock, Calendar, Mic2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PodcastPlayer } from "../tool-ui/generate-podcast";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PodcastHistoryProps {
	searchSpaceId: number;
	refreshTrigger?: number; // Used to trigger refresh when new podcast is generated
}

export function PodcastHistory({ searchSpaceId, refreshTrigger }: PodcastHistoryProps) {
	const [podcasts, setPodcasts] = useState<Podcast[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedPodcastId, setSelectedPodcastId] = useState<number | null>(null);
	const [podcastToDelete, setPodcastToDelete] = useState<number | null>(null);

	// Load podcasts
	const loadPodcasts = async () => {
		setLoading(true);
		try {
			const response = await podcastsApiService.getPodcasts({
				queryParams: {
					search_space_id: searchSpaceId,
					limit: 50,
				},
			});
			setPodcasts(response);
		} catch (err) {
			console.error("Failed to load podcasts:", err);
			toast.error("Failed to load podcast history");
		} finally {
			setLoading(false);
		}
	};

	// Load on mount and when refreshTrigger changes
	useEffect(() => {
		loadPodcasts();
	}, [searchSpaceId, refreshTrigger]);

	// Delete podcast
	const handleDelete = async (id: number) => {
		try {
			await podcastsApiService.deletePodcast({ id });
			toast.success("Podcast deleted successfully");
			setPodcasts((prev) => prev.filter((p) => p.id !== id));
			if (selectedPodcastId === id) {
				setSelectedPodcastId(null);
			}
		} catch (err) {
			console.error("Failed to delete podcast:", err);
			toast.error("Failed to delete podcast");
		} finally {
			setPodcastToDelete(null);
		}
	};

	// Download podcast
	const handleDownload = (podcast: Podcast) => {
		if (!podcast.file_location) {
			toast.error("Audio file not available");
			return;
		}

		// Create download link
		const link = document.createElement("a");
		link.href = `/api/v1/podcasts/${podcast.id}/audio`;
		link.download = `${podcast.title}.mp3`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		toast.success("Download started");
	};

	// Format duration
	const formatDuration = (seconds: number | null) => {
		if (!seconds) return "N/A";
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Format date
	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Get TTS provider label
	const getTTSProviderLabel = (provider: string | null) => {
		if (!provider) return "Default";
		if (provider.includes("openai")) return "OpenAI";
		if (provider.includes("vertex")) return "Vertex AI";
		if (provider.includes("kokoro")) return "Kokoro";
		if (provider.includes("azure")) return "Azure";
		return provider;
	};

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Podcast History</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<div className="text-sm text-muted-foreground">Loading...</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (podcasts.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Podcast History</CardTitle>
					<CardDescription>Your generated podcasts will appear here</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Mic2 className="h-12 w-12 text-muted-foreground mb-4" />
						<p className="text-sm text-muted-foreground">No podcasts yet</p>
						<p className="text-xs text-muted-foreground mt-1">
							Generate your first podcast to see it here
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Podcast History</CardTitle>
					<CardDescription>{podcasts.length} podcast(s) generated</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{podcasts.map((podcast) => (
						<Card key={podcast.id} className="border">
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<CardTitle className="text-base">{podcast.title}</CardTitle>
										<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
											<div className="flex items-center gap-1">
												<Clock className="h-3 w-3" />
												{formatDuration(podcast.duration_seconds)}
											</div>
											<div className="flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												{formatDate(podcast.created_at)}
											</div>
											<div className="flex items-center gap-1">
												<Mic2 className="h-3 w-3" />
												{getTTSProviderLabel(podcast.tts_provider)}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setSelectedPodcastId(
													selectedPodcastId === podcast.id ? null : podcast.id
												)
											}
										>
											<Play className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleDownload(podcast)}
										>
											<Download className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setPodcastToDelete(podcast.id)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</div>
							</CardHeader>

							{/* Expandable Player */}
							{selectedPodcastId === podcast.id && (
								<CardContent className="pt-0">
									<PodcastPlayer
									podcastId={podcast.id}
									title={podcast.title}
									description={`Created ${formatDate(podcast.created_at)}`}
								/>
								</CardContent>
							)}
						</Card>
					))}
				</CardContent>
			</Card>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={podcastToDelete !== null} onOpenChange={() => setPodcastToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Podcast</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this podcast? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => podcastToDelete && handleDelete(podcastToDelete)}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
