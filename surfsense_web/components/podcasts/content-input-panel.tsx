"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface ContentInputPanelProps {
	sourceType: "text" | "document";
	onSourceTypeChange: (type: "text" | "document") => void;
	textContent: string;
	onTextContentChange: (content: string) => void;
	documentFile: File | null;
	onDocumentFileChange: (file: File | null) => void;
}

export function ContentInputPanel({
	sourceType,
	onSourceTypeChange,
	textContent,
	onTextContentChange,
	documentFile,
	onDocumentFileChange,
}: ContentInputPanelProps) {
	const t = useTranslations("nav_menu.podcast");

	const [wordCount, setWordCount] = useState(0);

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const content = e.target.value;
		onTextContentChange(content);

		// Calculate word count
		const words = content.trim().split(/\s+/).filter(Boolean);
		setWordCount(words.length);
	};

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			if (acceptedFiles.length > 0) {
				onDocumentFileChange(acceptedFiles[0]);
			}
		},
		[onDocumentFileChange]
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		maxFiles: 1,
		accept: {
			"text/plain": [".txt"],
			"application/pdf": [".pdf"],
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
			"application/msword": [".doc"],
			"text/markdown": [".md"],
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("content_source")}</CardTitle>
				<CardDescription>{t("content_source_desc")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs
					value={sourceType}
					onValueChange={(value) => onSourceTypeChange(value as "text" | "document")}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="text">{t("text_input")}</TabsTrigger>
						<TabsTrigger value="document">{t("upload_document")}</TabsTrigger>
					</TabsList>

					{/* Text Input Tab */}
					<TabsContent value="text" className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="text-content">{t("paste_content")}</Label>
							<Textarea
								id="text-content"
								placeholder={t("paste_placeholder")}
								value={textContent}
								onChange={handleTextChange}
								rows={12}
								className="resize-none"
							/>
							<div className="flex justify-between text-sm text-muted-foreground">
								<span>{t("word_count", { count: wordCount })}</span>
								<span>{t("recommended_words")}</span>
							</div>
						</div>
					</TabsContent>

					{/* Document Upload Tab */}
					<TabsContent value="document" className="space-y-4">
						<div className="space-y-2">
							<Label>{t("upload_document")}</Label>
							<div
								{...getRootProps()}
								className={`
									border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
									${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
								`}
							>
								<input {...getInputProps()} />
								<div className="flex flex-col items-center gap-2">
									<Upload className="h-10 w-10 text-muted-foreground" />
									{documentFile ? (
										<>
											<p className="text-sm font-medium">{documentFile.name}</p>
											<p className="text-xs text-muted-foreground">
												{t("file_size", { size: (documentFile.size / 1024).toFixed(2) })}
											</p>
											<p className="text-xs text-primary">{t("click_to_replace")}</p>
										</>
									) : (
										<>
											<p className="text-sm">
												{isDragActive ? t("drop_file") : t("drop_file")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t("supported_formats")}
											</p>
										</>
									)}
								</div>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
