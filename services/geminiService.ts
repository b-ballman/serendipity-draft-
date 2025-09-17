import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { UserInput, Script, InspirationFile } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateScripts(userInput: UserInput): Promise<Script[]> {
    const imageInspirationText = userInput.inspirationImages.map(img => `- Image "${img.name}": ${img.description}`).join('\n');
    const videoInspirationText = userInput.inspirationVideos.map(vid => `- Video "${vid.name}": ${vid.description}`).join('\n');
    const inspirationText = [imageInspirationText, videoInspirationText].filter(Boolean).join('\n');

    const prompt = `
    You are a creative assistant for a storyteller. Based on the following detailed creative brief, generate 2 distinct script ideas for a short video.

    --- Creative Brief ---
    Core Idea: "${userInput.idea}"
    
    Fine-Tuning Details:
    - Desired Mood & Style: ${userInput.mood}
    - Target Audience: ${userInput.audience}
    - Aspect Ratio: ${userInput.aspectRatio}
    - Desired Duration: Approximately ${userInput.duration} seconds

    User-Provided Inspirations:
    ${inspirationText ? inspirationText : "No specific visual or video inspiration provided."}
    ${userInput.inspirationAudio ? `- The user provided an audio track named "${userInput.inspirationAudio.name}" to set the tone.` : ''}
    ---

    For each of the 2 ideas, provide:
    1. A catchy Title.
    2. A concise Logline (1-2 sentences).
    3. A Full Script with scene descriptions and actions, tailored to the specified duration and aspect ratio.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        scripts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    logline: { type: Type.STRING },
                                    fullScript: { type: Type.STRING }
                                },
                                required: ["title", "logline", "fullScript"]
                            }
                        }
                    },
                    required: ["scripts"]
                },
            },
        });

        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.scripts || [];
    } catch (error) {
        console.error("Error generating scripts:", error);
        throw new Error("Failed to generate scripts from the idea.");
    }
}

async function getVideoGenerationPrompts(script: Script, needsEditPrompt: boolean): Promise<{ videoPrompt: string, keyframeEditPrompt?: string }> {
    const prompt = `
    Based on the following script, create one or two things:
    1. A concise, descriptive prompt for a video generation AI (VEO 2.0) to create a single, cohesive video that tells the story of the script. This prompt should describe the visual style, pacing, key actions, and overall mood.
    ${needsEditPrompt ? "2. A short, creative prompt for an image editing AI (Nano Banana) to modify a base image to become a representative keyframe for the video. This prompt should describe what to add or change to capture the video's essence." : ""}
    
    Script Title: "${script.title}"
    Script Logline: "${script.logline}"
    Full Script: "${script.fullScript}"
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    videoPrompt: { type: Type.STRING, description: "Prompt for VEO 2.0 video generation." },
                    ...(needsEditPrompt && { keyframeEditPrompt: { type: Type.STRING, description: "Prompt for Nano Banana image editing." } })
                },
                required: ["videoPrompt"]
            }
        }
    });

    return JSON.parse(response.text);
}

async function generateKeyframeWithEdit(baseImage: InspirationFile, editPrompt: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [
                { inlineData: { data: baseImage.base64, mimeType: baseImage.mimeType } },
                { text: editPrompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("Nano Banana model did not return an image.");
}

async function generateInitialKeyframe(script: Script, aspectRatio: string): Promise<{ base64: string, mimeType: 'image/png' }> {
    const promptGenResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Based on the following script, create a single, concise, and highly descriptive prompt for an image generation AI (Imagen 4.0) to create a beautiful and representative keyframe image. The prompt should capture the core visual essence, style, and mood of the story. The aspect ratio should be ${aspectRatio}.
        
        Script Title: "${script.title}"
        Script Logline: "${script.logline}"
        Full Script: "${script.fullScript}"
        
        The final output should be just the prompt text, nothing else.`,
    });
    const imagePrompt = promptGenResponse.text.trim();

    const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const validatedAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : '16:9';

    const imageGenResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: imagePrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: validatedAspectRatio,
        },
    });

    if (!imageGenResponse.generatedImages || imageGenResponse.generatedImages.length === 0) {
        throw new Error("Imagen model did not return an image.");
    }

    const base64ImageBytes: string = imageGenResponse.generatedImages[0].image.imageBytes;
    return { base64: base64ImageBytes, mimeType: 'image/png' };
}

async function generateVideo(videoPrompt: string, keyframeImageBase64: string, mimeType: string): Promise<string> {
    let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: videoPrompt,
        image: {
            imageBytes: keyframeImageBase64,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation did not produce a download link.");
    }
    return downloadLink;
}

export async function generateVideoFromScript(
    script: Script,
    userInput: UserInput,
    updateLoadingMessage: (message: string) => void
): Promise<{ videoUrl: string, keyframeUrl: string }> {
    try {
        let keyframeBase64: string;
        let keyframeMimeType: string;
        let videoPrompt: string;

        if (userInput.inspirationImages.length > 0) {
            const inspirationImage = userInput.inspirationImages[0];
            keyframeMimeType = inspirationImage.mimeType;
            
            updateLoadingMessage('Developing creative prompts for AI models...');
            const prompts = await getVideoGenerationPrompts(script, true);
            videoPrompt = prompts.videoPrompt;

            updateLoadingMessage('Editing inspiration image to create a keyframe...');
            if (!prompts.keyframeEditPrompt) {
                throw new Error("Failed to generate a keyframe editing prompt.");
            }
            keyframeBase64 = await generateKeyframeWithEdit(inspirationImage, prompts.keyframeEditPrompt);
        } else {
            updateLoadingMessage('Generating a keyframe image from your script...');
            const { base64, mimeType } = await generateInitialKeyframe(script, userInput.aspectRatio);
            keyframeBase64 = base64;
            keyframeMimeType = mimeType;

            updateLoadingMessage('Developing a video prompt from your script...');
            const prompts = await getVideoGenerationPrompts(script, false);
            videoPrompt = prompts.videoPrompt;
        }

        updateLoadingMessage('Generating video with VEO 2.0 (this may take several minutes)...');
        const videoApiUrl = await generateVideo(videoPrompt, keyframeBase64, keyframeMimeType);
        
        updateLoadingMessage('Downloading generated video...');
        const response = await fetch(`${videoApiUrl}&key=${process.env.API_KEY}`);
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.statusText}`);
        }
        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        
        const keyframeUrl = `data:${keyframeMimeType};base64,${keyframeBase64}`;
        
        return { videoUrl, keyframeUrl };

    } catch (error) {
        console.error("Error in video generation pipeline:", error);
        throw new Error("Failed to generate the final video.");
    }
}