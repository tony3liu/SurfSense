"use client";

import { podcastsApiService } from "@/lib/apis/podcasts-api.service";
import type { PodcastTaskStatusResponse } from "@/contracts/types/podcast.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ContentInputPanel } from "./content-input-panel";
import { TTSConfigPanel } from "./tts-config-panel";
import { PodcastPlayer } from "../tool-ui/generate-podcast";

interface PodcastGeneratorProps {
	searchSpaceId: number;
	onPodcastGenerated?: (podcastId: number) => void;
}

export function PodcastGenerator({ searchSpaceId, onPodcastGenerated }: PodcastGeneratorProps) {
	const t = useTranslations("nav_menu.podcast");
	const tCommon = useTranslations("common");

	// Form state
	const [podcastTitle, setPodcastTitle] = useState(t("defaultTitle"));
	const [userPrompt, setUserPrompt] = useState("");
	const [sourceType, setSourceType] = useState<"text" | "document">("text");
	const [textContent, setTextContent] = useState("");
	const [documentFile, setDocumentFile] = useState<File | null>(null);
	const [ttsProvider, setTtsProvider] = useState("openai/tts-1");
	const [speaker0Voice, setSpeaker0Voice] = useState("");
	const [speaker1Voice, setSpeaker1Voice] = useState("");

	// Generation state
	const [isGenerating, setIsGenerating] = useState(false);
	const [taskId, setTaskId] = useState<string | null>(null);
	const [generatedPodcastId, setGeneratedPodcastId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Poll task status
	useEffect(() => {
		if (!taskId) return;

		const pollInterval = setInterval(async () => {
			try {
				const status = await podcastsApiService.getPodcastTaskStatus({ task_id: taskId });

				if (status.status === "success") {
					clearInterval(pollInterval);
					setIsGenerating(false);
					setTaskId(null);
					setGeneratedPodcastId(status.podcast_id);
					toast.success(t("ready"));
					onPodcastGenerated?.(status.podcast_id);
				} else if (status.status === "error") {
					clearInterval(pollInterval);
					setIsGenerating(false);
					setTaskId(null);
					setError(status.error);
					toast.error(`${t("failed")}: ${status.error}`);
				}
			} catch (err) {
				console.error("Error polling task status:", err);
			}
		}, 5000); // Poll every 5 seconds

		return () => clearInterval(pollInterval);
	}, [taskId, onPodcastGenerated, t]);

	const handleGenerate = async () => {
		// Validation
		if (sourceType === "text" && !textContent.trim()) {
			toast.error(tCommon("required"));
			return;
		}

		if (sourceType === "document" && !documentFile) {
			toast.error(t("upload_document"));
			return;
		}

		if (!ttsProvider) {
			toast.error(t("select_tts_provider"));
			return;
		}

		if (!speaker0Voice || !speaker1Voice) {
			toast.error(t("select_voices"));
			return;
		}

		setIsGenerating(true);
		setError(null);
		setGeneratedPodcastId(null);

		try {
			const response = await podcastsApiService.generatePodcast({
				search_space_id: searchSpaceId,
				podcast_title: podcastTitle,
				user_prompt: userPrompt || undefined,
				tts_provider: ttsProvider,
				speaker_0_voice: speaker0Voice,
				speaker_1_voice: speaker1Voice,
				source_type: sourceType,
				text_content: sourceType === "text" ? textContent : undefined,
				document_file: sourceType === "document" ? documentFile! : undefined,
			});

			setTaskId(response.task_id);
			toast.info(t("generating"));
		} catch (err: any) {
			console.error("Error generating podcast:", err);
			setIsGenerating(false);
			setError(err.message || t("failed"));
			toast.error(err.message || t("failed"));
		}
	};

	return (
		<div className="space-y-6">
			{/* Basic Settings */}
			<Card>
				<CardHeader>
					<CardTitle>{t("details")}</CardTitle>
					<CardDescription>{t("details_desc")}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="podcast-title">{t("title_label")}</Label>
						<Input
							id="podcast-title"
							value={podcastTitle}
							onChange={(e) => setPodcastTitle(e.target.value)}
							placeholder={t("title_placeholder")}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="user-prompt">{t("style_instructions")}</Label>
						<Textarea
							id="user-prompt"
							value={userPrompt}
							onChange={(e) => setUserPrompt(e.target.value)}
							placeholder={t("style_placeholder")}
							rows={3}
							className="resize-none"
						/>
					</div>
				</CardContent>
			</Card>

			{/* Content Input */}
			<ContentInputPanel
				sourceType={sourceType}
				onSourceTypeChange={setSourceType}
				textContent={textContent}
				onTextContentChange={setTextContent}
				documentFile={documentFile}
				onDocumentFileChange={setDocumentFile}
			/>

			{/* TTS Config */}
			<TTSConfigPanel
				ttsProvider={ttsProvider}
				onTTSProviderChange={setTtsProvider}
				speaker0Voice={speaker0Voice}
				onSpeaker0VoiceChange={setSpeaker0Voice}
				speaker1Voice={speaker1Voice}
				onSpeaker1VoiceChange={setSpeaker1Voice}
			/>

			{/* Generate Button */}
			<div className="flex justify-end">
				<Button onClick={handleGenerate} disabled={isGenerating} size="lg">
					{isGenerating ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							{t("generating")}
						</>
					) : (
						<>
							<Mic className="mr-2 h-4 w-4" />
							{t("generate_podcast")}
						</>
					)}
				</Button>
			</div>

			{/* Error Display */}
			{error && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<p className="text-sm text-destructive">{error}</p>
					</CardContent>
				</Card>
			)}

			{/* Generated Podcast Player */}
			{generatedPodcastId && (
				<Card>
					<CardHeader>
						<CardTitle>{t("ready")}</CardTitle>
					</CardHeader>
					<CardContent>
						<PodcastPlayer
							podcastId={generatedPodcastId}
							title={podcastTitle}
							description={t("ready_desc")}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
