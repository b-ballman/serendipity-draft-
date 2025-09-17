import { UserInput } from './types';

export const INITIAL_USER_INPUT: UserInput = {
  idea: '',
  inspirationImages: [],
  inspirationVideos: [],
  inspirationAudio: null,
  duration: '15',
  mood: 'Cinematic',
  aspectRatio: '9:16',
  audience: 'General audience on social media',
};

export const VEO_GENERATION_MESSAGES: string[] = [
  'Warming up the director\'s chair...',
  'Analyzing your creative vision...',
  'Breaking down your script into shots...',
  'Generating a keyframe to set the mood...',
  'Assembling the first scene...',
  'Rendering high-fidelity visuals...',
  'This can take a few minutes, the best art takes time.',
  'Applying cinematic color grading...',
  'Adding final touches to the masterpiece...',
  'Almost there, preparing the final cut...',
];
