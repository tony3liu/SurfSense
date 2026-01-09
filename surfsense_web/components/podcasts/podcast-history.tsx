"use client";

import { podcastsApiService } from "@/lib/apis/podcasts-api.service";
import type { Podcast } from "@/contracts/types/podcast.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Download, Play, Clock, Calendar, Mic2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
	const t = useTranslations("nav_menu.podcast");
	const tCommon = useTranslations("common");

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
			toast.error(t("load_history_failed"));
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
			toast.success(t("deleted_success"));
			setPodcasts((prev) => prev.filter((p) => p.id !== id));
			if (selectedPodcastId === id) {
				setSelectedPodcastId(null);
			}
		} catch (err) {
			console.error("Failed to delete podcast:", err);
			toast.error(t("delete_failed"));
		} finally {
			setPodcastToDelete(null);
		}
	};

	// Download podcast
	const handleDownload = (podcast: Podcast) => {
		if (!podcast.file_location) {
			toast.error(t("audio_unavailable"));
			return;
		}

		// Create download link
		const link = document.createElement("a");
		link.href = `/api/v1/podcasts/${podcast.id}/audio`;
		link.download = `${podcast.title}.mp3`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		toast.success(t("download_started"));
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
		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Get TTS provider label
	const getTTSProviderLabel = (provider: string | null) => {
		if (!provider) return t("default");
		if (provider.includes("openai")) return t("openai_tts");
		if (provider.includes("vertex")) return t("vertex_ai");
		if (provider.includes("kokoro")) return t("kokoro_local");
		if (provider.includes("azure")) return t("azure_tts");
		return provider;
	};

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("history")}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<div className="text-sm text-muted-foreground">{t("loading")}</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (podcasts.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("history")}</CardTitle>
					<CardDescription>{t("history_desc")}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Mic2 className="h-12 w-12 text-muted-foreground mb-4" />
						<p className="text-sm text-muted-foreground">{t("no_podcasts")}</p>
						<p className="text-xs text-muted-foreground mt-1">
							{t("generate_first")}
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
					<CardTitle>{t("history")}</CardTitle>
					<CardDescription>{t("podcasts_count", { count: podcasts.length })}</CardDescription>
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
									description={`${t("created")} ${formatDate(podcast.created_at)}`}
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
						<AlertDialogTitle>{t("delete_podcast")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("delete_confirm")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => podcastToDelete && handleDelete(podcastToDelete)}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t("delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
