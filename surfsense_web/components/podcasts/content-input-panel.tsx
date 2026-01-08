"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
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
				<CardTitle>Content Source</CardTitle>
				<CardDescription>Provide the content you want to convert into a podcast</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs
					value={sourceType}
					onValueChange={(value) => onSourceTypeChange(value as "text" | "document")}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="text">Text Input</TabsTrigger>
						<TabsTrigger value="document">Upload Document</TabsTrigger>
					</TabsList>

					{/* Text Input Tab */}
					<TabsContent value="text" className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="text-content">Paste or type your content</Label>
							<Textarea
								id="text-content"
								placeholder="Enter the text content you want to convert into a podcast. The more detailed your content, the better the podcast will be..."
								value={textContent}
								onChange={handleTextChange}
								rows={12}
								className="resize-none"
							/>
							<div className="flex justify-between text-sm text-muted-foreground">
								<span>Words: {wordCount}</span>
								<span>Recommended: 500-2000 words for a 5-10 minute podcast</span>
							</div>
						</div>
					</TabsContent>

					{/* Document Upload Tab */}
					<TabsContent value="document" className="space-y-4">
						<div className="space-y-2">
							<Label>Upload Document</Label>
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
												{(documentFile.size / 1024).toFixed(2)} KB
											</p>
											<p className="text-xs text-primary">Click or drag to replace</p>
										</>
									) : (
										<>
											<p className="text-sm">
												{isDragActive ? "Drop the file here" : "Drag & drop a file here, or click to select"}
											</p>
											<p className="text-xs text-muted-foreground">
												Supported: PDF, DOCX, DOC, TXT, MD
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
