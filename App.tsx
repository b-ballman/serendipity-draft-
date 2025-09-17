import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stage, UserInput, InspirationFile, Script } from './types';
import { INITIAL_USER_INPUT, VEO_GENERATION_MESSAGES } from './constants';
import { toBase64 } from './utils/fileUtils';
import { generateScripts, generateVideoFromScript } from './services/geminiService';
import StepWrapper from './components/StepWrapper';
import { Input, Textarea, Button, Select } from './components/FormComponents';

const App: React.FC = () => {
    const [stage, setStage] = useState<Stage>(Stage.IDEA);
    const [userInput, setUserInput] = useState<UserInput>(INITIAL_USER_INPUT);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    const [scripts, setScripts] = useState<Script[]>([]);
    const [selectedScript, setSelectedScript] = useState<Script | null>(null);

    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [finalKeyframeUrl, setFinalKeyframeUrl] = useState<string | null>(null);
    const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);
    const [maxDuration, setMaxDuration] = useState<number | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (stage === Stage.GENERATING_VIDEO) {
            let messageIndex = 0;
            setLoadingMessage(VEO_GENERATION_MESSAGES[0]);
            interval = setInterval(() => {
                messageIndex = (messageIndex + 1) % VEO_GENERATION_MESSAGES.length;
                setLoadingMessage(VEO_GENERATION_MESSAGES[messageIndex]);
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [stage]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setUserInput({ ...userInput, [e.target.name]: e.target.value });
    };

    const handleInspirationFilesChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        if (!e.target.files) return;

        const files = Array.from(e.target.files);
        const newInspirationFiles: InspirationFile[] = await Promise.all(
            files.map(async (file: File): Promise<InspirationFile> => ({
                base64: await toBase64(file),
                mimeType: file.type,
                name: file.name,
                description: '',
                previewUrl: URL.createObjectURL(file),
            }))
        );

        if (type === 'image') {
            setUserInput(prev => ({ ...prev, inspirationImages: [...prev.inspirationImages, ...newInspirationFiles] }));
        } else {
            setUserInput(prev => ({ ...prev, inspirationVideos: [...prev.inspirationVideos, ...newInspirationFiles] }));
            // Check for video duration to set max length
            files.forEach(file => {
                const videoEl = document.createElement('video');
                videoEl.preload = 'metadata';
                videoEl.onloadedmetadata = () => {
                    window.URL.revokeObjectURL(videoEl.src);
                    const duration = Math.floor(videoEl.duration);
                    if (!maxDuration || duration > maxDuration) {
                        setMaxDuration(duration);
                        // Also update the current duration if it's longer than the new max
                        if (parseInt(userInput.duration, 10) > duration) {
                            setUserInput(prev => ({ ...prev, duration: duration.toString() }));
                        }
                    }
                };
                videoEl.src = URL.createObjectURL(file);
            });
        }
    };

    const handleInspirationDescriptionChange = (index: number, description: string, type: 'image' | 'video') => {
        const targetArray = type === 'image' ? [...userInput.inspirationImages] : [...userInput.inspirationVideos];
        targetArray[index].description = description;
        if (type === 'image') {
            setUserInput({ ...userInput, inspirationImages: targetArray });
        } else {
            setUserInput({ ...userInput, inspirationVideos: targetArray });
        }
    };

    const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await toBase64(file);
            setFinalAudioUrl(URL.createObjectURL(file));
            setUserInput({
                ...userInput,
                inspirationAudio: { base64, mimeType: file.type, name: file.name, description: '', previewUrl: '' },
            });
        }
    };

    const handleScriptGeneration = useCallback(async () => {
        setError(null);
        setIsLoading(true);
        try {
            const generatedScripts = await generateScripts(userInput);
            if (generatedScripts.length === 0) {
                setError("The AI couldn't generate any scripts. Try adjusting your inputs.");
            } else {
                setScripts(generatedScripts);
                setStage(Stage.SCRIPT_SELECT);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [userInput]);
    
    const handleVideoGeneration = useCallback(async (script: Script) => {
        setError(null);
        setSelectedScript(script);
        setStage(Stage.GENERATING_VIDEO);
        try {
            const result = await generateVideoFromScript(script, userInput, setLoadingMessage);
            setFinalVideoUrl(result.videoUrl);
            setFinalKeyframeUrl(result.keyframeUrl);
            setStage(Stage.RESULT);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred during video generation.");
            setStage(Stage.SCRIPT_SELECT);
        }
    }, [userInput]);

    const togglePlayback = () => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!video) return;
    
        const newIsPlaying = !isPlaying;
        
        if (newIsPlaying) {
            video.play();
            if (audio) audio.play();
        } else {
            video.pause();
            if (audio) audio.pause();
        }
        setIsPlaying(newIsPlaying);
    };

    const renderIdeaStage = () => (
        <StepWrapper title="Stage 1: What's your idea?" description="Start with the core concept. What story do you want to tell?">
            <div className="space-y-6">
                <Textarea label="Your Idea" name="idea" value={userInput.idea} onChange={handleInputChange} placeholder="e.g., A robot chef who dreams of earning a Michelin star." rows={6} />
                <Button onClick={() => setStage(Stage.INSPIRATION)} disabled={!userInput.idea.trim()}>Next: Add Inspiration</Button>
            </div>
        </StepWrapper>
    );

    const renderInspirationStage = () => (
        <StepWrapper title="Stage 2: Do you have inspiration?" description="Upload images, video clips, and music to help guide the AI's creative direction.">
            <div className="space-y-8">
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Inspiration Images & Videos</label>
                    <input type="file" multiple accept="image/*,video/*" onChange={(e) => handleInspirationFilesChange(e, e.target.accept.includes('image') ? 'image' : 'video')} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>
                {([...userInput.inspirationImages, ...userInput.inspirationVideos]).map((file, index) => {
                    const isImage = file.mimeType.startsWith('image');
                    const originalIndex = isImage ? index : index - userInput.inspirationImages.length;
                    return (
                        <div key={`${file.name}-${index}`} className="pl-4 border-l-2 border-gray-600 flex items-start gap-4">
                            {isImage ? (
                                <img src={file.previewUrl} alt={file.name} className="w-20 h-20 object-cover rounded-md" />
                            ) : (
                                <video src={file.previewUrl} className="w-20 h-20 object-cover rounded-md bg-black" />
                            )}
                            <div className="flex-1">
                                <p className="text-sm text-gray-400 truncate mb-2">{file.name}</p>
                                <Textarea label="What about this do you like?" value={file.description} onChange={(e) => handleInspirationDescriptionChange(originalIndex, e.target.value, isImage ? 'image' : 'video')} placeholder="e.g., The color palette, the fast-paced editing..." rows={2} />
                            </div>
                        </div>
                    )
                })}

                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">Music / Audio</label>
                    <input type="file" accept="audio/*" onChange={handleAudioChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>

                <div className="flex justify-between mt-6">
                    <Button onClick={() => setStage(Stage.IDEA)} className="w-auto bg-gray-600 hover:bg-gray-700">Back</Button>
                    <Button onClick={() => setStage(Stage.FINETUNING)} className="w-auto">Next: Fine-Tuning</Button>
                </div>
            </div>
        </StepWrapper>
    );

    const renderFinetuningStage = () => (
         <StepWrapper title="Stage 3: Fine-Tuning" description="Adjust the final details to perfect the output.">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Video Length (seconds)" name="duration" type="number" value={userInput.duration} onChange={handleInputChange} max={maxDuration || undefined} helperText={maxDuration ? `Max duration from uploaded video: ${maxDuration}s` : ''} />
                    <Select label="Aspect Ratio" name="aspectRatio" value={userInput.aspectRatio} onChange={handleInputChange}>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="4:3">4:3 (Classic TV)</option>
                        <option value="3:4">3:4 (Vertical)</option>
                    </Select>
                </div>
                <Input label="Mood / Style" name="mood" value={userInput.mood} onChange={handleInputChange} placeholder="e.g., Nostalgic, dreamlike, 80s sci-fi" />
                <Input label="Intended Audience" name="audience" value={userInput.audience} onChange={handleInputChange} placeholder="e.g., Tech enthusiasts, indie film lovers" />
                
                {error && <p className="text-red-400 text-center">{error}</p>}

                <div className="flex justify-between mt-6">
                    <Button onClick={() => setStage(Stage.INSPIRATION)} className="w-auto bg-gray-600 hover:bg-gray-700">Back</Button>
                    <Button onClick={handleScriptGeneration} isLoading={isLoading} className="w-auto">Generate Scripts</Button>
                </div>
            </div>
        </StepWrapper>
    );

    const renderScriptSelection = () => (
        <StepWrapper title="Choose Your Script" description="Pick the one that best fits your vision. We'll use your first inspiration image to create a keyframe, or generate one from the script if you didn't provide one.">
            {error && <p className="text-red-400 text-center mb-4">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {scripts.map((script, index) => (
                    <div key={index} className="bg-gray-700 p-6 rounded-lg flex flex-col justify-between border border-transparent hover:border-indigo-500 transition-all cursor-pointer" onClick={() => handleVideoGeneration(script)}>
                        <div>
                            <h3 className="font-bold text-lg text-indigo-300">{script.title}</h3>
                            <p className="text-sm text-gray-300 mt-2">{script.logline}</p>
                        </div>
                        <button className="mt-4 text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg px-4 py-2 w-full text-center">Select & Generate Video</button>
                    </div>
                ))}
            </div>
        </StepWrapper>
    );

    const renderGeneratingVideo = () => (
        <div className="flex flex-col items-center justify-center h-screen">
            <svg className="animate-spin h-12 w-12 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="to 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-2xl font-bold text-indigo-400">Creating Your Masterpiece...</h2>
            <p className="text-gray-400 mt-2 text-center max-w-md">{loadingMessage}</p>
        </div>
    );

    const renderResult = () => (
        <StepWrapper title="Your Vision, Realized" description="Here is the generated video based on your idea and selected script.">
            <div className="flex flex-col items-center gap-8">
                {finalVideoUrl && (
                    <div className="w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-700">
                        <video ref={videoRef} src={finalVideoUrl} className="w-full h-full" loop muted playsInline onEnded={() => setIsPlaying(false)} />
                    </div>
                )}
                {finalAudioUrl && <audio ref={audioRef} src={finalAudioUrl} loop />}

                <button onClick={togglePlayback} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-transform hover:scale-105">
                    {isPlaying ? 'Pause' : 'Play Video with Audio'}
                </button>

                <div className="w-full text-center p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h4 className="text-lg font-bold text-gray-300">Creative Elements</h4>
                    <div className="mt-4 flex flex-col md:flex-row items-center justify-center gap-8">
                        {finalKeyframeUrl && (
                            <div className="text-center">
                                <h5 className="text-sm font-semibold text-indigo-400 mb-2">Generated Keyframe</h5>
                                <img src={finalKeyframeUrl} alt="Generated Keyframe" className="w-48 h-48 object-cover rounded-lg shadow-lg"/>
                            </div>
                        )}
                        {selectedScript && (
                             <div className="text-left max-w-md">
                                <h5 className="text-sm font-semibold text-indigo-400 mb-2">Selected Script</h5>
                                <h6 className="font-bold text-white">{selectedScript.title}</h6>
                                <p className="text-sm text-gray-400">{selectedScript.logline}</p>
                            </div>
                        )}
                    </div>
                </div>
                 <button onClick={() => {
                     setStage(Stage.IDEA);
                     setUserInput(INITIAL_USER_INPUT);
                     setScripts([]);
                     setSelectedScript(null);
                     setFinalVideoUrl(null);
                     setFinalKeyframeUrl(null);
                     setFinalAudioUrl(null);
                     setError(null);
                 }} className="text-indigo-400 hover:text-indigo-300 mt-4 text-sm">Start a New Project</button>
            </div>
        </StepWrapper>
    );

    const renderCurrentStage = () => {
        switch (stage) {
            case Stage.IDEA:
                return renderIdeaStage();
            case Stage.INSPIRATION:
                return renderInspirationStage();
            case Stage.FINETUNING:
                return renderFinetuningStage();
            case Stage.SCRIPT_SELECT:
                return renderScriptSelection();
            case Stage.GENERATING_VIDEO:
                return renderGeneratingVideo();
            case Stage.RESULT:
                return renderResult();
            default:
                return renderIdeaStage();
        }
    };

    return (
        <main className="min-h-screen container mx-auto py-8">
            <header className="text-center mb-8">
                 <h1 className="text-5xl font-extrabold tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600">
                        Serendipity AI
                    </span>
                </h1>
                <p className="text-gray-400 mt-2">Helping Storytellers Express their Creativity</p>
            </header>
            {renderCurrentStage()}
        </main>
    );
};

export default App;