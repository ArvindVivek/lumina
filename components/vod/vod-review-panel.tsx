'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Film, Upload, Clock, Target, TrendingUp, Activity, Zap, Loader2 } from 'lucide-react';

interface VODReviewPanelProps {
  gameId: string;
  roundNumber?: number;
}

// Mock data
const MOCK_ANALYSIS = {
  strengths: [
    'Excellent utility coordination pre-plant',
    'Strong individual aim duels',
    'Good map control establishment',
    'Effective post-plant setups',
  ],
  improvements: [
    'Faster rotations needed on opposite site hits',
    'Better trade discipline in entry',
    'Improve eco round strategy',
  ],
  keyMoments: [
    { timestamp: 30, title: 'Eco Round Win', type: 'strategic' },
    { timestamp: 95, title: 'Clutch 1v2', type: 'clutch' },
    { timestamp: 180, title: 'Perfect Execute', type: 'execute' },
    { timestamp: 245, title: 'Retake Success', type: 'tactical' },
  ],
  stats: {
    roundTime: '48s',
    siteSuccess: 'A: 72% | B: 68%',
    firstBlood: '62%',
    clutch: '41%',
  },
};

export function VODReviewPanel({ gameId, roundNumber }: VODReviewPanelProps) {
  const [hasVOD, setHasVOD] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setHasVOD(true);
    }, 2000);
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  if (!hasVOD) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            VOD Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            {isUploading ? (
              <>
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Uploading...</h3>
              </>
            ) : (
              <>
                <Upload className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Upload VOD</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Upload a game recording for AI-powered review
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  Choose File
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[600px]">
      {/* Left: Video Player + Timeline */}
      <div className="flex flex-col gap-4">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Film className="h-5 w-5" />
                VOD Review {roundNumber && `- Round ${roundNumber}`}
              </CardTitle>
              <Badge variant="outline">AI Analysis Ready</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              />
            </div>

            {/* Key Moments Timeline */}
            <div className="space-y-2 overflow-y-auto flex-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Key Moments
              </h4>
              <div className="space-y-1">
                {MOCK_ANALYSIS.keyMoments.map((moment, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-3 p-2 rounded border hover:bg-muted/50 transition-colors text-left text-xs"
                    onClick={() => seekTo(moment.timestamp)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{moment.title}</div>
                      <div className="text-xs text-muted-foreground">{moment.type}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Math.floor(moment.timestamp / 60)}:{(moment.timestamp % 60).toString().padStart(2, '0')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: AI Insights */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Round Time</div>
            <div className="text-xl font-bold">{MOCK_ANALYSIS.stats.roundTime}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">First Blood</div>
            <div className="text-xl font-bold">{MOCK_ANALYSIS.stats.firstBlood}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Site Success</div>
            <div className="text-xs font-semibold">{MOCK_ANALYSIS.stats.siteSuccess}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Clutch Rate</div>
            <div className="text-xl font-bold">{MOCK_ANALYSIS.stats.clutch}</div>
          </Card>
        </div>

        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {MOCK_ANALYSIS.strengths.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Zap className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Improvements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <Target className="h-4 w-4" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {MOCK_ANALYSIS.improvements.map((i, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <Activity className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
