'use client';

import { useState, useRef } from 'react';
import { X, Film, Upload, Clock, Target, TrendingUp, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VODAnalysisModalProps {
  roundNumber: number;
  mapName: string;
  onClose: () => void;
}

// Mock AI analysis data based on bonus round Breeze scenario (Vid 2)
const MOCK_ANALYSIS = {
  strengths: [
    'Good sound cue awareness - heard Jett and took timing off pre-aim',
    'Effective use of teammate Sova recon dart info to pre-fire Clove',
    'Upgraded to Vandal from Jett kill - secured better weapon for team',
    'Smart fake defuse spike tap to bait Reyna swing',
  ],
  improvements: [
    'Should wait in smoke longer for team to regroup before initial swing',
    'Risky aggressive Sova swing in 4v3 - should wait for team instead of solo play',
    'Unnecessary aggression after fake defuse in 3v1 with spike advantage',
    'Safer play: stick defuse with 2 teammates covering rather than hunting Reyna',
    'Bonus round priority: win > take guns > don\'t throw - avoid risky hero plays',
  ],
  keyMoments: [
    { time: 2, title: 'Bonus Round Setup', type: 'strategic', description: 'Spectre in smoke, enemies on site with better guns' },
    { time: 4, title: 'Jett Timing Kill', type: 'ace', description: 'Sound cue pre-aim catches Jett off-guard' },
    { time: 6, title: 'Sova Dart Reveal', type: 'strategic', description: 'Teammate recon reveals Clove approaching' },
    { time: 8, title: 'Clove Pre-fire', type: 'ace', description: 'Pre-aim off full reveal secures kill (4v3)' },
    { time: 10, title: 'Aggressive Sova Kill', type: 'tactical', description: 'Lucky kill after whiffing - risky play in numbers advantage' },
    { time: 12, title: 'Wall Drops', type: 'strategic', description: 'Viper wall reveals 2 enemies at main, Chamber killed by teammate' },
    { time: 14, title: 'Fake Defuse Win', type: 'ace', description: 'Spike tap bait into Reyna swing secures round' },
  ],
  stats: {
    roundType: 'Bonus',
    kills: '4K',
    firstBlood: 'Jett',
    roundOutcome: 'Win',
  },
  tacticalSuggestions: {
    correctDecisions: [
      'Pre-aim off sound cue to catch Jett timing',
      'Pre-fire Clove with full info from Sova dart',
      'Fake defuse to bait enemy swing',
      'Upgraded gun from Jett kill - bonus objective met',
    ],
    riskyPlays: [
      'Solo swing on Sova in 4v3 instead of regrouping with team',
      'Aggressive swing after fake defuse in 3v1 with spike advantage',
      'Model encourages team play over hero rounds in bonus situations',
      'Risk: Reyna could take out team 1-by-1 and dismiss to main to reposition',
    ],
    saferAlternative: [
      'In 4v3: Wait for team to regroup before pushing Sova',
      'In 3v1 post-plant: Stick defuse with 2 teammates covering angles',
      'Spike not visible to Reyna - safe defuse with crossfire setup',
      'Bonus priority: Secure round win > avoid throwing with risky plays',
    ],
    bonusRoundContext: [
      'Highest priority: Win the round outright',
      'Secondary priority: Take out enemy guns if can\'t win',
      'Model recognizes bonus = minimize risk, maximize gun advantage',
      'Already eliminated Jett (good gun), avoid throwing won round',
    ]
  }
};

export function VODAnalysisModal({ roundNumber, mapName, onClose }: VODAnalysisModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVOD, setShowVOD] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2500));
    setIsProcessing(false);
    setShowVOD(true);
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-valorant-accent" />
            <h2 className="text-lg font-bold">
              VOD Review - Round {roundNumber} ({mapName})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-fast"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Upload Section */}
          {!showVOD && (
            <div className="border border-border rounded-lg">
              {!isProcessing ? (
                <div className="text-center py-16">
                  <Upload className="h-20 w-20 mx-auto text-text-tertiary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Upload Round VOD</h3>
                  <p className="text-sm text-text-tertiary mb-6">
                    Upload round {roundNumber} recording for AI-powered tactical analysis
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2 bg-valorant-accent text-background rounded-lg hover:bg-valorant-accent/90 transition-fast font-semibold"
                  >
                    Choose File
                  </button>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-valorant-accent border-r-transparent mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Processing VOD...</h3>
                  <p className="text-sm text-text-tertiary">
                    Analyzing round gameplay, detecting key moments, generating insights
                  </p>
                </div>
              )}
            </div>
          )}

          {/* VOD Player + Insights */}
          {showVOD && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(90vh-120px)]">
              {/* Left: Video Player + Timeline */}
              <div className="flex flex-col gap-4">
                <div className="border border-border rounded-lg p-4 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold mb-3">Round Recording</h3>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
                    <video
                      ref={videoRef}
                      className="w-full h-full"
                      controls
                      src="https://fbloukfgdjvwzdgrcnzt.supabase.co/storage/v1/object/public/videos/Hackathon-2-detected.mp4"
                    />
                  </div>

                  {/* Key Moments Timeline */}
                  <div className="space-y-2 overflow-y-auto flex-1">
                    <h4 className="text-xs font-semibold flex items-center gap-2 text-text-secondary">
                      <Clock className="h-3 w-3" />
                      Key Moments
                    </h4>
                    <div className="space-y-1">
                      {MOCK_ANALYSIS.keyMoments.map((moment, i) => (
                        <button
                          key={i}
                          onClick={() => seekTo(moment.time)}
                          className={cn(
                            "w-full text-left p-2 rounded border border-border hover:bg-surface-hover transition-fast text-xs",
                            moment.type === 'ace' && "border-l-4 border-l-valorant-accent"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-text-primary">{moment.title}</span>
                            <span className="text-text-tertiary text-xs">
                              0:{moment.time.toString().padStart(2, '0')}
                            </span>
                          </div>
                          <p className="text-text-tertiary text-xs">{moment.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: AI Insights */}
              <div className="flex flex-col gap-4 overflow-y-auto">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary mb-1">Round Type</div>
                    <div className="text-lg font-bold text-text-primary">{MOCK_ANALYSIS.stats.roundType}</div>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary mb-1">Player Kills</div>
                    <div className="text-lg font-bold text-valorant-accent">{MOCK_ANALYSIS.stats.kills}</div>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary mb-1">First Blood</div>
                    <div className="text-sm font-semibold text-text-primary">{MOCK_ANALYSIS.stats.firstBlood}</div>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary mb-1">Round Outcome</div>
                    <div className="text-lg font-bold text-win">{MOCK_ANALYSIS.stats.roundOutcome}</div>
                  </div>
                </div>

                {/* Strengths */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-green-500 mb-3">
                    <TrendingUp className="h-4 w-4" />
                    Good Decisions
                  </h3>
                  <ul className="space-y-2">
                    {MOCK_ANALYSIS.strengths.map((strength, i) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <Zap className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-text-secondary">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Improvements */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-orange-500 mb-3">
                    <Target className="h-4 w-4" />
                    Risky Plays / Improvements
                  </h3>
                  <ul className="space-y-2">
                    {MOCK_ANALYSIS.improvements.map((improvement, i) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <Activity className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                        <span className="text-text-secondary">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tactical Suggestions */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-500 mb-3">
                    <Zap className="h-4 w-4" />
                    Tactical Analysis
                  </h3>
                  <div className="space-y-4">
                    {/* Safer Alternative */}
                    <div>
                      <h4 className="text-xs font-semibold text-blue-400 mb-2">Safer Play (Recommended):</h4>
                      <ul className="space-y-1">
                        {MOCK_ANALYSIS.tacticalSuggestions.saferAlternative.map((tip, i) => (
                          <li key={i} className="text-xs flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span className="text-text-tertiary">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Bonus Round Context */}
                    <div>
                      <h4 className="text-xs font-semibold text-green-400 mb-2">Bonus Round Priority:</h4>
                      <ul className="space-y-1">
                        {MOCK_ANALYSIS.tacticalSuggestions.bonusRoundContext.map((tip, i) => (
                          <li key={i} className="text-xs flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span className="text-text-tertiary">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
