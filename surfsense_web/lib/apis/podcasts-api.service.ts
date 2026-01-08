import {
	type DeletePodcastRequest,
	type GeneratePodcastRequest,
	type GetPodcastRequest,
	type GetPodcastsRequest,
	type GetPodcastTaskStatusRequest,
	type GetTTSVoicesRequest,
	deletePodcastRequest,
	deletePodcastResponse,
	generatePodcastRequest,
	generatePodcastResponse,
	getPodcastRequest,
	getPodcastResponse,
	getPodcastsRequest,
	getPodcastsResponse,
	getPodcastTaskStatusRequest,
	getTTSVoicesRequest,
	podcastTaskStatusResponse,
	ttsVoicesResponse,
} from "@/contracts/types/podcast.types";
import { ValidationError } from "../error";
import { baseApiService } from "./base-api.service";

class PodcastsApiService {
	/**
	 * Get a list of podcasts with optional filtering and pagination
	 */
	getPodcasts = async (request: GetPodcastsRequest) => {
		const parsedRequest = getPodcastsRequest.safeParse(request);

		if (!parsedRequest.success) {
			console.error("Invalid request:", parsedRequest.error);

			const errorMessage = parsedRequest.error.issues.map((issue) => issue.message).join(", ");
			throw new ValidationError(`Invalid request: ${errorMessage}`);
		}

		// Transform query params to be string values
		const transformedQueryParams = parsedRequest.data.queryParams
			? Object.fromEntries(
					Object.entries(parsedRequest.data.queryParams).map(([k, v]) => [k, String(v)])
				)
			: undefined;

		const queryParams = transformedQueryParams
			? new URLSearchParams(transformedQueryParams).toString()
			: "";

		return baseApiService.get(`/api/v1/podcasts?${queryParams}`, getPodcastsResponse);
	};

	/**
	 * Get a single podcast by ID
	 */
	getPodcast = async (request: GetPodcastRequest) => {
		const parsedRequest = getPodcastRequest.safeParse(request);

		if (!parsedRequest.success) {
			console.error("Invalid request:", parsedRequest.error);

			const errorMessage = parsedRequest.error.issues.map((issue) => issue.message).join(", ");
			throw new ValidationError(`Invalid request: ${errorMessage}`);
		}

		return baseApiService.get(`/api/v1/podcasts/${request.id}`, getPodcastResponse);
	};

	/**
	 * Delete a podcast
	 */
	deletePodcast = async (request: DeletePodcastRequest) => {
		const parsedRequest = deletePodcastRequest.safeParse(request);

		if (!parsedRequest.success) {
			console.error("Invalid request:", parsedRequest.error);

			const errorMessage = parsedRequest.error.issues.map((issue) => issue.message).join(", ");
			throw new ValidationError(`Invalid request: ${errorMessage}`);
		}

		return baseApiService.delete(`/api/v1/podcasts/${request.id}`, deletePodcastResponse);
	};

	/**
	 * Generate a podcast from text content or document
	 */
	generatePodcast = async (request: GeneratePodcastRequest) => {
		const parsedRequest = generatePodcastRequest.safeParse(request);

		if (!parsedRequest.success) {
			console.error("Invalid request:", parsedRequest.error);

			const errorMessage = parsedRequest.error.issues.map((issue) => issue.message).join(", ");
			throw new ValidationError(`Invalid request: ${errorMessage}`);
		}

		// Build FormData
		const formData = new FormData();
		formData.append("search_space_id", String(request.search_space_id));
		formData.append("podcast_title", request.podcast_title);
		formData.append("source_type", request.source_type);

		if (request.user_prompt) {
			formData.append("user_prompt", request.user_prompt);
		}

		if (request.tts_provider) {
			formData.append("tts_provider", request.tts_provider);
		}

		if (request.speaker_0_voice) {
			formData.append("speaker_0_voice", request.speaker_0_voice);
		}

		if (request.speaker_1_voice) {
			formData.append("speaker_1_voice", request.speaker_1_voice);
		}

		if (request.source_type === "text" && request.text_content) {
			formData.append("text_content", request.text_content);
		}

		if (request.source_type === "document" && request.document_file) {
			formData.append("document_file", request.document_file);
		}

		// Use fetch directly for multipart/form-data
		const response = await fetch("/api/v1/podcasts/generate", {
			method: "POST",
			body: formData,
			credentials: "include",
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
			throw new Error(errorData.detail || `HTTP ${response.status}`);
		}

		const data = await response.json();
		return generatePodcastResponse.parse(data);
	};

	/**
	 * Get podcast generation task status
	 */
	getPodcastTaskStatus = async (request: GetPodcastTaskStatusRequest) => {
		const parsedRequest = getPodcastTaskStatusRequest.safeParse(request);

		if (!parsedRequest.success) {
			console.error("Invalid request:", parsedRequest.error);

			const errorMessage = parsedRequest.error.issues.map((issue) => issue.message).join(", ");
			throw new ValidationError(`Invalid request: ${errorMessage}`);
		}

		return baseApiService.get(
			`/api/v1/podcasts/task/${request.task_id}/status`,
			podcastTaskStatusResponse
		);
	};

	/**
	 * Get available TTS voices for a provider
	 */
	getTTSVoices = async (request: GetTTSVoicesRequest) => {
		const parsedRequest = getTTSVoicesRequest.safeParse(request);

		if (!parsedRequest.success) {
			console.error("Invalid request:", parsedRequest.error);

			const errorMessage = parsedRequest.error.issues.map((issue) => issue.message).join(", ");
			throw new ValidationError(`Invalid request: ${errorMessage}`);
		}

		// URL encode the provider (handles slashes in "openai/tts-1")
		const encodedProvider = encodeURIComponent(request.provider);

		return baseApiService.get(`/api/v1/podcasts/tts-voices/${encodedProvider}`, ttsVoicesResponse);
	};
}

export const podcastsApiService = new PodcastsApiService();
