import { z } from "zod";

// ============================================================================
// Podcast Entity
// ============================================================================

export const podcastTranscriptEntry = z.object({
	speaker_id: z.number(),
	dialog: z.string(),
});

export const podcast = z.object({
	id: z.number(),
	title: z.string(),
	podcast_transcript: z.array(podcastTranscriptEntry).nullable(),
	file_location: z.string().nullable(),
	search_space_id: z.number(),
	tts_provider: z.string().nullable(),
	tts_voices: z.record(z.string()).nullable(),
	source_type: z.string().nullable(),
	duration_seconds: z.number().nullable(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type Podcast = z.infer<typeof podcast>;
export type PodcastTranscriptEntry = z.infer<typeof podcastTranscriptEntry>;

// ============================================================================
// TTS Voice
// ============================================================================

export const ttsVoice = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
});

export type TTSVoice = z.infer<typeof ttsVoice>;

export const ttsVoicesResponse = z.object({
	provider: z.string(),
	voices: z.array(ttsVoice),
});

export type TTSVoicesResponse = z.infer<typeof ttsVoicesResponse>;

// ============================================================================
// Get Podcasts
// ============================================================================

export const getPodcastsRequest = z.object({
	queryParams: z
		.object({
			skip: z.number().optional(),
			limit: z.number().optional(),
			search_space_id: z.number().optional(),
		})
		.optional(),
});

export type GetPodcastsRequest = z.infer<typeof getPodcastsRequest>;

export const getPodcastsResponse = z.array(podcast);

export type GetPodcastsResponse = z.infer<typeof getPodcastsResponse>;

// ============================================================================
// Get Single Podcast
// ============================================================================

export const getPodcastRequest = z.object({
	id: z.number(),
});

export type GetPodcastRequest = z.infer<typeof getPodcastRequest>;

export const getPodcastResponse = podcast;

export type GetPodcastResponse = z.infer<typeof getPodcastResponse>;

// ============================================================================
// Delete Podcast
// ============================================================================

export const deletePodcastRequest = z.object({
	id: z.number(),
});

export type DeletePodcastRequest = z.infer<typeof deletePodcastRequest>;

export const deletePodcastResponse = z.object({
	message: z.string(),
});

export type DeletePodcastResponse = z.infer<typeof deletePodcastResponse>;

// ============================================================================
// Generate Podcast
// ============================================================================

export const generatePodcastRequest = z.object({
	search_space_id: z.number(),
	podcast_title: z.string().default("SurfSense Podcast"),
	user_prompt: z.string().optional(),
	tts_provider: z.string().optional(),
	speaker_0_voice: z.string().optional(),
	speaker_1_voice: z.string().optional(),
	source_type: z.enum(["text", "document"]),
	text_content: z.string().optional(),
	document_file: z.instanceof(File).optional(),
});

export type GeneratePodcastRequest = z.infer<typeof generatePodcastRequest>;

export const generatePodcastResponse = z.object({
	status: z.literal("processing"),
	task_id: z.string(),
});

export type GeneratePodcastResponse = z.infer<typeof generatePodcastResponse>;

// ============================================================================
// Get Task Status
// ============================================================================

export const getPodcastTaskStatusRequest = z.object({
	task_id: z.string(),
});

export type GetPodcastTaskStatusRequest = z.infer<typeof getPodcastTaskStatusRequest>;

export const podcastTaskStatusResponse = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("processing"),
		state: z.string().optional(),
	}),
	z.object({
		status: z.literal("success"),
		podcast_id: z.number(),
		title: z.string(),
		transcript_entries: z.number(),
	}),
	z.object({
		status: z.literal("error"),
		error: z.string(),
	}),
]);

export type PodcastTaskStatusResponse = z.infer<typeof podcastTaskStatusResponse>;

// ============================================================================
// Get TTS Voices
// ============================================================================

export const getTTSVoicesRequest = z.object({
	provider: z.string(),
});

export type GetTTSVoicesRequest = z.infer<typeof getTTSVoicesRequest>;
