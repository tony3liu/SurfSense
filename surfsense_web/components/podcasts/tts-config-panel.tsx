"use client";

import { podcastsApiService } from "@/lib/apis/podcasts-api.service";
import type { TTSVoice } from "@/contracts/types/podcast.types";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface TTSConfigPanelProps {
	ttsProvider: string;
	onTTSProviderChange: (provider: string) => void;
	speaker0Voice: string;
	onSpeaker0VoiceChange: (voice: string) => void;
	speaker1Voice: string;
	onSpeaker1VoiceChange: (voice: string) => void;
}

const TTS_PROVIDERS = [
	{ value: "openai/tts-1", label: "OpenAI TTS" },
	{ value: "vertex_ai/test", label: "Google Vertex AI" },
	{ value: "local/kokoro", label: "Kokoro (Local)" },
	{ value: "azure/tts-1", label: "Azure TTS" },
];

export function TTSConfigPanel({
	ttsProvider,
	onTTSProviderChange,
	speaker0Voice,
	onSpeaker0VoiceChange,
	speaker1Voice,
	onSpeaker1VoiceChange,
}: TTSConfigPanelProps) {
	const t = useTranslations("nav_menu.podcast");

	const [voices, setVoices] = useState<TTSVoice[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load voices when TTS provider changes
	useEffect(() => {
		if (!ttsProvider) {
			setVoices([]);
			return;
		}

		const loadVoices = async () => {
			setLoading(true);
			setError(null);

			try {
				const response = await podcastsApiService.getTTSVoices({
					provider: ttsProvider,
				});

				setVoices(response.voices);

				// Auto-select default voices if not set
				if (!speaker0Voice && response.voices.length > 0) {
					onSpeaker0VoiceChange(response.voices[0].id);
				}
				if (!speaker1Voice && response.voices.length > 1) {
					onSpeaker1VoiceChange(response.voices[1].id);
				}
			} catch (err) {
				console.error("Failed to load TTS voices:", err);
				setError(t("load_voices_failed"));
			} finally {
				setLoading(false);
			}
		};

		loadVoices();
	}, [ttsProvider]); // Only depend on ttsProvider

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tts_config")}</CardTitle>
				<CardDescription>
					{t("tts_config_desc")}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* TTS Provider Selection */}
				<div className="space-y-2">
					<Label htmlFor="tts-provider">{t("tts_provider")}</Label>
					<Select value={ttsProvider} onValueChange={onTTSProviderChange}>
						<SelectTrigger id="tts-provider">
							<SelectValue placeholder={t("select_provider")} />
						</SelectTrigger>
						<SelectContent>
							{TTS_PROVIDERS.map((provider) => (
								<SelectItem key={provider.value} value={provider.value}>
									{provider.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Loading State */}
				{loading && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						{t("loading_voices")}
					</div>
				)}

				{/* Error State */}
				{error && <div className="text-sm text-destructive">{error}</div>}

				{/* Voice Selections */}
				{!loading && !error && voices.length > 0 && (
					<>
						{/* Speaker 0 Voice */}
						<div className="space-y-2">
							<Label htmlFor="speaker-0-voice">{t("speaker1_voice")}</Label>
							<Select value={speaker0Voice} onValueChange={onSpeaker0VoiceChange}>
								<SelectTrigger id="speaker-0-voice">
									<SelectValue placeholder={t("speaker1_placeholder")} />
								</SelectTrigger>
								<SelectContent>
									{voices.map((voice) => (
										<SelectItem key={voice.id} value={voice.id}>
											<div className="flex flex-col">
												<span className="font-medium">{voice.name}</span>
												<span className="text-xs text-muted-foreground">{voice.description}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Speaker 1 Voice */}
						<div className="space-y-2">
							<Label htmlFor="speaker-1-voice">{t("speaker2_voice")}</Label>
							<Select value={speaker1Voice} onValueChange={onSpeaker1VoiceChange}>
								<SelectTrigger id="speaker-1-voice">
									<SelectValue placeholder={t("speaker2_placeholder")} />
								</SelectTrigger>
								<SelectContent>
									{voices.map((voice) => (
										<SelectItem key={voice.id} value={voice.id}>
											<div className="flex flex-col">
												<span className="font-medium">{voice.name}</span>
												<span className="text-xs text-muted-foreground">{voice.description}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
